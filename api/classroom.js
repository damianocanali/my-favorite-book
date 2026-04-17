export const config = { runtime: 'edge' }

import { checkRateLimit, getClientIp, handleCors, withCors } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'

// Characters that are unambiguous to read aloud and type.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_RE = /^[A-Z0-9]{4,8}$/

function generateCode() {
  return Array.from({ length: 6 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('')
}

function supabaseHeaders() {
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
  }
}

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const json = (s, o) =>
    new Response(JSON.stringify(o), { status: s, headers: withCors({ 'Content-Type': 'application/json' }) })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return json(503, { error: 'Classroom feature not configured' })

  // ── POST /api/classroom — create a new classroom (teacher, signed in) ──
  if (req.method === 'POST') {
    const auth = await verifyJwt(req)
    if (!auth.ok) return auth.response

    const { allowed } = checkRateLimit(`classroom-create:${auth.userId}`, 10)
    if (!allowed) return json(429, { error: 'Too many requests. Try again in an hour.' })

    const { name } = await req.json().catch(() => ({}))
    if (!name?.trim()) return json(400, { error: 'Class name is required' })

    const code = generateCode()
    const res = await fetch(`${supabaseUrl}/rest/v1/classrooms`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({ code, name: name.trim().slice(0, 60) }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return json(500, { error: err.message || 'Failed to create classroom' })
    }

    const [classroom] = await res.json()
    return json(201, { code: classroom.code, name: classroom.name })
  }

  // ── GET /api/classroom?code=XXXX — fetch classroom + submissions ──
  // Public: anyone with the code (a 6-char code picked from 32 chars ≈ 1B
  // combinations) can view that classroom's submissions. Teachers share
  // codes with students, so gating this by JWT would block the normal flow.
  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost')
    const rawCode = url.searchParams.get('code')?.toUpperCase() ?? ''
    if (!CODE_RE.test(rawCode)) return json(400, { error: 'Invalid code' })

    const code = encodeURIComponent(rawCode)
    const classRes = await fetch(
      `${supabaseUrl}/rest/v1/classrooms?code=eq.${code}&select=code,name`,
      { headers: supabaseHeaders() }
    )
    const classrooms = await classRes.json()
    if (!classrooms?.length) return json(404, { error: 'Classroom not found' })

    const subRes = await fetch(
      `${supabaseUrl}/rest/v1/submissions?classroom_code=eq.${code}&select=id,book,submitted_at&order=submitted_at.asc`,
      { headers: supabaseHeaders() }
    )
    const submissions = await subRes.json()

    return json(200, { ...classrooms[0], submissions: submissions ?? [] })
  }

  return json(405, { error: 'Method not allowed' })
}
