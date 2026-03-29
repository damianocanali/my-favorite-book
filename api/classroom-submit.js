import { checkRateLimit, getClientIp } from './_rateLimit.js'

function supabaseHeaders() {
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  return {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Classroom feature not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    })
  }

  const ip = getClientIp(req)
  const { allowed } = checkRateLimit(`classroom-submit:${ip}`, 20)
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests. Try again in an hour.' }), {
      status: 429, headers: { 'Content-Type': 'application/json' },
    })
  }

  const { code, book } = await req.json()
  if (!code || !book) {
    return new Response(JSON.stringify({ error: 'code and book are required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify the classroom exists
  const classRes = await fetch(
    `${supabaseUrl}/rest/v1/classrooms?code=eq.${code.toUpperCase()}&select=code`,
    { headers: supabaseHeaders() }
  )
  const classrooms = await classRes.json()
  if (!classrooms?.length) {
    return new Response(JSON.stringify({ error: 'Class code not found. Check with your teacher.' }), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Submit the book (strip base64 illustrations to keep payload small —
  // we store the book data but heavy images can be regenerated)
  const bookToStore = {
    ...book,
    coverImage: null,
    pages: book.pages?.map((p) => ({ ...p, illustrationData: null })) ?? [],
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/submissions`, {
    method: 'POST',
    headers: { ...supabaseHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({ classroom_code: code.toUpperCase(), book: bookToStore }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return new Response(JSON.stringify({ error: err.message || 'Failed to submit book' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  const [submission] = await res.json()
  return new Response(JSON.stringify({ id: submission.id }), {
    status: 201, headers: { 'Content-Type': 'application/json' },
  })
}
