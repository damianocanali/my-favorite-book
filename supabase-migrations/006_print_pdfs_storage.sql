-- supabase-migrations/006_print_pdfs_storage.sql

-- Create the bucket (private — signed URLs only).
insert into storage.buckets (id, name, public)
values ('print-pdfs', 'print-pdfs', false)
on conflict (id) do nothing;

-- Service role can do anything; clients cannot list, read, or write.
-- We sign URLs server-side and only Lulu fetches them.
drop policy if exists "Service role full access print-pdfs" on storage.objects;
create policy "Service role full access print-pdfs"
  on storage.objects for all
  using (bucket_id = 'print-pdfs' and auth.role() = 'service_role');
