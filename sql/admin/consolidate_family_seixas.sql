-- Family Seixas duplicate consolidation.
--
-- SAFETY GATES
-- 1. Run sql/diagnostics/20260717_production_crud_schema_audit.sql.
-- 2. Export a logical backup with pg_dump and record its checksum externally.
-- 3. Confirm the source family has no operational records or Storage objects.
-- 4. Keep dry_run=true for the first execution. No mutation is committed then.
--
-- This script never hard-deletes rows. It deactivates the duplicate membership,
-- soft-deletes its duplicate person and soft-archives the duplicate family.

do $consolidate$
declare
  source_family_id constant uuid := 'fa08d059-6a92-4229-95a9-c7cfbcc6a1e4';
  target_family_id constant uuid := '3cf2f9ef-5ada-4572-806f-b4d5a5610d25';
  dry_run constant boolean := true; -- change to false only after backup and review
  item record;
  source_count bigint;
  storage_count bigint;
  source_memberships bigint;
  source_people bigint;
begin
  if source_family_id = target_family_id then
    raise exception 'source_and_target_must_differ';
  end if;

  if not exists (select 1 from public.families where id = source_family_id) then
    raise notice 'Source family already archived or absent; nothing to do.';
    return;
  end if;

  if not exists (select 1 from public.families where id = target_family_id and deleted_at is null) then
    raise exception 'active_target_family_not_found';
  end if;

  -- Refuse consolidation when any operational family-scoped table has data.
  for item in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'family_id'
      and c.table_name not in ('family_members', 'people', 'events')
    group by c.table_name
    order by c.table_name
  loop
    execute format(
      'select count(*) from public.%I where family_id = $1',
      item.table_name
    )
    into source_count
    using source_family_id;

    if source_count > 0 then
      raise exception using
        errcode = 'P0001',
        message = 'source_family_has_operational_data',
        detail = format('table=%s rows=%s', item.table_name, source_count);
    end if;
  end loop;

  select count(*) into storage_count
  from storage.objects
  where (storage.foldername(name))[1] = source_family_id::text;

  if storage_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'source_family_has_storage_objects',
      detail = format('objects=%s', storage_count);
  end if;

  select count(*) into source_memberships
  from public.family_members
  where family_id = source_family_id;

  select count(*) into source_people
  from public.people
  where family_id = source_family_id
    and deleted_at is null;

  if source_memberships > 1 or source_people > 1 then
    raise exception using
      errcode = 'P0001',
      message = 'source_family_identity_inventory_changed',
      detail = format('memberships=%s people=%s', source_memberships, source_people);
  end if;

  raise notice 'Preflight passed: memberships=%, people=%, storage=%',
    source_memberships, source_people, storage_count;

  if dry_run then
    raise notice 'DRY RUN: no rows changed. Set dry_run=false only after backup and review.';
    return;
  end if;

  update public.family_members
  set status = 'revoked',
      updated_at = now()
  where family_id = source_family_id
    and status <> 'revoked';

  update public.people
  set deleted_at = coalesce(deleted_at, now()),
      updated_at = now()
  where family_id = source_family_id
    and deleted_at is null;

  update public.families
  set deleted_at = coalesce(deleted_at, now()),
      updated_at = now()
  where id = source_family_id
    and deleted_at is null;

  insert into public.events (
    family_id,
    event_type,
    source,
    affected_entity_type,
    affected_entity_id,
    priority,
    automation_status,
    previous_state,
    new_state,
    occurred_at
  )
  values (
    target_family_id,
    'duplicate_family_archived',
    'sql.admin.consolidate_family_seixas',
    'families',
    source_family_id,
    'high',
    'manual_required',
    jsonb_build_object(
      'source_family_id', source_family_id,
      'memberships', source_memberships,
      'people', source_people,
      'storage_objects', storage_count
    ),
    jsonb_build_object(
      'target_family_id', target_family_id,
      'source_archived', true
    ),
    now()
  );

  if exists (
    select 1
    from public.families
    where id = source_family_id
      and deleted_at is null
  ) then
    raise exception 'source_family_archive_postcondition_failed';
  end if;
end
$consolidate$;
