-- Stage 4 - Tarefas, Processos e Timeline operacional
-- Run in Supabase SQL Editor as postgres role.

begin;

create table if not exists public.legal_cases (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  case_number varchar(120),
  title varchar(200) not null,
  case_type varchar(120),
  person_id uuid references public.people(id) on delete set null,
  court varchar(200),
  start_date date,
  lawyer varchar(200),
  claim_value numeric(14,2),
  expected_value numeric(14,2),
  last_update text,
  last_update_date date,
  status varchar(40) not null default 'Ativo' check (status in ('Ativo','Aguardando','Suspenso','Concluido','Arquivado')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title varchar(200) not null,
  description text,
  responsible_person_id uuid references public.people(id) on delete set null,
  category varchar(120),
  priority varchar(40) not null default 'Media' check (priority in ('Baixa','Media','Alta','Urgente')),
  status varchar(60) not null default 'A fazer' check (status in ('A fazer','Em andamento','Aguardando terceiro','Concluida','Cancelada')),
  due_date date,
  related_person_id uuid references public.people(id) on delete set null,
  related_property_id uuid references public.properties(id) on delete set null,
  related_document_id uuid references public.documents(id) on delete set null,
  related_legal_case_id uuid references public.legal_cases(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_family_tasks_family_due on public.family_tasks(family_id, due_date);
create index if not exists idx_family_tasks_status on public.family_tasks(family_id, status);
create index if not exists idx_legal_cases_family_status on public.legal_cases(family_id, status);

alter table public.family_tasks enable row level security;
alter table public.legal_cases enable row level security;

drop policy if exists family_tasks_select_family_member on public.family_tasks;
create policy family_tasks_select_family_member on public.family_tasks
for select to authenticated using (private.is_family_member(family_id));

drop policy if exists family_tasks_insert_family_editor on public.family_tasks;
create policy family_tasks_insert_family_editor on public.family_tasks
for insert to authenticated with check (private.can_edit_family(family_id));

drop policy if exists family_tasks_update_family_editor on public.family_tasks;
create policy family_tasks_update_family_editor on public.family_tasks
for update to authenticated using (private.can_edit_family(family_id)) with check (private.can_edit_family(family_id));

drop policy if exists family_tasks_delete_family_admin on public.family_tasks;
create policy family_tasks_delete_family_admin on public.family_tasks
for delete to authenticated using (private.can_admin_family(family_id));

drop policy if exists legal_cases_select_family_member on public.legal_cases;
create policy legal_cases_select_family_member on public.legal_cases
for select to authenticated using (private.is_family_member(family_id));

drop policy if exists legal_cases_insert_family_editor on public.legal_cases;
create policy legal_cases_insert_family_editor on public.legal_cases
for insert to authenticated with check (private.can_edit_family(family_id));

drop policy if exists legal_cases_update_family_editor on public.legal_cases;
create policy legal_cases_update_family_editor on public.legal_cases
for update to authenticated using (private.can_edit_family(family_id)) with check (private.can_edit_family(family_id));

drop policy if exists legal_cases_delete_family_admin on public.legal_cases;
create policy legal_cases_delete_family_admin on public.legal_cases
for delete to authenticated using (private.can_admin_family(family_id));

drop trigger if exists trg_family_tasks_updated_at on public.family_tasks;
create trigger trg_family_tasks_updated_at
before update on public.family_tasks
for each row execute function public.set_updated_at();

drop trigger if exists trg_legal_cases_updated_at on public.legal_cases;
create trigger trg_legal_cases_updated_at
before update on public.legal_cases
for each row execute function public.set_updated_at();

commit;
