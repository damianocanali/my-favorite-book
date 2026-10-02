-- book-illustrations: no more bucket listing by anyone (privacy review
-- §4.2 / §7.7). ALREADY APPLIED IN PRODUCTION by the owner; this file
-- records exactly that change so the repo matches the database.
--
-- Migration 014 created "Illustrations are publicly readable", a SELECT
-- policy on storage.objects with no role restriction. A public bucket does
-- not need a SELECT policy for downloads (public URLs bypass RLS), so the
-- policy's only effect was to let the anon key call
-- POST /storage/v1/object/list/book-illustrations and enumerate every
-- user-id folder and file name.
--
-- Replaced with a policy that lets a signed-in user see (and so list) only
-- their own folder. Public URL downloads are unaffected: the PDF worker,
-- Lulu, the gallery and the apps keep fetching by URL with no session.
--
-- NOT done here: restricting direct client WRITES for student accounts.
-- The iOS app's drawing canvas (ios-native/MyBookLab/Services/
-- IllustrationUploader.swift, used by CreateBookView "Draw" and the avatar
-- editor) uploads straight into <user id>/ with the user's own session, and
-- it is available to class (student) accounts. Adding
-- `coalesce(auth.jwt()->'app_metadata'->>'role','') <> 'student'` to the
-- 014 insert/update policies would break drawing for students, so that
-- change waits for a server-side drawing upload (or a private
-- student-illustrations bucket with signed URLs).
--
-- Idempotent: safe to re-run.

drop policy if exists "Illustrations are publicly readable" on storage.objects;
drop policy if exists "Users read their own illustrations" on storage.objects;

create policy "Users read their own illustrations"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'book-illustrations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
