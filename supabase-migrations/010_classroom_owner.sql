-- Run this in Supabase Dashboard > SQL Editor.
--
-- Tie each classroom to the teacher (auth user) who created it. Lets future
-- teacher-only actions be gated by ownership instead of treating the join
-- code as the only secret. Nullable so existing rows keep working.

ALTER TABLE classrooms
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
