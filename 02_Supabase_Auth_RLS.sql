-- FamilyOS — Supabase Auth & RLS Migration v0.1
-- Target: Supabase / PostgreSQL
-- Run after 01_PostgreSQL_Schema.sql using postgres role.

begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$ begin
  create type public.family_role as enum ('owner','admin','member','viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.membership_status as enum ('invited','active','suspended','revoked');
exception when duplicate_object then null; end $$;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name varchar(200),
  avatar_url text,
  phone varchar(50),
  locale varchar(20) not null default 'pt-BR',
  timezone varchar(80) not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (user_id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.user_profiles (user_id, display_name, avatar_url)
select u.id,
       coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
       u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
on conflict (user_id) do nothing;

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  role public.family_role not null default 'member',
  status public.membership_status not null default 'active',
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_members_family_user_unique unique (family_id, user_id),
  constraint family_members_family_person_unique unique (family_id, person_id)
);

create table if not exists public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  email text not null,
  role public.family_role not null default 'member',
  token_hash text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_family_members_user_id on public.family_members(user_id);
create index if not exists idx_family_members_family_status on public.family_members(family_id, status);
create index if not exists idx_family_invitations_family_email on public.family_invitations(family_id, lower(email));

alter table public.families
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'people','documents','properties','suppliers','accounts','recurrences','expenses','payments',
    'trips','travel_readiness','alerts','tasks','events','entity_relationships'
  ]
  loop
    execute format(
      'alter table public.%I add column if not exists created_by uuid references auth.users(id) on delete set null, add column if not exists updated_by uuid references auth.users(id) on delete set null',
      table_name
    );
  end loop;
end $$;

create or replace function public.set_auth_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then new.created_by := auth.uid(); end if;
    if new.updated_by is null then new.updated_by := auth.uid(); end if;
  elsif tg_op = 'UPDATE' then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'families','people','documents','properties','suppliers','accounts','recurrences','expenses','payments',
    'trips','travel_readiness','alerts','tasks','events','entity_relationships'
  ]
  loop
    execute format('drop trigger if exists trg_%I_auth_audit on public.%I', table_name, table_name);
    execute format('create trigger trg_%I_auth_audit before insert or update on public.%I for each row execute function public.set_auth_audit_fields()', table_name, table_name);
  end loop;
end $$;

create or replace function private.is_family_member(requested_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.family_members fm
    where fm.family_id = requested_family_id
      and fm.user_id = (select auth.uid())
      and fm.status = 'active'
  );
$$;

create or replace function private.has_family_role(requested_family_id uuid, allowed_roles public.family_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.family_members fm
    where fm.family_id = requested_family_id
      and fm.user_id = (select auth.uid())
      and fm.status = 'active'
      and fm.role = any(allowed_roles)
  );
$$;

