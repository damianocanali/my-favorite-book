-- Per-class switch for student check-ins (privacy review §7.28): a school
-- or district can turn feelings collection off (PPRA / district
-- preference). Default ON keeps today's behaviour.
--
-- When off: POST /api/school/checkin refuses (403 checkins_off) and stores
-- nothing; the child's app hides the check-in entry (it reads the flag
-- from GET /api/school/assignments). Existing check-ins are not deleted by
-- the switch; they age out with the 30-day retention (api/cron/retention.js).
--
-- Apply BEFORE deploying the code that reads it (classes list, student
-- routes select it). Idempotent.

alter table public.classrooms
  add column if not exists checkins_enabled boolean not null default true;
