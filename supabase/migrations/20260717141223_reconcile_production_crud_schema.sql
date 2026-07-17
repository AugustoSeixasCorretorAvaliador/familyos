begin;

-- Financas: o codigo atual persiste dados operacionais adicionais neste JSON.
alter table public.accounts
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Saude.
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
  status varchar(40) not null default 'Em uso'
    check (status in ('Em uso', 'Suspenso', 'Encerrado')),
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
  status varchar(40) not null default 'A programar'
    check (status in ('A programar', 'Agendado', 'Realizado', 'Resultado recebido', 'Atrasado')),
  file_path text,
  file_name varchar(255),
  mime_type varchar(120),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tarefas e processos. A tabela tasks preexistente e legada permanece intacta.
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
  status varchar(40) not null default 'Ativo'
    check (status in ('Ativo', 'Aguardando', 'Suspenso', 'Concluido', 'Arquivado')),
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
  priority varchar(40) not null default 'Media'
    check (priority in ('Baixa', 'Media', 'Alta', 'Urgente')),
  status varchar(60) not null default 'A fazer'
    check (status in ('A fazer', 'Em andamento', 'Aguardando terceiro', 'Concluida', 'Cancelada')),
  due_date date,
  related_person_id uuid references public.people(id) on delete set null,
  related_property_id uuid references public.properties(id) on delete set null,
  related_document_id uuid references public.documents(id) on delete set null,
  related_legal_case_id uuid references public.legal_cases(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Documentos inteligentes.
alter table public.documents
  add column if not exists processing_status varchar(40) not null default 'Enviado'
    check (processing_status in (
      'Enviado',
      'OCR em processamento',
      'Aguardando conferencia',
      'Confirmado',
      'Rejeitado',
      'Erro OCR'
    )),
  add column if not exists ocr_provider varchar(80),
  add column if not exists ai_provider varchar(80),
  add column if not exists ocr_confidence numeric(5,2),
  add column if not exists review_required boolean not null default true,
  add column if not exists last_ocr_at timestamptz,
  add column if not exists last_ocr_error text;

create table if not exists public.document_ocr_jobs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  provider varchar(80) not null,
  status varchar(40) not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  confidence numeric(5,2),
  duration_ms integer,
  extracted_text text,
  suggestion_json jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_metadata (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  extracted_text text,
  interpreted_fields jsonb not null default '{}'::jsonb,
  confidence_by_field jsonb not null default '{}'::jsonb,
  overall_confidence numeric(5,2),
  needs_review boolean not null default true,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_metadata_document_unique unique (document_id)
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  version integer not null check (version > 0),
  storage_path text not null,
  file_name varchar(255),
  mime_type varchar(120),
  file_hash_sha256 varchar(128) not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_versions_unique unique (document_id, version)
);

-- Integridade multi-tenant: uma referencia nunca pode cruzar family_id.
create unique index if not exists people_id_family_unique
  on public.people(id, family_id);
create unique index if not exists properties_id_family_unique
  on public.properties(id, family_id);
create unique index if not exists documents_id_family_unique
  on public.documents(id, family_id);
create unique index if not exists doctors_id_family_unique
  on public.doctors(id, family_id);
create unique index if not exists legal_cases_id_family_unique
  on public.legal_cases(id, family_id);

alter table public.accounts drop constraint if exists accounts_owner_family_fkey;
alter table public.accounts
  add constraint accounts_owner_family_fkey
  foreign key (owner_person_id, family_id)
  references public.people(id, family_id);

alter table public.documents drop constraint if exists documents_owner_family_fkey;
alter table public.documents
  add constraint documents_owner_family_fkey
  foreign key (owner_person_id, family_id)
  references public.people(id, family_id);

alter table public.doctors drop constraint if exists doctors_patient_family_fkey;
alter table public.doctors
  add constraint doctors_patient_family_fkey
  foreign key (patient_person_id, family_id)
  references public.people(id, family_id);

alter table public.medications drop constraint if exists medications_person_family_fkey;
alter table public.medications
  add constraint medications_person_family_fkey
  foreign key (person_id, family_id)
  references public.people(id, family_id);

alter table public.medications drop constraint if exists medications_doctor_family_fkey;
alter table public.medications
  add constraint medications_doctor_family_fkey
  foreign key (doctor_id, family_id)
  references public.doctors(id, family_id);

alter table public.health_exams drop constraint if exists health_exams_person_family_fkey;
alter table public.health_exams
  add constraint health_exams_person_family_fkey
  foreign key (person_id, family_id)
  references public.people(id, family_id);

alter table public.legal_cases drop constraint if exists legal_cases_person_family_fkey;
alter table public.legal_cases
  add constraint legal_cases_person_family_fkey
  foreign key (person_id, family_id)
  references public.people(id, family_id);

alter table public.family_tasks drop constraint if exists family_tasks_responsible_family_fkey;
alter table public.family_tasks
  add constraint family_tasks_responsible_family_fkey
  foreign key (responsible_person_id, family_id)
  references public.people(id, family_id);

alter table public.family_tasks drop constraint if exists family_tasks_related_person_family_fkey;
alter table public.family_tasks
  add constraint family_tasks_related_person_family_fkey
  foreign key (related_person_id, family_id)
  references public.people(id, family_id);

alter table public.family_tasks drop constraint if exists family_tasks_related_property_family_fkey;
alter table public.family_tasks
  add constraint family_tasks_related_property_family_fkey
  foreign key (related_property_id, family_id)
  references public.properties(id, family_id);

alter table public.family_tasks drop constraint if exists family_tasks_related_document_family_fkey;
alter table public.family_tasks
  add constraint family_tasks_related_document_family_fkey
  foreign key (related_document_id, family_id)
  references public.documents(id, family_id);

alter table public.family_tasks drop constraint if exists family_tasks_related_legal_case_family_fkey;
alter table public.family_tasks
  add constraint family_tasks_related_legal_case_family_fkey
  foreign key (related_legal_case_id, family_id)
  references public.legal_cases(id, family_id);

alter table public.document_ocr_jobs drop constraint if exists document_ocr_jobs_document_family_fkey;
alter table public.document_ocr_jobs
  add constraint document_ocr_jobs_document_family_fkey
  foreign key (document_id, family_id)
  references public.documents(id, family_id)
  on delete cascade;

alter table public.document_metadata drop constraint if exists document_metadata_document_family_fkey;
alter table public.document_metadata
  add constraint document_metadata_document_family_fkey
  foreign key (document_id, family_id)
  references public.documents(id, family_id)
  on delete cascade;

alter table public.document_versions drop constraint if exists document_versions_document_family_fkey;
alter table public.document_versions
  add constraint document_versions_document_family_fkey
  foreign key (document_id, family_id)
  references public.documents(id, family_id)
  on delete cascade;

create index if not exists idx_doctors_family_id on public.doctors(family_id);
create index if not exists idx_doctors_family_patient on public.doctors(family_id, patient_person_id);
create index if not exists idx_medications_family_id on public.medications(family_id);
create index if not exists idx_medications_family_person on public.medications(family_id, person_id);
create index if not exists idx_medications_doctor_id on public.medications(doctor_id);
create index if not exists idx_health_exams_family_due on public.health_exams(family_id, due_date);
create index if not exists idx_health_exams_family_person on public.health_exams(family_id, person_id);
create index if not exists idx_legal_cases_family_status on public.legal_cases(family_id, status);
create index if not exists idx_legal_cases_family_person on public.legal_cases(family_id, person_id);
create index if not exists idx_family_tasks_family_due on public.family_tasks(family_id, due_date);
create index if not exists idx_family_tasks_status on public.family_tasks(family_id, status);
create index if not exists idx_family_tasks_responsible on public.family_tasks(family_id, responsible_person_id);
create index if not exists idx_family_tasks_related_property on public.family_tasks(related_property_id);
create index if not exists idx_family_tasks_related_document on public.family_tasks(related_document_id);
create index if not exists idx_family_tasks_related_legal_case on public.family_tasks(related_legal_case_id);
create index if not exists idx_document_ocr_jobs_family_document
  on public.document_ocr_jobs(family_id, document_id, created_at desc);
create index if not exists idx_document_ocr_jobs_status
  on public.document_ocr_jobs(family_id, status);
create index if not exists idx_document_metadata_family_document
  on public.document_metadata(family_id, document_id);
create index if not exists idx_document_versions_family_document
  on public.document_versions(family_id, document_id, version desc);
create index if not exists idx_documents_processing_status
  on public.documents(family_id, processing_status);

alter table public.doctors enable row level security;
alter table public.medications enable row level security;
alter table public.health_exams enable row level security;
alter table public.legal_cases enable row level security;
alter table public.family_tasks enable row level security;
alter table public.document_ocr_jobs enable row level security;
alter table public.document_metadata enable row level security;
alter table public.document_versions enable row level security;

-- Policies de tabelas familiares: leitura para membros, escrita para editores,
-- exclusao somente para administradores.
do $policies$
declare
  table_name text;
begin
  foreach table_name in array array[
    'doctors',
    'medications',
    'health_exams',
    'legal_cases',
    'family_tasks',
    'document_ocr_jobs',
    'document_metadata',
    'document_versions'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_family_member', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using (private.is_family_member(family_id))',
      table_name || '_select_family_member',
      table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_family_editor', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (private.can_edit_family(family_id))',
      table_name || '_insert_family_editor',
      table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_update_family_editor', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using (private.can_edit_family(family_id)) with check (private.can_edit_family(family_id))',
      table_name || '_update_family_editor',
      table_name
    );
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_family_admin', table_name);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (private.can_admin_family(family_id))',
      table_name || '_delete_family_admin',
      table_name
    );
  end loop;
