-- Hardening sprint B review fix I4: give a picture back when it was
-- generated (and metered) but then REFUSED because output moderation was
-- down and the caller fails closed (students; teacher-made student
-- avatars). The child/class must not lose an allowance for a picture they
-- never received.
--
-- Mirrors school_bump_image (018): undoes one tick of the student's
-- images_today (only if it was taken today) and one of the class license's
-- images_used. Never goes below zero. Service role only.
--
-- Write-only here: NOT applied. Apply after 032. Idempotent: safe to re-run.
-- Until it is applied the API's refund call fails (404) and is logged; the
-- refusal itself still works.

create or replace function public.school_refund_image(p_student_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  st record;
begin
  select id, classroom_id, images_day, images_today into st
    from class_students where id = p_student_id for update;
  if not found then return false; end if;
  if st.images_day is distinct from current_date or st.images_today <= 0 then return false; end if;

  update class_students set images_today = images_today - 1 where id = st.id;
  update class_licenses set images_used = greatest(images_used - 1, 0), updated_at = now()
    where classroom_id = st.classroom_id;
  return true;
end $$;

revoke all on function public.school_refund_image(uuid) from public, anon, authenticated;
grant execute on function public.school_refund_image(uuid) to service_role;
