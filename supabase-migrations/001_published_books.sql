-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE published_books (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Anonymous',
  author_age INTEGER,
  cover_emoji TEXT,
  cover_color TEXT DEFAULT '#8B5CF6',
  book_data JSONB NOT NULL,
  reaction_counts JSONB DEFAULT '{}'::jsonb,
  featured BOOLEAN DEFAULT FALSE,
  featured_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast slug lookups (public viewer)
CREATE INDEX idx_published_books_slug ON published_books(slug);

-- Index for featured gallery
CREATE INDEX idx_published_books_featured ON published_books(featured, featured_at DESC) WHERE featured = TRUE;

-- Enable Row Level Security
ALTER TABLE published_books ENABLE ROW LEVEL SECURITY;

-- Anyone can read published books (they're public)
CREATE POLICY "Published books are publicly readable"
  ON published_books FOR SELECT
  USING (true);

-- Writes go through the API (service role, which bypasses RLS). No
-- public insert/update/delete policies — the permissive legacy ones
-- would let any anon caller rewrite titles, bodies, ownership, and
-- the featured flag.

-- Atomic sticker-reaction increment, called from /api/react-book.
-- Bumps a single allowed sticker key without clobbering concurrent writes.
CREATE OR REPLACE FUNCTION increment_reaction(p_slug TEXT, p_sticker TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed_stickers TEXT[] := ARRAY['❤️','⭐','😍','🎉','👏','🦄','🌈','🔥','💎','🫶'];
  new_counts JSONB;
BEGIN
  IF NOT (p_sticker = ANY(allowed_stickers)) THEN
    RAISE EXCEPTION 'invalid sticker';
  END IF;

  UPDATE published_books
  SET reaction_counts = jsonb_set(
    COALESCE(reaction_counts, '{}'::jsonb),
    ARRAY[p_sticker],
    to_jsonb(COALESCE((reaction_counts ->> p_sticker)::int, 0) + 1)
  )
  WHERE slug = p_slug
  RETURNING reaction_counts INTO new_counts;

  RETURN new_counts;
END;
$$;

-- Anon clients (react-book endpoint) must be able to call this RPC.
GRANT EXECUTE ON FUNCTION increment_reaction(TEXT, TEXT) TO anon, authenticated;

-- To feature a book, run this in SQL Editor:
-- UPDATE published_books SET featured = TRUE, featured_at = NOW() WHERE slug = 'the-book-slug';
