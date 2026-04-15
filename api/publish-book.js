export const config = { runtime: 'edge' }

import { checkRateLimit, getClientIp, handleCors, withCors } from './_rateLimit.js'

function supabaseHeaders(serviceKey) {
  return {
    'Content-Type': 'application/json',
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
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

  const ip = getClientIp(req)
  const headers = supabaseHeaders(supabaseKey)
  const json = (s, o) => new Response(JSON.stringify(o), { status: s, headers: withCors({ 'Content-Type': 'application/json' }) })

  // GET — fetch a single published book by slug
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const slug = url.searchParams.get('slug')
    const featured = url.searchParams.get('featured')

    if (slug) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/published_books?slug=eq.${encodeURIComponent(slug)}&select=*`,
        { headers }
      )
      const rows = await res.json()
      if (!rows?.length) return json(404, { error: 'Book not found' })
      // Return user_id so the client can determine ownership
      return json(200, rows[0])
    }

    // Fetch featured books
    if (featured !== null) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/published_books?featured=eq.true&order=featured_at.desc&limit=20&select=slug,title,author_name,author_age,cover_emoji,cover_color,reaction_counts,published_at`,
        { headers }
      )
      const rows = await res.json()
      return json(200, rows || [])
    }

    // Fetch recent books (all published, newest first)
    const recent = url.searchParams.get('recent')
    if (recent !== null) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/published_books?order=published_at.desc&limit=30&select=slug,user_id,title,author_name,author_age,cover_emoji,cover_color,reaction_counts,published_at,featured`,
        { headers }
      )
      const rows = await res.json()
      return json(200, rows || [])
    }

    return json(400, { error: 'slug, featured, or recent param required' })
  }

  // DELETE — remove a published book (owner only)
  if (req.method === 'DELETE') {
    const { slug, userId } = await req.json()
    if (!slug || !userId) return json(400, { error: 'slug and userId required' })

    // Verify ownership before deleting
    const checkRes = await fetch(
      `${supabaseUrl}/rest/v1/published_books?slug=eq.${encodeURIComponent(slug)}&select=user_id`,
      { headers }
    )
    const rows = await checkRes.json()
    if (!rows?.length) return json(404, { error: 'Book not found' })
    if (rows[0].user_id !== userId) return json(403, { error: 'Not authorized' })

    const delRes = await fetch(
      `${supabaseUrl}/rest/v1/published_books?slug=eq.${encodeURIComponent(slug)}`,
      { method: 'DELETE', headers }
    )
    if (!delRes.ok) return json(500, { error: 'Failed to delete' })
    return json(200, { success: true })
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  // POST — publish a book
  const { allowed } = checkRateLimit(`publish:${ip}`, 10)
  if (!allowed) return json(429, { error: 'Too many requests. Try again later.' })

  const { book, userId } = await req.json()
  if (!book || !book.title || !book.pages?.length) {
    return json(400, { error: 'A valid book is required' })
  }

  // Generate a unique slug
  const baseSlug = book.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const slug = `${baseSlug}-${Date.now().toString(36)}`

  // Store book with images included (they'll view them)
  const record = {
    slug,
    user_id: userId || null,
    title: book.title,
    author_name: book.authorName || 'Anonymous',
    author_age: book.authorAge || null,
    cover_emoji: book.characters?.[0]?.emoji || book.setting?.emoji || null,
    cover_color: book.colors?.cover || '#8B5CF6',
    book_data: book,
    reaction_counts: {},
    featured: true,
    featured_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/published_books`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(record),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return json(500, { error: err.message || 'Failed to publish' })
  }

  const [published] = await res.json()
  return json(201, { slug: published.slug, url: `/view/${published.slug}` })
}
