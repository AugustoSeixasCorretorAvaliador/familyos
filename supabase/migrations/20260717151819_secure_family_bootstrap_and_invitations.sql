begin;

-- Um mesmo usuario nao pode criar duas familias ativas por concorrencia ou
-- clique repetido. Familias homonimas de usuarios distintos continuam validas.
create unique index if not exists families_one_active_per_creator
  on public.families(created_by)
  where created_by is not null
    and deleted_at is null
    and status = 'active';

create unique index if not exists family_invitations_one_pending_email
  on public.family_invitations(family_id, lower(email))
  where accepted_at is null and revoked_at is null;

create or replace function public.bootstrap_family(
  p_family_name text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  actor_email text;
  existing_family_id uuid;
  created_family_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  -- Serializa tentativas concorrentes do mesmo usuario.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(actor_id::text, 0)
  );

  select fm.family_id
    into existing_family_id
  from public.family_members fm
  where fm.user_id = actor_id
    and fm.status = 'active'
  order by fm.created_at
  limit 1;

  if existing_family_id is not null then
    return existing_family_id;
  end if;

  select lower(u.email)
    into actor_email
  from auth.users u
  where u.id = actor_id
    and u.email_confirmed_at is not null;

  if actor_email is null then
    raise exception using errcode = '42501', message = 'confirmed_email_required';
  end if;

  if exists (
    select 1
    from public.family_invitations fi
    where lower(fi.email) = actor_email
      and fi.accepted_at is null
      and fi.revoked_at is null
      and fi.expires_at > now()
  ) then
    raise exception using errcode = 'P0001', message = 'pending_invitation';
  end if;

  if exists (
    select 1
    from public.people p
    where lower(p.email) = actor_email
      and p.deleted_at is null
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'existing_person_requires_invitation';
  end if;

  if nullif(pg_catalog.btrim(p_family_name), '') is null then
    raise exception using errcode = '22023', message = 'family_name_required';
  end if;

  insert into public.families (
    name,
    description,
    status,
    created_by,
    updated_by
  )
  values (
    pg_catalog.btrim(p_family_name),
    nullif(pg_catalog.btrim(p_description), ''),
    'active',
    actor_id,
    actor_id
  )
  returning id into created_family_id;

  insert into public.family_members (
    family_id,
    user_id,
    role,
    status,
    joined_at
  )
  values (
    created_family_id,
    actor_id,
    'owner',
    'active',
    now()
  );

  insert into public.events (
    family_id,
    event_type,
    source,
    affected_entity_type,
    affected_entity_id,
    priority,
    automation_status,
    occurred_at,
    created_by
  )
  values (
    created_family_id,
    'family_created',
    'bootstrap_family',
    'families',
    created_family_id,
    'medium',
    'partially_automated',
    now(),
    actor_id
  );

  return created_family_id;
exception
  when unique_violation then
    select f.id
      into existing_family_id
    from public.families f
    where f.created_by = actor_id
      and f.deleted_at is null
      and f.status = 'active'
    order by f.created_at
    limit 1;

    if existing_family_id is not null then
      return existing_family_id;
    end if;
    raise;
end
$function$;

revoke all on function public.bootstrap_family(text, text) from public;
revoke all on function public.bootstrap_family(text, text) from anon;
grant execute on function public.bootstrap_family(text, text) to authenticated;

create or replace function public.create_family_invitation(
  p_family_id uuid,
  p_email text,
  p_role public.family_role default 'member',
  p_expires_in interval default interval '7 days'
)
returns table (
  invitation_id uuid,
  invitation_token text,
  invitation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  normalized_email text := lower(pg_catalog.btrim(p_email));
  raw_token text;
  created_id uuid;
  created_expires_at timestamptz;
begin
  if actor_id is null
    or not private.can_admin_family(p_family_id)
  then
    raise exception using errcode = '42501', message = 'family_admin_required';
  end if;

  if normalized_email = '' or normalized_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception using errcode = '22023', message = 'valid_email_required';
  end if;

  if p_role = 'owner' then
    raise exception using errcode = '22023', message = 'owner_invitation_not_allowed';
  end if;

  if p_expires_in <= interval '0 seconds'
    or p_expires_in > interval '30 days'
  then
    raise exception using errcode = '22023', message = 'invalid_invitation_expiration';
  end if;

  if (
    select count(*)
    from public.people p
    where p.family_id = p_family_id
      and lower(p.email) = normalized_email
      and p.deleted_at is null
  ) <> 1 then
    raise exception using errcode = 'P0001', message = 'unique_person_required';
  end if;

  update public.family_invitations fi
  set revoked_at = now()
  where fi.family_id = p_family_id
    and lower(fi.email) = normalized_email
    and fi.accepted_at is null
    and fi.revoked_at is null;

  raw_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
  created_expires_at := now() + p_expires_in;

  insert into public.family_invitations (
    family_id,
    email,
    role,
    token_hash,
    invited_by,
    expires_at
  )
  values (
    p_family_id,
    normalized_email,
    coalesce(p_role, 'member'),
    pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(raw_token, 'UTF8'), 'sha256'),
      'hex'
    ),
    actor_id,
    created_expires_at
  )
  returning id into created_id;

  insert into public.events (
    family_id,
    event_type,
    source,
    affected_entity_type,
    affected_entity_id,
    priority,
    automation_status,
    occurred_at,
    created_by
  )
  values (
    p_family_id,
    'family_invitation_created',
    'create_family_invitation',
    'family_invitations',
    created_id,
    'medium',
    'partially_automated',
    now(),
    actor_id
  );

  return query select created_id, raw_token, created_expires_at;
