-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE user_books (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  book_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- Fast lookup by user
CREATE INDEX idx_user_books_user ON user_books(user_id, updated_at DESC);

-- Enable Row Level Security.
-- The API routes run with the Supabase service role, which bypasses RLS,
-- so no policy is needed for server-side access. These policies are the
-- safety net if the anon key is ever used directly against this table.
ALTER TABLE user_books ENABLE ROW LEVEL SECURITY;

-- Users can only read their own books
CREATE POLICY "Users can read own books"
  ON user_books FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own books
CREATE POLICY "Users can insert own books"
  ON user_books FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own books
CREATE POLICY "Users can update own books"
  ON user_books FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own books
CREATE POLICY "Users can delete own books"
  ON user_books FOR DELETE
  USING (auth.uid() = user_id);
