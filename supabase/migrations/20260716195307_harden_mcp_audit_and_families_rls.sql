-- BASELINE LOCAL: reproduz a migration ja registrada no historico compartilhado
-- do projeto Supabase. A fonte operacional permanece em mcp-server/supabase/migrations/.
-- Nenhuma operacao nova foi adicionada a este baseline.

-- Harden FamilyOS family access and MCP audit-log privileges.

begin;

do $$
begin
  if to_regprocedure('private.can_admin_family(uuid)') is null then
    raise exception 'Required function private.can_admin_family(uuid) does not exist';
  end if;

  if to_regprocedure('private.is_family_member(uuid)') is null then
    raise exception 'Required function private.is_family_member(uuid) does not exist';
  end if;

  if to_regprocedure('private.is_family_owner(uuid)') is null then
    raise exception 'Required function private.is_family_owner(uuid) does not exist';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'family_members'
      and column_name = 'family_id'
      and data_type = 'uuid'
  ) then
    raise exception 'Required column public.family_members.family_id uuid does not exist';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'family_members'
      and column_name = 'user_id'
      and data_type = 'uuid'
  ) then
    raise exception 'Required column public.family_members.user_id uuid does not exist';
  end if;
end
$$;

alter table public.families enable row level security;

revoke all privileges on table public.families from anon, authenticated;
grant select, insert, update, delete
  on table public.families
  to authenticated;

drop policy if exists families_select_member on public.families;
create policy families_select_member on public.families
for select to authenticated
using (private.is_family_member(id));

drop policy if exists families_insert_authenticated on public.families;
create policy families_insert_authenticated on public.families
for insert to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists families_update_admin on public.families;
create policy families_update_admin on public.families
for update to authenticated
using (private.can_admin_family(id))
with check (private.can_admin_family(id));

drop policy if exists families_delete_owner on public.families;
create policy families_delete_owner on public.families
for delete to authenticated
using (private.is_family_owner(id));

revoke all privileges
  on table public.mcp_audit_logs
  from anon, authenticated;

grant select
  on table public.mcp_audit_logs
  to authenticated;

create index if not exists idx_mcp_audit_logs_user_created
  on public.mcp_audit_logs(user_id, created_at desc);

commit;
