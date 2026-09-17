-- Run this in Supabase Dashboard > SQL Editor
--
-- App Store Guideline 1.2 (user-generated content) requires an app that
-- shows other people's content to (a) filter objectionable material,
-- (b) let users report it, and (c) let users block abusive authors.
-- This migration is the (b) and (c) half; the filter runs at publish
-- time in api/publish-book.js.

-- ── Hiding ──────────────────────────────────────────────────────────
-- A book goes hidden either automatically (enough distinct reports) or
-- manually by us. Hidden books disappear from every public listing and
-- from the single-slug read, but the row is kept so we can review it.
ALTER TABLE published_books
  ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE published_books
  ADD COLUMN IF NOT EXISTS hidden_reason TEXT;

ALTER TABLE published_books
  ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;

-- Public listings filter on this, so index it.
CREATE INDEX IF NOT EXISTS idx_published_books_visible
  ON published_books(published_at DESC)
  WHERE hidden = FALSE;

-- ── Reports ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS book_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT NOT NULL REFERENCES published_books(slug) ON DELETE CASCADE,
  reporter_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One report per person per book, so a single user can't hide a book
  -- on their own by reporting it repeatedly.
  UNIQUE (slug, reporter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_book_reports_slug ON book_reports(slug);
CREATE INDEX IF NOT EXISTS idx_book_reports_open ON book_reports(created_at DESC) WHERE resolved = FALSE;

ALTER TABLE book_reports ENABLE ROW LEVEL SECURITY;
-- No public policies at all: reports are written by /api/report-book
-- with the service role, and only ever read by us. Without a policy,
-- RLS denies every anon/authenticated read and write by default.

-- ── Blocking an author ──────────────────────────────────────────────
-- A viewer can hide everything by a given author for themselves.
CREATE TABLE IF NOT EXISTS blocked_authors (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_blocked_authors_user ON blocked_authors(user_id);

ALTER TABLE blocked_authors ENABLE ROW LEVEL SECURITY;

-- A signed-in user manages only their own block list.
DROP POLICY IF EXISTS "Users read their own blocks" ON blocked_authors;
CREATE POLICY "Users read their own blocks"
  ON blocked_authors FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users create their own blocks" ON blocked_authors;
CREATE POLICY "Users create their own blocks"
  ON blocked_authors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users remove their own blocks" ON blocked_authors;
CREATE POLICY "Users remove their own blocks"
  ON blocked_authors FOR DELETE
  USING (auth.uid() = user_id);

-- ── Report + auto-hide, atomically ──────────────────────────────────
-- Called by /api/report-book with the service role. Records the report
-- and hides the book once REPORT_THRESHOLD distinct people have flagged
-- it, so objectionable content comes down within seconds rather than
-- waiting for us to look. Returns the resulting report count.
CREATE OR REPLACE FUNCTION report_published_book(
  p_slug TEXT,
  p_reporter UUID,
  p_reason TEXT,
  p_details TEXT DEFAULT NULL
)
RETURNS TABLE (report_count INTEGER, now_hidden BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_hidden BOOLEAN;
  c_threshold CONSTANT INTEGER := 2;
BEGIN
  INSERT INTO book_reports (slug, reporter_user_id, reason, details)
  VALUES (p_slug, p_reporter, p_reason, p_details)
  ON CONFLICT (slug, reporter_user_id) DO UPDATE
    SET reason = EXCLUDED.reason,
        details = EXCLUDED.details;

  SELECT COUNT(*) INTO v_count
  FROM book_reports
  WHERE slug = p_slug AND resolved = FALSE;

  IF v_count >= c_threshold THEN
    UPDATE published_books
    SET hidden = TRUE,
        hidden_reason = 'auto: ' || v_count || ' reports',
        hidden_at = NOW()
    WHERE slug = p_slug AND hidden = FALSE;
  END IF;

  SELECT hidden INTO v_hidden FROM published_books WHERE slug = p_slug;

  RETURN QUERY SELECT v_count, COALESCE(v_hidden, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION report_published_book(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION report_published_book(TEXT, UUID, TEXT, TEXT) FROM anon;
