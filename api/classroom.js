export const config = { runtime: 'edge' }

import { checkRateLimit, getClientIp, handleCors, withCors } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'
import { rejectStudent } from './_school.js'
import { CODE_RE } from '../lib/school/crypto.js'

// The service-role key, never the anon one. The anon key ships in the web
// bundle, and the classrooms/submissions tables had policies letting it read
// and write every row — so anyone could fetch every class's books straight
// from the database. The API is now the only way in, and these tables have
// no policies for anon at all (migration 017).
function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
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
    new Response(JSON.stringify(o), { status: s, headers: withCors({ 'Content-Type': 'application/json' }, req) })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) return json(503, { error: 'Classroom feature not configured' })

  // ── POST /api/classroom — RETIRED (Stage 4 review I8) ──
  // Legacy code-only classes were created here by any signed-in account,
  // with no teacher verification. New classes are made through
  // /api/school/classes (verified teachers only, with a free trial).
  if (req.method === 'POST') {
    return json(410, {
      error: 'Creating classes here has moved. Use the teacher area (/teacher/classes).',
      code: 'gone',
      use: '/api/school/classes',
    })
  }

  // ── GET /api/classroom?code=XXXX — fetch classroom + submissions ──
  // Public: anyone with the code (a 6-char code picked from 32 chars ≈ 1B
  // combinations) can view that classroom's submissions. Teachers share
  // codes with students, so gating this by JWT would block the normal flow.
  if (req.method === 'GET') {
    // Rate-limit the public read path so the code space can't be enumerated.
    const { allowed } = checkRateLimit(`classroom-read:${getClientIp(req)}`, 120)
    if (!allowed) return json(429, { error: 'Too many requests. Try again in an hour.' })

    const url = new URL(req.url, 'http://localhost')
    const rawCode = url.searchParams.get('code')?.toUpperCase() ?? ''
    if (!CODE_RE.test(rawCode)) return json(400, { error: 'Invalid code' })

    // Only the class's own teacher may read it. This used to need nothing but

    // the code, so anyone who saw or guessed one could read every child's

    // submitted book. A class with no recorded owner (made before owners were

    // tracked) is unreachable — the safe direction to fail.

    const auth = await verifyJwt(req)

    if (!auth.ok) return auth.response
    // Class accounts never own a legacy class.
    const rejected = rejectStudent(auth, req)
    if (rejected) return rejected


    const code = encodeURIComponent(rawCode)

    const classRes = await fetch(

      `${supabaseUrl}/rest/v1/classrooms?code=eq.${code}&owner_user_id=eq.${encodeURIComponent(auth.userId)}&select=code,name`,

      { headers: supabaseHeaders() }

    )

    const classrooms = await classRes.json()

    // Same 404 whether the class doesn't exist or belongs to someone else, so

    // the endpoint can't be used to find out which codes are real.

    if (!Array.isArray(classrooms) || !classrooms.length) return json(404, { error: 'Classroom not found' })

    const subRes = await fetch(
      `${supabaseUrl}/rest/v1/submissions?classroom_code=eq.${code}&select=id,book,submitted_at&order=submitted_at.asc`,
      { headers: supabaseHeaders() }
    )
    const submissions = await subRes.json()

    return json(200, { ...classrooms[0], submissions: submissions ?? [] })
  }

  return json(405, { error: 'Method not allowed' })
}
