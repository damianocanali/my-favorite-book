-- Run this in Supabase Dashboard > SQL Editor (or via MCP apply_migration).
--
-- Backs the recoverable account-deletion flow: a row's existence means the
-- account is scheduled for deletion; scheduled_for = requested_at + 7 days.

CREATE TABLE IF NOT EXISTS account_deletions (
  user_id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own deletion" ON account_deletions;
CREATE POLICY "read own deletion" ON account_deletions
  FOR SELECT USING (auth.uid() = user_id);
