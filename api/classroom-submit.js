export const config = { runtime: 'edge' }

import { checkRateLimit, getClientIp, handleCors, withCors } from './_rateLimit.js'

const CODE_RE = /^[A-Z0-9]{4,8}$/
// After stripping illustrations a book should be well under this; we still
// reject anything much larger to stop someone stuffing MBs into submissions.
const MAX_BOOK_BYTES = 200_000

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

  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) return json(503, { error: 'Classroom feature not configured' })

  const ip = getClientIp(req)
  const { allowed } = checkRateLimit(`classroom-submit:${ip}`, 20)
  if (!allowed) return json(429, { error: 'Too many requests. Try again in an hour.' })

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
    body: JSON.stringify({ classroom_code: normalizedCode, book: bookToStore }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return json(500, { error: err.message || 'Failed to submit book' })
  }

  const [submission] = await res.json()
  return json(201, { id: submission.id })
}
