-- Stage 2 - private bucket for family documents
-- Run in Supabase SQL Editor as postgres role.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-documents',
  'family-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists family_documents_select_member on storage.objects;
create policy family_documents_select_member
on storage.objects for select to authenticated
using (
  bucket_id = 'family-documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id::text = (storage.foldername(name))[1]
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists family_documents_insert_editor on storage.objects;
create policy family_documents_insert_editor
on storage.objects for insert to authenticated
with check (
  bucket_id = 'family-documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id::text = (storage.foldername(name))[1]
      and fm.user_id = auth.uid()
      and fm.status = 'active'
      and fm.role in ('owner', 'admin', 'member')
  )
);

drop policy if exists family_documents_update_editor on storage.objects;
create policy family_documents_update_editor
on storage.objects for update to authenticated
using (
  bucket_id = 'family-documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id::text = (storage.foldername(name))[1]
      and fm.user_id = auth.uid()
      and fm.status = 'active'
      and fm.role in ('owner', 'admin', 'member')
  )
)
with check (
  bucket_id = 'family-documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id::text = (storage.foldername(name))[1]
      and fm.user_id = auth.uid()
      and fm.status = 'active'
      and fm.role in ('owner', 'admin', 'member')
  )
);

drop policy if exists family_documents_delete_admin on storage.objects;
create policy family_documents_delete_admin
on storage.objects for delete to authenticated
using (
  bucket_id = 'family-documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1
    from public.family_members fm
    where fm.family_id::text = (storage.foldername(name))[1]
      and fm.user_id = auth.uid()
      and fm.status = 'active'
      and fm.role in ('owner', 'admin')
  )
);

commit;