end
$function$;

revoke all on function public.create_family_invitation(uuid, text, public.family_role, interval) from public;
revoke all on function public.create_family_invitation(uuid, text, public.family_role, interval) from anon;
grant execute on function public.create_family_invitation(uuid, text, public.family_role, interval)
  to authenticated;

create or replace function public.get_pending_family_invitation()
returns table (
  invitation_id uuid,
  family_id uuid,
  family_name text,
  invitation_role public.family_role,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    fi.id,
    fi.family_id,
    f.name::text,
    fi.role,
    fi.expires_at
  from auth.users u
  join public.family_invitations fi
    on lower(fi.email) = lower(u.email)
  join public.families f
    on f.id = fi.family_id
  where u.id = (select auth.uid())
    and u.email_confirmed_at is not null
    and fi.accepted_at is null
    and fi.revoked_at is null
    and fi.expires_at > now()
  order by fi.created_at desc
  limit 1;
$function$;

revoke all on function public.get_pending_family_invitation() from public;
revoke all on function public.get_pending_family_invitation() from anon;
grant execute on function public.get_pending_family_invitation() to authenticated;

create or replace function public.get_family_onboarding_state()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  actor_email text;
begin
  if actor_id is null then
    return 'authentication_required';
  end if;

  if exists (
    select 1
    from public.family_members fm
    where fm.user_id = actor_id
      and fm.status = 'active'
  ) then
    return 'linked';
  end if;

  select lower(u.email)
    into actor_email
  from auth.users u
  where u.id = actor_id
    and u.email_confirmed_at is not null;

  if actor_email is null then
    return 'confirmed_email_required';
  end if;

  if exists (
    select 1
    from public.family_invitations fi
    where lower(fi.email) = actor_email
      and fi.accepted_at is null
      and fi.revoked_at is null
      and fi.expires_at > now()
  ) then
    return 'pending_invitation';
  end if;

  if exists (
    select 1
    from public.people p
    where lower(p.email) = actor_email
      and p.deleted_at is null
  ) then
    return 'existing_person_requires_invitation';
  end if;

  return 'eligible_to_create';
end
$function$;

revoke all on function public.get_family_onboarding_state() from public;
revoke all on function public.get_family_onboarding_state() from anon;
grant execute on function public.get_family_onboarding_state() to authenticated;

create or replace function public.accept_family_invitation(
  p_token text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_id uuid := (select auth.uid());
  actor_email text;
  invitation public.family_invitations%rowtype;
  matched_person_id uuid;
  person_count integer;
  created_membership_id uuid;
begin
  if actor_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  select lower(u.email)
    into actor_email
  from auth.users u
  where u.id = actor_id
    and u.email_confirmed_at is not null;

  if actor_email is null then
    raise exception using errcode = '42501', message = 'confirmed_email_required';
  end if;

  select fi.*
    into invitation
  from public.family_invitations fi
  where fi.token_hash = pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(p_token, 'UTF8'), 'sha256'),
      'hex'
    )
  for update;

  if invitation.id is null
    or invitation.accepted_at is not null
    or invitation.revoked_at is not null
    or invitation.expires_at <= now()
  then
    raise exception using errcode = 'P0001', message = 'invalid_or_expired_invitation';
  end if;

  if lower(invitation.email) <> actor_email then
    raise exception using errcode = '42501', message = 'invitation_email_mismatch';
  end if;

  select count(*), (array_agg(p.id order by p.id))[1]
    into person_count, matched_person_id
  from public.people p
  where p.family_id = invitation.family_id
    and lower(p.email) = actor_email
    and p.deleted_at is null;

  if person_count <> 1 then
    raise exception using errcode = 'P0001', message = 'unique_person_required';
  end if;

  if exists (
    select 1
    from public.family_members fm
    where fm.family_id = invitation.family_id
      and fm.person_id = matched_person_id
      and fm.user_id <> actor_id
  ) then
    raise exception using errcode = '23505', message = 'person_already_linked';
  end if;

  insert into public.family_members (
    family_id,
    user_id,
    person_id,
    role,
    status,
    invited_by,
    joined_at
  )
  values (
    invitation.family_id,
    actor_id,
    matched_person_id,
    invitation.role,
    'active',
    invitation.invited_by,
    now()
  )
  on conflict (family_id, user_id) do update
  set person_id = excluded.person_id,
      role = excluded.role,
      status = 'active',
      invited_by = excluded.invited_by,
      joined_at = coalesce(public.family_members.joined_at, now()),
      updated_at = now()
  returning id into created_membership_id;

  update public.family_invitations fi
  set accepted_at = now()
  where fi.id = invitation.id
    and fi.accepted_at is null
    and fi.revoked_at is null
    and fi.expires_at > now();

  if not found then
    raise exception using errcode = 'P0001', message = 'invitation_already_consumed';
  end if;

  insert into public.events (
    family_id,
    event_type,
    source,
    affected_entity_type,
    affected_entity_id,
    related_person_id,
    priority,
    automation_status,
    occurred_at,
    created_by
  )
  values (
    invitation.family_id,
    'family_invitation_accepted',
    'accept_family_invitation',
    'family_members',
    created_membership_id,
    matched_person_id,
    'medium',
    'partially_automated',
    now(),
    actor_id
  );

  return invitation.family_id;
