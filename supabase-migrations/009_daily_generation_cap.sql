-- Run this in Supabase Dashboard > SQL Editor.
--
-- Per-user, per-day hard ceiling on paid image generations. Sits behind the
-- auth + hourly rate limiter as a defense against a single compromised
-- account draining Together/Anthropic credits over a day.

CREATE TABLE IF NOT EXISTS daily_generation_counts (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day     DATE NOT NULL DEFAULT CURRENT_DATE,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE daily_generation_counts ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (via the RPC below) touches it.

-- Atomically increment today's count for the user and report whether the
-- request is within the limit. Over-limit attempts still increment, so they
-- stay blocked for the rest of the day.
CREATE OR REPLACE FUNCTION bump_generation(p_user_id UUID, p_limit INT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO daily_generation_counts (user_id, day, count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, day) DO UPDATE
    SET count = daily_generation_counts.count + 1
  RETURNING count INTO new_count;

  RETURN new_count <= p_limit;
END;
$$;

REVOKE ALL ON FUNCTION bump_generation(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION bump_generation(UUID, INT) FROM anon, authenticated;