create or replace function private.can_edit_family(requested_family_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_family_role(requested_family_id, array['owner','admin','member']::public.family_role[]); $$;

create or replace function private.can_admin_family(requested_family_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_family_role(requested_family_id, array['owner','admin']::public.family_role[]); $$;

create or replace function private.is_family_owner(requested_family_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.has_family_role(requested_family_id, array['owner']::public.family_role[]); $$;

create or replace function private.safe_uuid(value text)
returns uuid
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  return value::uuid;
exception when invalid_text_representation then return null;
end;
$$;

revoke all on all functions in schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.is_family_member(uuid) to authenticated;
grant execute on function private.has_family_role(uuid, public.family_role[]) to authenticated;
grant execute on function private.can_edit_family(uuid) to authenticated;
grant execute on function private.can_admin_family(uuid) to authenticated;
grant execute on function private.is_family_owner(uuid) to authenticated;
grant execute on function private.safe_uuid(text) to authenticated;

create or replace function public.add_family_creator_as_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is null then raise exception 'families.created_by is required'; end if;
  insert into public.family_members (family_id,user_id,role,status,joined_at)
  values (new.id,new.created_by,'owner','active',now())
  on conflict (family_id,user_id) do update
    set role='owner', status='active', joined_at=coalesce(public.family_members.joined_at,now());
  return new;
end;
$$;

drop trigger if exists trg_families_add_owner on public.families;
create trigger trg_families_add_owner
after insert on public.families
for each row execute function public.add_family_creator_as_owner();

alter table public.user_profiles enable row level security;
alter table public.family_members enable row level security;
alter table public.family_invitations enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'families','people','documents','properties','property_owners','suppliers','accounts','recurrences','expenses','payments',
    'trips','trip_participants','travel_readiness','alerts','tasks','events','entity_relationships'
  ]
  loop execute format('alter table public.%I enable row level security', table_name); end loop;
end $$;

-- Profiles

drop policy if exists profiles_select_own on public.user_profiles;
create policy profiles_select_own on public.user_profiles for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists profiles_update_own on public.user_profiles;
create policy profiles_update_own on public.user_profiles for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

-- Families

drop policy if exists families_select_member on public.families;
create policy families_select_member on public.families for select to authenticated using (private.is_family_member(id));
drop policy if exists families_insert_authenticated on public.families;
create policy families_insert_authenticated on public.families for insert to authenticated with check (created_by=(select auth.uid()));
drop policy if exists families_update_admin on public.families;
create policy families_update_admin on public.families for update to authenticated using (private.can_admin_family(id)) with check (private.can_admin_family(id));
drop policy if exists families_delete_owner on public.families;
create policy families_delete_owner on public.families for delete to authenticated using (private.is_family_owner(id));

-- Memberships and invitations

drop policy if exists family_members_select_member on public.family_members;
create policy family_members_select_member on public.family_members for select to authenticated using (user_id=(select auth.uid()) or private.is_family_member(family_id));
drop policy if exists family_members_insert_admin on public.family_members;
create policy family_members_insert_admin on public.family_members for insert to authenticated with check (private.can_admin_family(family_id));
drop policy if exists family_members_update_admin on public.family_members;
create policy family_members_update_admin on public.family_members for update to authenticated using (private.can_admin_family(family_id)) with check (private.can_admin_family(family_id));
drop policy if exists family_members_delete_owner on public.family_members;
create policy family_members_delete_owner on public.family_members for delete to authenticated using (private.is_family_owner(family_id));

drop policy if exists family_invitations_select_admin on public.family_invitations;
create policy family_invitations_select_admin on public.family_invitations for select to authenticated using (private.can_admin_family(family_id));
drop policy if exists family_invitations_insert_admin on public.family_invitations;
create policy family_invitations_insert_admin on public.family_invitations for insert to authenticated with check (private.can_admin_family(family_id) and invited_by=(select auth.uid()));
drop policy if exists family_invitations_update_admin on public.family_invitations;
create policy family_invitations_update_admin on public.family_invitations for update to authenticated using (private.can_admin_family(family_id)) with check (private.can_admin_family(family_id));
drop policy if exists family_invitations_delete_owner on public.family_invitations;
create policy family_invitations_delete_owner on public.family_invitations for delete to authenticated using (private.is_family_owner(family_id));

-- Generic family-scoped tables

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'people','documents','properties','suppliers','accounts','recurrences','expenses','payments','trips','alerts','tasks','events','entity_relationships'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name||'_select_family_member', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_family_member(family_id))', table_name||'_select_family_member', table_name);
    execute format('drop policy if exists %I on public.%I', table_name||'_insert_family_editor', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_edit_family(family_id))', table_name||'_insert_family_editor', table_name);
    execute format('drop policy if exists %I on public.%I', table_name||'_update_family_editor', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_edit_family(family_id)) with check (private.can_edit_family(family_id))', table_name||'_update_family_editor', table_name);
    execute format('drop policy if exists %I on public.%I', table_name||'_delete_family_admin', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (private.can_admin_family(family_id))', table_name||'_delete_family_admin', table_name);
  end loop;
end $$;

-- Junction policies

drop policy if exists property_owners_select_family_member on public.property_owners;
create policy property_owners_select_family_member on public.property_owners for select to authenticated using (exists (select 1 from public.properties p where p.id=property_id and private.is_family_member(p.family_id)));
drop policy if exists property_owners_insert_family_editor on public.property_owners;
create policy property_owners_insert_family_editor on public.property_owners for insert to authenticated with check (exists (select 1 from public.properties p where p.id=property_id and private.can_edit_family(p.family_id)));
drop policy if exists property_owners_update_family_editor on public.property_owners;
create policy property_owners_update_family_editor on public.property_owners for update to authenticated using (exists (select 1 from public.properties p where p.id=property_id and private.can_edit_family(p.family_id))) with check (exists (select 1 from public.properties p where p.id=property_id and private.can_edit_family(p.family_id)));
drop policy if exists property_owners_delete_family_admin on public.property_owners;
create policy property_owners_delete_family_admin on public.property_owners for delete to authenticated using (exists (select 1 from public.properties p where p.id=property_id and private.can_admin_family(p.family_id)));

drop policy if exists trip_participants_select_family_member on public.trip_participants;
create policy trip_participants_select_family_member on public.trip_participants for select to authenticated using (exists (select 1 from public.trips t where t.id=trip_id and private.is_family_member(t.family_id)));
drop policy if exists trip_participants_insert_family_editor on public.trip_participants;
create policy trip_participants_insert_family_editor on public.trip_participants for insert to authenticated with check (exists (select 1 from public.trips t where t.id=trip_id and private.can_edit_family(t.family_id)));
drop policy if exists trip_participants_update_family_editor on public.trip_participants;
create policy trip_participants_update_family_editor on public.trip_participants for update to authenticated using (exists (select 1 from public.trips t where t.id=trip_id and private.can_edit_family(t.family_id))) with check (exists (select 1 from public.trips t where t.id=trip_id and private.can_edit_family(t.family_id)));
drop policy if exists trip_participants_delete_family_admin on public.trip_participants;
create policy trip_participants_delete_family_admin on public.trip_participants for delete to authenticated using (exists (select 1 from public.trips t where t.id=trip_id and private.can_admin_family(t.family_id)));

drop policy if exists travel_readiness_select_family_member on public.travel_readiness;
create policy travel_readiness_select_family_member on public.travel_readiness for select to authenticated using (exists (select 1 from public.trips t where t.id=trip_id and private.is_family_member(t.family_id)));
drop policy if exists travel_readiness_insert_family_editor on public.travel_readiness;
create policy travel_readiness_insert_family_editor on public.travel_readiness for insert to authenticated with check (exists (select 1 from public.trips t where t.id=trip_id and private.can_edit_family(t.family_id)));
drop policy if exists travel_readiness_update_family_editor on public.travel_readiness;
create policy travel_readiness_update_family_editor on public.travel_readiness for update to authenticated using (exists (select 1 from public.trips t where t.id=trip_id and private.can_edit_family(t.family_id))) with check (exists (select 1 from public.trips t where t.id=trip_id and private.can_edit_family(t.family_id)));
drop policy if exists travel_readiness_delete_family_admin on public.travel_readiness;
create policy travel_readiness_delete_family_admin on public.travel_readiness for delete to authenticated using (exists (select 1 from public.trips t where t.id=trip_id and private.can_admin_family(t.family_id)));

-- FamilyVault Storage bucket
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('family-vault','family-vault',false,52428800,array['application/pdf','image/jpeg','image/png','image/webp','text/plain'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Object path: <family_uuid>/<document_uuid>/<filename>
drop policy if exists family_vault_select_member on storage.objects;
create policy family_vault_select_member on storage.objects for select to authenticated using (bucket_id='family-vault' and private.is_family_member(private.safe_uuid((storage.foldername(name))[1])));
drop policy if exists family_vault_insert_editor on storage.objects;
create policy family_vault_insert_editor on storage.objects for insert to authenticated with check (bucket_id='family-vault' and private.can_edit_family(private.safe_uuid((storage.foldername(name))[1])));
drop policy if exists family_vault_update_editor on storage.objects;
create policy family_vault_update_editor on storage.objects for update to authenticated using (bucket_id='family-vault' and private.can_edit_family(private.safe_uuid((storage.foldername(name))[1]))) with check (bucket_id='family-vault' and private.can_edit_family(private.safe_uuid((storage.foldername(name))[1])));
drop policy if exists family_vault_delete_admin on storage.objects;
create policy family_vault_delete_admin on storage.objects for delete to authenticated using (bucket_id='family-vault' and private.can_admin_family(private.safe_uuid((storage.foldername(name))[1])));

grant usage on schema public to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant usage,select on all sequences in schema public to authenticated;

commit;
