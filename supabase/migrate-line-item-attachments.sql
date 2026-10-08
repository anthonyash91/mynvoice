-- Run in Supabase SQL Editor to enable receipt/file attachments on invoice line items.
--
-- Files live in a private Storage bucket under <user_id>/<attachment_id>/<file name>.
-- Attachment metadata is stored on each line item inside invoices.line_items (no table change).
-- Safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit)
values ('invoice-attachments', 'invoice-attachments', false, 10485760)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

drop policy if exists "Users can view own invoice attachments" on storage.objects;
drop policy if exists "Users can upload own invoice attachments" on storage.objects;
drop policy if exists "Users can update own invoice attachments" on storage.objects;
drop policy if exists "Users can delete own invoice attachments" on storage.objects;

create policy "Users can view own invoice attachments"
on storage.objects for select
to authenticated
using (
  bucket_id = 'invoice-attachments'
  and (storage.foldername (name))[1] = auth.uid ()::text
);

create policy "Users can upload own invoice attachments"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'invoice-attachments'
  and (storage.foldername (name))[1] = auth.uid ()::text
);

create policy "Users can update own invoice attachments"
on storage.objects for update
to authenticated
using (
  bucket_id = 'invoice-attachments'
  and (storage.foldername (name))[1] = auth.uid ()::text
)
with check (
  bucket_id = 'invoice-attachments'
  and (storage.foldername (name))[1] = auth.uid ()::text
);

create policy "Users can delete own invoice attachments"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'invoice-attachments'
  and (storage.foldername (name))[1] = auth.uid ()::text
);
