-- FamilyOS dashboard data diagnosis (admin)
-- Run in Supabase SQL Editor as postgres role.

begin;

-- 1) Confirm project-side schema objects expected by dashboard/modules
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'families','family_members','people',
    'properties','property_owners',
    'documents','accounts',
    'doctors','medications','health_exams',
    'tasks','family_tasks','legal_cases',
    'events','timeline_events',
    'document_metadata','document_versions','document_ocr_jobs'
  )
order by table_name;

-- 2) Family Seixas id and active memberships
with family_target as (
  select id, name
  from public.families
  where lower(name) = lower('Familia Seixas')
    and deleted_at is null
  limit 1
)
select
  ft.id as family_id,
  ft.name,
  fm.user_id,
  fm.role,
  fm.status
from family_target ft
left join public.family_members fm on fm.family_id = ft.id
order by fm.created_at;

-- 3) Real counts by family
with family_target as (
  select id
  from public.families
  where lower(name) = lower('Familia Seixas')
    and deleted_at is null
  limit 1
)
select 'families' as metric, (select count(*)::bigint from public.families f where f.deleted_at is null) as total
union all
select 'family_members', (select count(*)::bigint from public.family_members fm join family_target ft on ft.id = fm.family_id)
union all
select 'people', (select count(*)::bigint from public.people p join family_target ft on ft.id = p.family_id where p.deleted_at is null)
union all
select 'properties', (select count(*)::bigint from public.properties p join family_target ft on ft.id = p.family_id where p.deleted_at is null)
union all
select 'documents', (select count(*)::bigint from public.documents d join family_target ft on ft.id = d.family_id where d.deleted_at is null)
union all
select 'accounts', (select count(*)::bigint from public.accounts a join family_target ft on ft.id = a.family_id where a.deleted_at is null)
union all
select 'doctors', (select count(*)::bigint from public.doctors d join family_target ft on ft.id = d.family_id)
union all
select 'medications', (select count(*)::bigint from public.medications m join family_target ft on ft.id = m.family_id)
union all
select 'health_exams', (select count(*)::bigint from public.health_exams h join family_target ft on ft.id = h.family_id)
union all
select 'family_tasks', (select count(*)::bigint from public.family_tasks t join family_target ft on ft.id = t.family_id)
union all
select 'tasks_legacy', (select count(*)::bigint from public.tasks t join family_target ft on ft.id = t.family_id)
union all
select 'legal_cases', (select count(*)::bigint from public.legal_cases l join family_target ft on ft.id = l.family_id)
union all
select 'events', (select count(*)::bigint from public.events e join family_target ft on ft.id = e.family_id)
union all
select 'document_metadata', (select count(*)::bigint from public.document_metadata dm join family_target ft on ft.id = dm.family_id)
union all
select 'document_versions', (select count(*)::bigint from public.document_versions dv join family_target ft on ft.id = dv.family_id)
union all
select 'document_ocr_jobs', (select count(*)::bigint from public.document_ocr_jobs dj join family_target ft on ft.id = dj.family_id)
order by metric;

-- 4) family_id consistency checks per module
with family_target as (
  select id
  from public.families
  where lower(name) = lower('Familia Seixas')
    and deleted_at is null
  limit 1
)
select 'accounts' as table_name,
       (select count(*) from public.accounts a join family_target ft on ft.id = a.family_id where a.deleted_at is null) as family_matches,
       (select count(*) from public.accounts a where a.deleted_at is null) as total_rows
union all
select 'doctors',
       (select count(*) from public.doctors d join family_target ft on ft.id = d.family_id),
       (select count(*) from public.doctors)
union all
select 'medications',
       (select count(*) from public.medications m join family_target ft on ft.id = m.family_id),
       (select count(*) from public.medications)
union all
select 'health_exams',
       (select count(*) from public.health_exams h join family_target ft on ft.id = h.family_id),
       (select count(*) from public.health_exams)
union all
select 'properties',
       (select count(*) from public.properties p join family_target ft on ft.id = p.family_id where p.deleted_at is null),
       (select count(*) from public.properties p where p.deleted_at is null)
union all
select 'documents',
       (select count(*) from public.documents d join family_target ft on ft.id = d.family_id where d.deleted_at is null),
       (select count(*) from public.documents d where d.deleted_at is null)
union all
select 'family_tasks',
       (select count(*) from public.family_tasks t join family_target ft on ft.id = t.family_id),
       (select count(*) from public.family_tasks)
union all
select 'events',
       (select count(*) from public.events e join family_target ft on ft.id = e.family_id),
       (select count(*) from public.events);

-- 5) Last events / tasks for dashboard sanity
with family_target as (
  select id
  from public.families
  where lower(name) = lower('Familia Seixas')
    and deleted_at is null
  limit 1
)
select event_type, affected_entity_type, occurred_at
from public.events e
join family_target ft on ft.id = e.family_id
order by occurred_at desc
limit 10;

with family_target as (
  select id
  from public.families
  where lower(name) = lower('Familia Seixas')
    and deleted_at is null
  limit 1
)
select title, status, due_date
from public.family_tasks t
join family_target ft on ft.id = t.family_id
order by due_date asc nulls last
limit 10;

commit;
