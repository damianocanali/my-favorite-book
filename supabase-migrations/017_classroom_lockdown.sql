-- Close the classroom tables to the public (anon) key.
--
-- classrooms and submissions carried four policies granting the `public` role
-- unconditional SELECT and INSERT. The anon key ships in the web bundle, so
-- anyone could read every classroom and every child's submitted book straight
-- from the Supabase REST API, and insert rows into either table.
--
-- api/classroom.js and api/classroom-submit.js now use the service-role key,
-- which bypasses RLS, so the API keeps working. With RLS still enabled and no
-- policies left, the anon and authenticated roles get nothing.
--
-- ORDER MATTERS: deploy the API change FIRST. Run this before it and the
-- classroom feature stops working until the deploy lands.
--
-- Idempotent.

alter table public.classrooms  enable row level security;
alter table public.submissions enable row level security;

drop policy if exists "Anyone can read classrooms"   on public.classrooms;
drop policy if exists "Anyone can insert classrooms" on public.classrooms;
drop policy if exists "Anyone can read submissions"   on public.submissions;
drop policy if exists "Anyone can insert submissions" on public.submissions;
