-- Run this in Supabase Dashboard > SQL Editor.
--
-- Illustrations used to live only on the device as base64 data URLs, and
-- sync-books replaced them with the literal string '[saved-locally]' to
-- keep the user_books JSON small. The print pipeline reads that same
-- stored book, so every printed page rendered <img src="[saved-locally]">
-- — a broken image in a product people pay for.
--
-- Fix: illustrations go to Storage and the book keeps a plain URL, which
-- is small enough to sync and is fetchable by the PDF worker and by
-- Together's upscaler.
--
-- Public-read is deliberate: the PDF worker and Lulu fetch these by URL
-- with no session, and published gallery books are already public. Paths
-- are namespaced by user id and carry a random component, so they aren't
-- enumerable. Writes are service-role only (the generate-image endpoint).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-illustrations',
  'book-illustrations',
  true,
  10485760, -- 10 MB; generated art is ~1 MB, a drawing far less
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Anyone may read (the PDF worker has no user session).
drop policy if exists "Illustrations are publicly readable" on storage.objects;
create policy "Illustrations are publicly readable"
  on storage.objects for select
  using (bucket_id = 'book-illustrations');

-- Signed-in users may write only under their own user-id prefix, so one
-- account cannot overwrite another's artwork. (The service role used by
-- api/generate-image.js bypasses RLS; this covers any direct client
-- upload, such as a drawing made in the app.)
drop policy if exists "Users write their own illustrations" on storage.objects;
create policy "Users write their own illustrations"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'book-illustrations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update their own illustrations" on storage.objects;
create policy "Users update their own illustrations"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'book-illustrations'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
