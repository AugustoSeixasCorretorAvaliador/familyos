-- Stage 3 - Financas e Saude
-- Run in Supabase SQL Editor as postgres role.

begin;

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  patient_person_id uuid references public.people(id) on delete set null,
  doctor_name varchar(200) not null,
  specialty varchar(120),
  clinic varchar(200),
  phone varchar(50),
  email varchar(200),
  address text,
  notes text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  doctor_id uuid references public.doctors(id) on delete set null,
  medication_name varchar(200) not null,
  dosage varchar(80),
  frequency varchar(120),
  schedule varchar(120),
  start_date date,
  end_date date,
  status varchar(40) not null default 'Em uso' check (status in ('Em uso','Suspenso','Encerrado')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_exams (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  exam_name varchar(200) not null,
  category varchar(120),
  periodicity varchar(80),
  due_date date,
  performed_date date,
  next_date date,
  status varchar(40) not null default 'A programar' check (status in ('A programar','Agendado','Realizado','Resultado recebido','Atrasado')),
  file_path text,
  file_name varchar(255),
  mime_type varchar(120),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_doctors_family_id on public.doctors(family_id);
create index if not exists idx_medications_family_id on public.medications(family_id);
create index if not exists idx_health_exams_family_id on public.health_exams(family_id);
create index if not exists idx_health_exams_due_date on public.health_exams(family_id, due_date);

alter table public.doctors enable row level security;
alter table public.medications enable row level security;
alter table public.health_exams enable row level security;

drop policy if exists doctors_select_family_member on public.doctors;
create policy doctors_select_family_member on public.doctors
for select to authenticated using (private.is_family_member(family_id));
drop policy if exists doctors_insert_family_editor on public.doctors;
create policy doctors_insert_family_editor on public.doctors
for insert to authenticated with check (private.can_edit_family(family_id));
drop policy if exists doctors_update_family_editor on public.doctors;
create policy doctors_update_family_editor on public.doctors
for update to authenticated using (private.can_edit_family(family_id)) with check (private.can_edit_family(family_id));
drop policy if exists doctors_delete_family_admin on public.doctors;
create policy doctors_delete_family_admin on public.doctors
for delete to authenticated using (private.can_admin_family(family_id));

drop policy if exists medications_select_family_member on public.medications;
create policy medications_select_family_member on public.medications
for select to authenticated using (private.is_family_member(family_id));
drop policy if exists medications_insert_family_editor on public.medications;
create policy medications_insert_family_editor on public.medications
for insert to authenticated with check (private.can_edit_family(family_id));
drop policy if exists medications_update_family_editor on public.medications;
create policy medications_update_family_editor on public.medications
for update to authenticated using (private.can_edit_family(family_id)) with check (private.can_edit_family(family_id));
drop policy if exists medications_delete_family_admin on public.medications;
create policy medications_delete_family_admin on public.medications
for delete to authenticated using (private.can_admin_family(family_id));

drop policy if exists health_exams_select_family_member on public.health_exams;
create policy health_exams_select_family_member on public.health_exams
for select to authenticated using (private.is_family_member(family_id));
drop policy if exists health_exams_insert_family_editor on public.health_exams;
create policy health_exams_insert_family_editor on public.health_exams
for insert to authenticated with check (private.can_edit_family(family_id));
drop policy if exists health_exams_update_family_editor on public.health_exams;
create policy health_exams_update_family_editor on public.health_exams
for update to authenticated using (private.can_edit_family(family_id)) with check (private.can_edit_family(family_id));
drop policy if exists health_exams_delete_family_admin on public.health_exams;
create policy health_exams_delete_family_admin on public.health_exams
for delete to authenticated using (private.can_admin_family(family_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-health',
  'family-health',
  false,
  52428800,
  array['application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists family_health_select_member on storage.objects;
create policy family_health_select_member on storage.objects
for select to authenticated using (
  bucket_id = 'family-health'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.family_members fm
    where fm.family_id::text = (storage.foldername(name))[1]
      and fm.user_id = auth.uid()
      and fm.status = 'active'
  )
);

drop policy if exists family_health_insert_editor on storage.objects;
create policy family_health_insert_editor on storage.objects
for insert to authenticated with check (
  bucket_id = 'family-health'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.family_members fm
    where fm.family_id::text = (storage.foldername(name))[1]
      and fm.user_id = auth.uid()
      and fm.status = 'active'
      and fm.role in ('owner','admin','member')
  )
);

drop policy if exists family_health_update_editor on storage.objects;
create policy family_health_update_editor on storage.objects
for update to authenticated using (
  bucket_id = 'family-health'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.family_members fm
    where fm.family_id::text = (storage.foldername(name))[1]
      and fm.user_id = auth.uid()
      and fm.status = 'active'
      and fm.role in ('owner','admin','member')
  )
) with check (
  bucket_id = 'family-health'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.family_members fm
    where fm.family_id::text = (storage.foldername(name))[1]
      and fm.user_id = auth.uid()
      and fm.status = 'active'
      and fm.role in ('owner','admin','member')
  )
);

drop policy if exists family_health_delete_admin on storage.objects;
create policy family_health_delete_admin on storage.objects
for delete to authenticated using (
  bucket_id = 'family-health'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.family_members fm
    where fm.family_id::text = (storage.foldername(name))[1]
      and fm.user_id = auth.uid()
      and fm.status = 'active'
      and fm.role in ('owner','admin')
  )
);

drop trigger if exists trg_doctors_updated_at on public.doctors;
create trigger trg_doctors_updated_at before update on public.doctors
for each row execute function public.set_updated_at();

drop trigger if exists trg_medications_updated_at on public.medications;
create trigger trg_medications_updated_at before update on public.medications
for each row execute function public.set_updated_at();

drop trigger if exists trg_health_exams_updated_at on public.health_exams;
create trigger trg_health_exams_updated_at before update on public.health_exams
for each row execute function public.set_updated_at();

commit;
