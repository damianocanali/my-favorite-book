-- Run this in Supabase Dashboard > SQL Editor.
--
-- Apple App Attest support for the paid AI endpoints. Each iOS install
-- registers a Secure Enclave key once (attestation, verified by
-- /api/attest/register), then signs every paid request (assertion,
-- verified inline by api/_appAttest.js). Attested requests get the full
-- daily cap; unattested ones (web, old builds) get a reduced one.

-- ── Registered keys (service-role only) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_attest_keys (
  key_id         TEXT PRIMARY KEY,             -- base64 SHA256 of the public key
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  public_key_pem TEXT NOT NULL,                -- SPKI PEM extracted from credCert
  environment    TEXT NOT NULL DEFAULT 'production',
  counter        BIGINT NOT NULL DEFAULT 0,    -- last seen assertion counter
  attested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at   TIMESTAMPTZ
);

ALTER TABLE app_attest_keys ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role reads/writes these.

CREATE INDEX IF NOT EXISTS app_attest_keys_user_idx ON app_attest_keys (user_id);

-- ── One-time challenges (service-role only) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS app_attest_challenges (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge  TEXT NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE app_attest_challenges ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS app_attest_challenges_created_idx
  ON app_attest_challenges (created_at);

-- ── RPC: consume_attest_challenge ───────────────────────────────────────────
-- Atomically marks a challenge used and returns it (NULL when missing,
-- already used, owned by someone else, or older than 10 minutes).
CREATE OR REPLACE FUNCTION consume_attest_challenge(p_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge TEXT;
BEGIN
  UPDATE app_attest_challenges
    SET used = TRUE
    WHERE id = p_id
      AND user_id = p_user_id
      AND NOT used
      AND created_at > NOW() - INTERVAL '10 minutes'
    RETURNING challenge INTO v_challenge;
  RETURN v_challenge;
END;
$$;

REVOKE ALL ON FUNCTION consume_attest_challenge(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION consume_attest_challenge(UUID, UUID) FROM anon, authenticated;

-- ── RPC: bump_assertion_counter ─────────────────────────────────────────────
-- Advances the per-key assertion counter, but only forward — a replayed
-- assertion (counter <= stored) returns FALSE and changes nothing.
CREATE OR REPLACE FUNCTION bump_assertion_counter(p_key_id TEXT, p_user_id UUID, p_counter BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INTEGER;
BEGIN
  UPDATE app_attest_keys
    SET counter = p_counter, last_used_at = NOW()
    WHERE key_id = p_key_id
      AND user_id = p_user_id
      AND p_counter > counter;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END;
$$;

REVOKE ALL ON FUNCTION bump_assertion_counter(TEXT, UUID, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION bump_assertion_counter(TEXT, UUID, BIGINT) FROM anon, authenticated;
