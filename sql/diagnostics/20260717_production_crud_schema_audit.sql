-- FamilyOS production CRUD/schema audit
-- READ ONLY: this file contains no DDL or data mutation.

-- 1. Migration history registered by Supabase.
select version, name, statements
from supabase_migrations.schema_migrations
order by version;

-- 2. Tables and columns used by the affected modules.
select
  c.table_schema,
  c.table_name,
  c.ordinal_position,
  c.column_name,
  c.data_type,
  c.udt_schema,
  c.udt_name,
  c.is_nullable,
  c.column_default
from information_schema.columns c
where c.table_schema in ('public', 'storage')
  and c.table_name in (
    'families',
    'family_members',
    'family_invitations',
    'people',
    'properties',
    'property_owners',
    'documents',
    'document_ocr_jobs',
    'document_metadata',
    'document_versions',
    'accounts',
    'doctors',
    'medications',
    'health_exams',
    'family_tasks',
    'tasks',
    'legal_cases',
    'events',
    'timeline_events',
    'relationships',
    'objects',
    'buckets'
  )
order by c.table_schema, c.table_name, c.ordinal_position;

-- 3. Enum values and their exact order.
select
  n.nspname as enum_schema,
  t.typname as enum_name,
  e.enumsortorder,
  e.enumlabel
from pg_type t
join pg_namespace n on n.oid = t.typnamespace
join pg_enum e on e.enumtypid = t.oid
where n.nspname = 'public'
order by n.nspname, t.typname, e.enumsortorder;

-- 4. RLS state and policies.
select
  n.nspname as table_schema,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind in ('r', 'p')
  and n.nspname in ('public', 'storage')
order by n.nspname, c.relname;

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- 5. Explicit Data API privileges.
select
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
from information_schema.role_table_grants
where table_schema in ('public', 'storage')
  and grantee in ('anon', 'authenticated', 'service_role')
order by table_schema, table_name, grantee, privilege_type;

-- 6. Foreign keys, including cross-family integrity.
select
  con.conname,
  src_ns.nspname as source_schema,
  src.relname as source_table,
  pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class src on src.oid = con.conrelid
join pg_namespace src_ns on src_ns.oid = src.relnamespace
where con.contype = 'f'
  and src_ns.nspname = 'public'
order by src.relname, con.conname;

-- 7. Counts for every public table that has family_id.
-- query_to_xml executes only the generated SELECT and keeps this audit read-only.
select
  tables.table_name,
  query_to_xml(
    format(
      'select family_id, count(*) as row_count
       from public.%I
       where family_id in (
         %L::uuid,
         %L::uuid
       )
       group by family_id
       order by family_id',
      tables.table_name,
      '3cf2f9ef-5ada-4572-806f-b4d5a5610d25',
      'fa08d059-6a92-4229-95a9-c7cfbcc6a1e4'
    ),
    false,
    true,
    ''
  ) as counts_by_family_xml
from (
  select c.table_name
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.column_name = 'family_id'
  group by c.table_name
) tables
order by tables.table_name;

-- 8. Membership/person identity inventory without exposing tokens.
select
  f.id as family_id,
  f.name as family_name,
  f.status as family_status,
  f.created_at as family_created_at,
  fm.id as membership_id,
  fm.user_id,
  fm.person_id,
  fm.role,
  fm.status as membership_status,
  lower(p.email) as normalized_person_email,
  p.first_name,
  p.last_name
from public.families f
left join public.family_members fm on fm.family_id = f.id
left join public.people p on p.id = fm.person_id
where f.id in (
  '3cf2f9ef-5ada-4572-806f-b4d5a5610d25'::uuid,
  'fa08d059-6a92-4229-95a9-c7cfbcc6a1e4'::uuid
)
order by f.id, fm.created_at, fm.id;

-- 9. Storage inventory by family prefix.
select
  o.bucket_id,
  (storage.foldername(o.name))[1] as family_prefix,
  count(*) as object_count,
  sum(coalesce((o.metadata ->> 'size')::bigint, 0)) as total_bytes
from storage.objects o
where (storage.foldername(o.name))[1] in (
  '3cf2f9ef-5ada-4572-806f-b4d5a5610d25',
  'fa08d059-6a92-4229-95a9-c7cfbcc6a1e4'
)
group by o.bucket_id, (storage.foldername(o.name))[1]
order by o.bucket_id, family_prefix;

-- 10. Duplicate names, emails and active memberships.
select lower(name) as normalized_name, count(*) as family_count, array_agg(id order by created_at) as family_ids
from public.families
where deleted_at is null
group by lower(name)
having count(*) > 1;

select lower(email) as normalized_email, count(*) as person_count, array_agg(id order by family_id, id) as person_ids
from public.people
where email is not null and deleted_at is null
group by lower(email)
having count(*) > 1;

select user_id, count(*) as active_membership_count, array_agg(family_id order by family_id) as family_ids
from public.family_members
where status = 'active'
group by user_id
having count(*) > 1;
