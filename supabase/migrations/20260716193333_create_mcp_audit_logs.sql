-- BASELINE LOCAL: reproduz a migration ja registrada no historico compartilhado
-- do projeto Supabase. A fonte operacional permanece em mcp-server/supabase/migrations/.
-- Nenhuma operacao nova foi adicionada a este baseline.

-- FamilyOS MCP audit logs.
-- Run in Supabase SQL Editor as an admin/postgres role.

begin;

create table if not exists public.mcp_audit_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references public.families(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  request_id text not null,
  session_id text,
  tool_name text not null,
  operation text not null,
  input_summary jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  status text not null check (status in ('started', 'success', 'denied', 'failed')),
  error_code text,
  error_message text,
  duration_ms integer,
  client_name text,
  client_version text,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_mcp_audit_logs_family_created
  on public.mcp_audit_logs(family_id, created_at desc);

create index if not exists idx_mcp_audit_logs_request
  on public.mcp_audit_logs(request_id);

create index if not exists idx_mcp_audit_logs_tool_status
  on public.mcp_audit_logs(family_id, tool_name, status, created_at desc);

alter table public.mcp_audit_logs enable row level security;

drop policy if exists mcp_audit_logs_select_family_admin on public.mcp_audit_logs;
create policy mcp_audit_logs_select_family_admin on public.mcp_audit_logs
for select to authenticated
using (family_id is not null and private.can_admin_family(family_id));

drop policy if exists mcp_audit_logs_no_client_insert on public.mcp_audit_logs;
create policy mcp_audit_logs_no_client_insert on public.mcp_audit_logs
for insert to authenticated
with check (false);

drop policy if exists mcp_audit_logs_no_client_update on public.mcp_audit_logs;
create policy mcp_audit_logs_no_client_update on public.mcp_audit_logs
for update to authenticated
using (false)
with check (false);

drop policy if exists mcp_audit_logs_no_client_delete on public.mcp_audit_logs;
create policy mcp_audit_logs_no_client_delete on public.mcp_audit_logs
for delete to authenticated
using (false);

grant select on public.mcp_audit_logs to authenticated;

commit;