end
$policies$;

-- Triggers de updated_at, usando a funcao ja existente no schema base.
drop trigger if exists trg_doctors_updated_at on public.doctors;
create trigger trg_doctors_updated_at before update on public.doctors
for each row execute function public.set_updated_at();

drop trigger if exists trg_medications_updated_at on public.medications;
create trigger trg_medications_updated_at before update on public.medications
for each row execute function public.set_updated_at();

drop trigger if exists trg_health_exams_updated_at on public.health_exams;
create trigger trg_health_exams_updated_at before update on public.health_exams
for each row execute function public.set_updated_at();

drop trigger if exists trg_legal_cases_updated_at on public.legal_cases;
create trigger trg_legal_cases_updated_at before update on public.legal_cases
for each row execute function public.set_updated_at();

drop trigger if exists trg_family_tasks_updated_at on public.family_tasks;
create trigger trg_family_tasks_updated_at before update on public.family_tasks
for each row execute function public.set_updated_at();

drop trigger if exists trg_document_ocr_jobs_updated_at on public.document_ocr_jobs;
create trigger trg_document_ocr_jobs_updated_at before update on public.document_ocr_jobs
for each row execute function public.set_updated_at();

drop trigger if exists trg_document_metadata_updated_at on public.document_metadata;
create trigger trg_document_metadata_updated_at before update on public.document_metadata
for each row execute function public.set_updated_at();

