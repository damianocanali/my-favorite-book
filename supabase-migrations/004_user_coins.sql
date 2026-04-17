-- Run this in Supabase Dashboard > SQL Editor.
--
-- Moves the coin balance and badge-claim ledger server-side. Client-side
-- state in localStorage was editable by anyone, so paid coin packs and
-- earned-badge rewards were free for the taking.

-- ── user_coins ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_coins (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance    INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_coins ENABLE ROW LEVEL SECURITY;

-- Users can read their own balance via the anon key if we ever switch to
-- direct PostgREST reads. Writes always go through server-only RPCs below.
DROP POLICY IF EXISTS "Users can read own coin balance" ON user_coins;
CREATE POLICY "Users can read own coin balance"
  ON user_coins FOR SELECT
  USING (auth.uid() = user_id);

-- ── user_badges ─────────────────────────────────────────────────────────────
-- Ledger of which badges a user has claimed coins for. Primary key prevents
-- double-claiming even if two requests race.
CREATE TABLE IF NOT EXISTS user_badges (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id   TEXT NOT NULL,
  earned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own badges" ON user_badges;
CREATE POLICY "Users can read own badges"
  ON user_badges FOR SELECT
  USING (auth.uid() = user_id);

-- ── RPC: add_coins (server-only, called from Stripe webhook) ────────────────
CREATE OR REPLACE FUNCTION add_coins(p_user_id UUID, p_amount INT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  INSERT INTO user_coins (user_id, balance, updated_at)
  VALUES (p_user_id, p_amount, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = user_coins.balance + EXCLUDED.balance,
        updated_at = NOW()
  RETURNING balance INTO new_balance;

  RETURN new_balance;
END;
$$;

-- Only the service role (webhook, admin) should add coins. Revoke from the
-- default PUBLIC grant and from the Supabase role aliases.
REVOKE ALL ON FUNCTION add_coins(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION add_coins(UUID, INT) FROM anon, authenticated;

-- ── RPC: spend_coins (called by the authed /api/spend-coins endpoint) ──────
-- Returns the new balance, or NULL if the user doesn't have enough.
CREATE OR REPLACE FUNCTION spend_coins(p_user_id UUID, p_amount INT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance INTEGER;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  UPDATE user_coins
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND balance >= p_amount
  RETURNING balance INTO new_balance;

  RETURN new_balance; -- NULL when the row was missing or balance insufficient
END;
$$;

REVOKE ALL ON FUNCTION spend_coins(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION spend_coins(UUID, INT) FROM anon, authenticated;

-- ── RPC: claim_badge (server-only, called by /api/claim-badge) ─────────────
-- Credits badge coins exactly once. Returns the new balance, or NULL if the
-- badge was already claimed.
CREATE OR REPLACE FUNCTION claim_badge(p_user_id UUID, p_badge_id TEXT, p_coins INT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted BOOLEAN := FALSE;
  new_balance INTEGER;
BEGIN
  INSERT INTO user_badges (user_id, badge_id)
  VALUES (p_user_id, p_badge_id)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;

  IF NOT inserted THEN
    RETURN NULL;
  END IF;

  IF p_coins > 0 THEN
    INSERT INTO user_coins (user_id, balance, updated_at)
    VALUES (p_user_id, p_coins, NOW())
    ON CONFLICT (user_id) DO UPDATE
      SET balance = user_coins.balance + EXCLUDED.balance,
          updated_at = NOW()
    RETURNING balance INTO new_balance;
  ELSE
    SELECT balance INTO new_balance FROM user_coins WHERE user_id = p_user_id;
    IF new_balance IS NULL THEN new_balance := 0; END IF;
  END IF;

  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION claim_badge(UUID, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_badge(UUID, TEXT, INT) FROM anon, authenticated;
