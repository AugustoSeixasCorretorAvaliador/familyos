-- SeixasOS MVP 0.1 - Stage 1 seed (idempotent)
-- Run in Supabase SQL Editor with postgres role.
-- Configure one of the values below:
-- 1) target_user_email
-- 2) target_user_id

begin;

with seed_input as (
  select
    null::uuid as target_user_id,
    'SEU_EMAIL_AQUI@exemplo.com'::text as target_user_email
),
target_user as (
  select coalesce(si.target_user_id, au.id) as user_id
  from seed_input si
  left join auth.users au on lower(au.email) = lower(si.target_user_email)
  where coalesce(si.target_user_id, au.id) is not null
  limit 1
),
upsert_family as (
  insert into public.families (name, description, status, created_by)
  select
    'Familia Seixas',
    'Nucleo inicial do SeixasOS MVP 0.1',
    'active'::public.record_status,
    tu.user_id
  from target_user tu
  where not exists (
    select 1 from public.families f where lower(f.name) = lower('Familia Seixas') and f.deleted_at is null
  )
  returning id
),
selected_family as (
  select id from upsert_family
  union all
  select f.id
  from public.families f
  where lower(f.name) = lower('Familia Seixas') and f.deleted_at is null
  limit 1
)
insert into public.family_members (family_id, user_id, role, status, joined_at)
select sf.id, tu.user_id, 'admin'::public.family_role, 'active'::public.membership_status, now()
from selected_family sf
cross join target_user tu
on conflict (family_id, user_id) do update
set role = excluded.role,
    status = excluded.status,
    joined_at = coalesce(public.family_members.joined_at, excluded.joined_at),
    updated_at = now();

with selected_family as (
  select f.id
  from public.families f
  where lower(f.name) = lower('Familia Seixas') and f.deleted_at is null
  limit 1
)
insert into public.people (
  family_id,
  first_name,
  last_name,
  birth_date,
  nationality,
  email,
  phone,
  family_role,
  status
)
select
  sf.id,
  p.first_name,
  p.last_name,
  p.birth_date,
  p.nationality,
  p.email,
  p.phone,
  p.family_role,
  'active'::public.record_status
from selected_family sf
cross join (
  values
    ('Augusto', 'Seixas', null::date, 'Brasileira', null::text, null::text, 'Administrador'),
    ('Maria', 'Jose', null::date, 'Brasileira', null::text, null::text, 'Familiar'),
    ('Rodrigo Alves', 'Seixas', null::date, 'Brasileira', null::text, null::text, 'Familiar'),
    ('Marcella Andrade Ribeiro', 'Seixas', null::date, 'Brasileira', null::text, null::text, 'Familiar')
) as p(first_name, last_name, birth_date, nationality, email, phone, family_role)
where not exists (
  select 1
  from public.people pe
  where pe.family_id = sf.id
    and pe.first_name = p.first_name
    and pe.last_name = p.last_name
    and pe.deleted_at is null
);

with seed_input as (
  select
    null::uuid as target_user_id,
    'SEU_EMAIL_AQUI@exemplo.com'::text as target_user_email
),
target_user as (
  select coalesce(si.target_user_id, au.id) as user_id
  from seed_input si
  left join auth.users au on lower(au.email) = lower(si.target_user_email)
  where coalesce(si.target_user_id, au.id) is not null
  limit 1
),
selected_family as (
  select f.id
  from public.families f
  where lower(f.name) = lower('Familia Seixas') and f.deleted_at is null
  limit 1
),
augusto as (
  select p.id
  from public.people p
  join selected_family sf on sf.id = p.family_id
  where p.first_name = 'Augusto' and p.last_name = 'Seixas' and p.deleted_at is null
  limit 1
)
update public.family_members fm
set person_id = a.id,
    role = 'admin'::public.family_role,
    status = 'active'::public.membership_status,
    updated_at = now()
from target_user tu, selected_family sf, augusto a
where fm.family_id = sf.id
  and fm.user_id = tu.user_id;

commit;