drop trigger if exists trg_document_versions_updated_at on public.document_versions;
create trigger trg_document_versions_updated_at before update on public.document_versions
for each row execute function public.set_updated_at();

-- Data API: grants deliberados e RLS obrigatoria.
revoke all on table
  public.accounts,
  public.documents,
  public.doctors,
  public.medications,
  public.health_exams,
  public.legal_cases,
  public.family_tasks,
  public.document_ocr_jobs,
  public.document_metadata,
  public.document_versions
from anon;

grant select, insert, update, delete on table
  public.accounts,
  public.documents,
  public.doctors,
  public.medications,
  public.health_exams,
  public.legal_cases,
  public.family_tasks,
  public.document_ocr_jobs,
  public.document_metadata,
  public.document_versions
to authenticated;

grant all on table
  public.doctors,
  public.medications,
  public.health_exams,
  public.legal_cases,
  public.family_tasks,
  public.document_ocr_jobs,
  public.document_metadata,
  public.document_versions
to service_role;

-- Buckets privados.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'family-documents',
    'family-documents',
    false,
    20971520,
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/tiff',
      'image/tif'
    ]
  ),
  (
    'family-health',
    'family-health',
    false,
    20971520,
    array['application/pdf']
  )
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists family_documents_select_member on storage.objects;
create policy family_documents_select_member
on storage.objects for select to authenticated
using (
  bucket_id = 'family-documents'
  and private.is_family_member(private.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists family_documents_insert_editor on storage.objects;
create policy family_documents_insert_editor
on storage.objects for insert to authenticated
with check (
  bucket_id = 'family-documents'
  and private.can_edit_family(private.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists family_documents_update_editor on storage.objects;
create policy family_documents_update_editor
on storage.objects for update to authenticated
using (
  bucket_id = 'family-documents'
  and private.can_edit_family(private.safe_uuid((storage.foldername(name))[1]))
)
with check (
  bucket_id = 'family-documents'
  and private.can_edit_family(private.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists family_documents_delete_admin on storage.objects;
create policy family_documents_delete_admin
on storage.objects for delete to authenticated
using (
  bucket_id = 'family-documents'
  and private.can_admin_family(private.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists family_health_select_member on storage.objects;
create policy family_health_select_member
on storage.objects for select to authenticated
using (
  bucket_id = 'family-health'
  and private.is_family_member(private.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists family_health_insert_editor on storage.objects;
create policy family_health_insert_editor
on storage.objects for insert to authenticated
with check (
  bucket_id = 'family-health'
  and private.can_edit_family(private.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists family_health_update_editor on storage.objects;
create policy family_health_update_editor
on storage.objects for update to authenticated
using (
  bucket_id = 'family-health'
  and private.can_edit_family(private.safe_uuid((storage.foldername(name))[1]))
)
with check (
  bucket_id = 'family-health'
  and private.can_edit_family(private.safe_uuid((storage.foldername(name))[1]))
);

drop policy if exists family_health_delete_admin on storage.objects;
create policy family_health_delete_admin
on storage.objects for delete to authenticated
using (
  bucket_id = 'family-health'
  and private.can_admin_family(private.safe_uuid((storage.foldername(name))[1]))
);

commit;
