export const config = { runtime: 'edge' }

import { handleCors, withCors } from './_rateLimit.js'

function supabaseHeaders(key) {
  return {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
  }
}

export default async function handler(req) {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Not configured' }), {
      status: 503, headers: withCors({ 'Content-Type': 'application/json' }),
    })
  }

  const headers = supabaseHeaders(supabaseKey)
  const json = (s, o) => new Response(JSON.stringify(o), {
    status: s, headers: withCors({ 'Content-Type': 'application/json' }),
  })

  // GET — fetch all books for a user
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId')
    if (!userId) return json(400, { error: 'userId required' })

    const res = await fetch(
      `${supabaseUrl}/rest/v1/user_books?user_id=eq.${userId}&order=updated_at.desc&select=book_id,book_data,updated_at`,
      { headers }
    )
    const rows = await res.json()
    return json(200, rows || [])
  }

  // POST — upsert a book (save or update)
  if (req.method === 'POST') {
    const { userId, book } = await req.json()
    if (!userId || !book?.id) return json(400, { error: 'userId and book required' })

    // Strip large base64 images to keep DB payload reasonable
    // Store a lightweight version — images stay in localStorage
    const lightBook = {
      ...book,
      coverImage: book.coverImage ? '[saved-locally]' : null,
      pages: book.pages?.map((p) => ({
        ...p,
        illustrationData: p.illustrationData ? '[saved-locally]' : null,
      })) ?? [],
    }

    const record = {
      user_id: userId,
      book_id: book.id,
      book_data: lightBook,
      title: book.title || 'Untitled',
      updated_at: book.updatedAt || new Date().toISOString(),
    }

    // Upsert by user_id + book_id
    const res = await fetch(
      `${supabaseUrl}/rest/v1/user_books?on_conflict=user_id,book_id`,
      {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(record),
      }
    )

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return json(500, { error: err.message || 'Failed to save' })
    }

    return json(200, { saved: true })
  }

  // DELETE — remove a book
  if (req.method === 'DELETE') {
    const { userId, bookId } = await req.json()
    if (!userId || !bookId) return json(400, { error: 'userId and bookId required' })

    await fetch(
      `${supabaseUrl}/rest/v1/user_books?user_id=eq.${userId}&book_id=eq.${bookId}`,
      { method: 'DELETE', headers }
    )

    return json(200, { deleted: true })
  }

  return json(405, { error: 'Method not allowed' })
}
