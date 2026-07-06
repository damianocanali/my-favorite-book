-- Run this in Supabase Dashboard > SQL Editor.
--
-- Daily writing streaks. A "writing day" is any day the kid edits or
-- saves a book; the client reports its LOCAL calendar date and the
-- /api/streak endpoint + this RPC accept it only within ±1 day of UTC
-- today (timezone tolerance without letting anyone fast-forward).

CREATE TABLE IF NOT EXISTS user_streaks (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak   INTEGER NOT NULL DEFAULT 0,
  longest_streak   INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

-- Users may read their own streak directly (e.g. via the Supabase SDK);
-- writes only happen through the server-only RPC below.
DROP POLICY IF EXISTS "Users can read own streak" ON user_streaks;
CREATE POLICY "Users can read own streak"
  ON user_streaks FOR SELECT
  USING (auth.uid() = user_id);

-- ── RPC: touch_streak (server-only, called by /api/streak) ─────────────────
-- Marks p_day as active for the user and returns the updated streak.
--   same day again          → no-op
--   day after last active   → streak + 1
--   gap (or first ever day) → streak resets to 1
--   day before last active  → no-op (timezone stragglers can't rewind)
CREATE OR REPLACE FUNCTION touch_streak(p_user_id UUID, p_day DATE)
RETURNS TABLE(current_streak INTEGER, longest_streak INTEGER, last_active_date DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cur user_streaks%ROWTYPE;
BEGIN
  IF p_day < CURRENT_DATE - 1 OR p_day > CURRENT_DATE + 1 THEN
    RAISE EXCEPTION 'day out of range';
  END IF;

  SELECT * INTO cur FROM user_streaks s WHERE s.user_id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_active_date, updated_at)
    VALUES (p_user_id, 1, 1, p_day, NOW());
  ELSIF cur.last_active_date IS NULL OR p_day > cur.last_active_date + 1 THEN
    UPDATE user_streaks
      SET current_streak = 1, last_active_date = p_day, updated_at = NOW()
      WHERE user_id = p_user_id;
  ELSIF p_day = cur.last_active_date + 1 THEN
    UPDATE user_streaks
      SET current_streak   = cur.current_streak + 1,
          longest_streak   = GREATEST(cur.longest_streak, cur.current_streak + 1),
          last_active_date = p_day,
          updated_at       = NOW()
      WHERE user_id = p_user_id;
  END IF;
  -- p_day <= last_active_date → already counted, fall through.

  RETURN QUERY
    SELECT s.current_streak, s.longest_streak, s.last_active_date
    FROM user_streaks s WHERE s.user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION touch_streak(UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION touch_streak(UUID, DATE) FROM anon, authenticated;
