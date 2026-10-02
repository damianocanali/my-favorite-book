export const config = { runtime: 'edge' }

import { checkRateLimit, getClientIp, handleCors, withCors } from './_rateLimit.js'
import { verifyJwt } from './_auth.js'
import { isStudent } from './_school.js'
import { legacySunsetPassed } from '../lib/school/legacy.js'

const CODE_RE = /^[A-Z0-9]{6,8}$/
// After stripping illustrations a book should be well under this; we still
// reject anything much larger to stop someone stuffing MBs into submissions.
const MAX_BOOK_BYTES = 200_000

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

  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!supabaseUrl || !supabaseKey) return json(503, { error: 'Classroom feature not configured' })

  const ip = getClientIp(req)
  const { allowed } = checkRateLimit(`classroom-submit:${ip}`, 20)
  if (!allowed) return json(429, { error: 'Too many requests. Try again in an hour.' })

  // A Bearer token identifies the sender for stats (`submissions.user_id`,
  // nullable), but this endpoint predates student accounts and is not how
  // they hand in work (Stage 2 assignments are). verifyJwt returns ok:false
  // for both "no token" and "invalid/expired token" — either way this falls
  // through to the anonymous submit below exactly as it did before students
  // existed; only a STUDENT's valid JWT is rejected outright.
  let submitterId = null
  const auth = await verifyJwt(req)
  if (auth.ok) {
    if (isStudent(auth)) {
      return json(403, { error: 'Students hand in through assignments, not this form.', code: 'use_hand_in' })
    }
    submitterId = auth.userId
  }

  // Sunset (lib/school/legacy.js, review §7.22): anonymous books have no
  // owner, so no deletion request can ever reach them. After the date only
  // signed-in submits (which carry user_id) are accepted.
  if (!submitterId && legacySunsetPassed()) {
    return json(410, { error: 'Sign in to send your book to your class.', code: 'sign_in_required' })
  }

  const { code, book } = await req.json().catch(() => ({}))
  const normalizedCode = typeof code === 'string' ? code.toUpperCase() : ''
  if (!CODE_RE.test(normalizedCode)) return json(400, { error: 'Invalid code' })
  if (!book || typeof book !== 'object') return json(400, { error: 'book is required' })

  // Drop heavy illustration payloads before we check the size budget.
  const bookToStore = {
    ...book,
    coverImage: null,
    pages: Array.isArray(book.pages)
      ? book.pages.map((p) => ({ ...p, illustrationData: null }))
      : [],
  }

  const serialized = JSON.stringify(bookToStore)
  if (serialized.length > MAX_BOOK_BYTES) {
    return json(413, { error: 'Book is too large to submit' })
  }

  const encoded = encodeURIComponent(normalizedCode)
  const classRes = await fetch(
    `${supabaseUrl}/rest/v1/classrooms?code=eq.${encoded}&select=code`,
    { headers: supabaseHeaders() }
  )
  const classrooms = await classRes.json()
  if (!classrooms?.length) {
    return json(404, { error: 'Class code not found. Check with your teacher.' })
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/submissions`, {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({
      classroom_code: normalizedCode,
      book: bookToStore,
      ...(submitterId ? { user_id: submitterId } : {}),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return json(500, { error: err.message || 'Failed to submit book' })
  }

  const [submission] = await res.json()
  return json(201, { id: submission.id })
}