end
$function$;

revoke all on function public.accept_family_invitation(text) from public;
revoke all on function public.accept_family_invitation(text) from anon;
grant execute on function public.accept_family_invitation(text) to authenticated;

-- Ferramenta administrativa generica para regularizar membros legados.
create or replace function private.regularize_family_member(
  p_family_id uuid,
  p_email text,
  p_role public.family_role default 'member'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_email text := lower(pg_catalog.btrim(p_email));
  target_user_id uuid;
  target_person_id uuid;
  auth_count integer;
  person_count integer;
  membership_id uuid;
begin
  if not exists (select 1 from public.families f where f.id = p_family_id) then
    raise exception using errcode = 'P0001', message = 'family_not_found';
  end if;

  select count(*), (array_agg(u.id order by u.id))[1]
    into auth_count, target_user_id
  from auth.users u
  where lower(u.email) = normalized_email
    and u.email_confirmed_at is not null;

  select count(*), (array_agg(p.id order by p.id))[1]
    into person_count, target_person_id
  from public.people p
  where p.family_id = p_family_id
    and lower(p.email) = normalized_email
    and p.deleted_at is null;

  if auth_count <> 1 or person_count <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'unique_auth_user_and_person_required',
      detail = pg_catalog.format('auth_users=%s people=%s', auth_count, person_count);
  end if;

  if exists (
    select 1
    from public.family_members fm
    where fm.family_id = p_family_id
      and fm.person_id = target_person_id
      and fm.user_id <> target_user_id
  ) then
    raise exception using errcode = '23505', message = 'person_already_linked';
  end if;

  insert into public.family_members (
    family_id,
    user_id,
    person_id,
    role,
    status,
    joined_at
  )
  values (
    p_family_id,
    target_user_id,
    target_person_id,
    coalesce(p_role, 'member'),
    'active',
    now()
  )
  on conflict (family_id, user_id) do update
  set person_id = excluded.person_id,
      role = excluded.role,
      status = 'active',
      joined_at = coalesce(public.family_members.joined_at, now()),
      updated_at = now()
  returning id into membership_id;

  insert into public.events (
    family_id,
    event_type,
    source,
    affected_entity_type,
    affected_entity_id,
    related_person_id,
    priority,
    automation_status,
    occurred_at
  )
  values (
    p_family_id,
    'family_member_regularized',
    'private.regularize_family_member',
    'family_members',
    membership_id,
    target_person_id,
    'medium',
    'manual_required',
    now()
  );

  return membership_id;
end
$function$;

revoke all on function private.regularize_family_member(uuid, text, public.family_role)
  from public, anon, authenticated, service_role;

commit;
