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

-- Anyone can insert (publish) a book
CREATE POLICY "Anyone can publish a book"
  ON published_books FOR INSERT
  WITH CHECK (true);

-- Anyone can update reaction_counts (for sticker reactions)
CREATE POLICY "Anyone can react to books"
  ON published_books FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- To feature a book, run this in SQL Editor:
-- UPDATE published_books SET featured = TRUE, featured_at = NOW() WHERE slug = 'the-book-slug';
