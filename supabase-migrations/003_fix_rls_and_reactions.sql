-- Run this in Supabase Dashboard > SQL Editor.
--
-- Removes two wide-open RLS policies that defeated per-user isolation:
--   - published_books."Anyone can react to books"  (USING true, WITH CHECK true)
--   - user_books."Service key full access"         (USING true, WITH CHECK true)
--
-- Adds an atomic RPC for sticker reactions so the public UPDATE policy is
-- no longer needed.

-- ── published_books ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can react to books" ON published_books;
-- If earlier iterations added other catch-all update policies, remove them too.
DROP POLICY IF EXISTS "Anyone can update published books" ON published_books;

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

GRANT EXECUTE ON FUNCTION increment_reaction(TEXT, TEXT) TO anon, authenticated;

-- ── user_books ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service key full access" ON user_books;
