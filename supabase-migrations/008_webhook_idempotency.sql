-- Run this in Supabase Dashboard > SQL Editor.
--
-- Makes coin-credit webhooks idempotent. Stripe and RevenueCat both use
-- at-least-once delivery and retry on any non-2xx/timeout response, so
-- without a per-event ledger a single purchase could be credited two or
-- more times (e.g. a 500-coin pack becomes 1000). This mirrors the once-only
-- ledger pattern already used by claim_badge in 004.

-- ── processed_webhook_events ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  event_id   TEXT PRIMARY KEY,
  provider   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (webhooks / the RPC below) touches it.

-- ── RPC: credit_coins_once ──────────────────────────────────────────────────
-- Credits coins exactly once per provider event id. Returns the resulting
-- balance (unchanged when the event was already processed).
CREATE OR REPLACE FUNCTION credit_coins_once(
  p_user_id  UUID,
  p_amount   INT,
  p_event_id TEXT,
  p_provider TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted    BOOLEAN := FALSE;
  new_balance INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;
  IF p_event_id IS NULL OR length(p_event_id) = 0 THEN
    RAISE EXCEPTION 'event id required';
  END IF;

  -- Claim the event id. A conflict means this is a redelivery.
  INSERT INTO processed_webhook_events (event_id, provider)
  VALUES (p_event_id, p_provider)
  ON CONFLICT (event_id) DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;

  IF NOT inserted THEN
    SELECT balance INTO new_balance FROM user_coins WHERE user_id = p_user_id;
    RETURN COALESCE(new_balance, 0);
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

REVOKE ALL ON FUNCTION credit_coins_once(UUID, INT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION credit_coins_once(UUID, INT, TEXT, TEXT) FROM anon, authenticated;
