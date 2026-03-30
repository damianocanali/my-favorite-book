export const config = { runtime: 'edge' }

import { checkRateLimit, getClientIp } from './_rateLimit.js'

// Characters that are unambiguous to read aloud and type
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode() {
  return Array.from({ length: 6 }, () =>
    CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  ).join('')
}

function supabaseHeaders() {
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  return {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
  }
}

export default async function handler(req) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Classroom feature not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── POST /api/classroom — create a new classroom ──
  if (req.method === 'POST') {
    const ip = getClientIp(req)
    const { allowed } = checkRateLimit(`classroom-create:${ip}`, 10)
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Too many requests. Try again in an hour.' }), {
        status: 429, headers: { 'Content-Type': 'application/json' },
      })
    }

    const { name } = await req.json()
    if (!name?.trim()) {
      return new Response(JSON.stringify({ error: 'Class name is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    const code = generateCode()
    const res = await fetch(`${supabaseUrl}/rest/v1/classrooms`, {
      method: 'POST',
      headers: { ...supabaseHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({ code, name: name.trim() }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return new Response(JSON.stringify({ error: err.message || 'Failed to create classroom' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      })
    }

    const [classroom] = await res.json()
    return new Response(JSON.stringify({ code: classroom.code, name: classroom.name }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── GET /api/classroom?code=XXXX — fetch classroom + submissions ──
  if (req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost')
    const code = url.searchParams.get('code')?.toUpperCase()

    if (!code) {
      return new Response(JSON.stringify({ error: 'code is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch classroom
    const classRes = await fetch(
      `${supabaseUrl}/rest/v1/classrooms?code=eq.${code}&select=code,name`,
      { headers: supabaseHeaders() }
    )
    const classrooms = await classRes.json()
    if (!classrooms?.length) {
      return new Response(JSON.stringify({ error: 'Classroom not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch submissions
    const subRes = await fetch(
      `${supabaseUrl}/rest/v1/submissions?classroom_code=eq.${code}&select=id,book,submitted_at&order=submitted_at.asc`,
      { headers: supabaseHeaders() }
    )
    const submissions = await subRes.json()

    return new Response(JSON.stringify({ ...classrooms[0], submissions: submissions ?? [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405, headers: { 'Content-Type': 'application/json' },
  })
}
