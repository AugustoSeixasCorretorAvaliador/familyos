-- Stage 5 - Intelligent document processing (OCR + AI interpreter)
-- Run in Supabase SQL Editor as postgres role.

begin;

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

alter table public.document_ocr_jobs enable row level security;
alter table public.document_metadata enable row level security;
alter table public.document_versions enable row level security;

drop policy if exists document_ocr_jobs_select_family_member on public.document_ocr_jobs;
create policy document_ocr_jobs_select_family_member on public.document_ocr_jobs
for select to authenticated using (private.is_family_member(family_id));

drop policy if exists document_ocr_jobs_insert_family_editor on public.document_ocr_jobs;
create policy document_ocr_jobs_insert_family_editor on public.document_ocr_jobs
for insert to authenticated with check (private.can_edit_family(family_id));

drop policy if exists document_ocr_jobs_update_family_editor on public.document_ocr_jobs;
create policy document_ocr_jobs_update_family_editor on public.document_ocr_jobs
for update to authenticated using (private.can_edit_family(family_id)) with check (private.can_edit_family(family_id));

drop policy if exists document_ocr_jobs_delete_family_admin on public.document_ocr_jobs;
create policy document_ocr_jobs_delete_family_admin on public.document_ocr_jobs
for delete to authenticated using (private.can_admin_family(family_id));

drop policy if exists document_metadata_select_family_member on public.document_metadata;
create policy document_metadata_select_family_member on public.document_metadata
for select to authenticated using (private.is_family_member(family_id));

drop policy if exists document_metadata_insert_family_editor on public.document_metadata;
create policy document_metadata_insert_family_editor on public.document_metadata
for insert to authenticated with check (private.can_edit_family(family_id));

drop policy if exists document_metadata_update_family_editor on public.document_metadata;
create policy document_metadata_update_family_editor on public.document_metadata
for update to authenticated using (private.can_edit_family(family_id)) with check (private.can_edit_family(family_id));

drop policy if exists document_metadata_delete_family_admin on public.document_metadata;
create policy document_metadata_delete_family_admin on public.document_metadata
for delete to authenticated using (private.can_admin_family(family_id));

drop policy if exists document_versions_select_family_member on public.document_versions;
create policy document_versions_select_family_member on public.document_versions
for select to authenticated using (private.is_family_member(family_id));

drop policy if exists document_versions_insert_family_editor on public.document_versions;
create policy document_versions_insert_family_editor on public.document_versions
for insert to authenticated with check (private.can_edit_family(family_id));

drop policy if exists document_versions_update_family_editor on public.document_versions;
create policy document_versions_update_family_editor on public.document_versions
for update to authenticated using (private.can_edit_family(family_id)) with check (private.can_edit_family(family_id));

drop policy if exists document_versions_delete_family_admin on public.document_versions;
create policy document_versions_delete_family_admin on public.document_versions
for delete to authenticated using (private.can_admin_family(family_id));

drop trigger if exists trg_document_ocr_jobs_updated_at on public.document_ocr_jobs;
create trigger trg_document_ocr_jobs_updated_at
before update on public.document_ocr_jobs
for each row execute function public.set_updated_at();

drop trigger if exists trg_document_metadata_updated_at on public.document_metadata;
create trigger trg_document_metadata_updated_at
before update on public.document_metadata
for each row execute function public.set_updated_at();

drop trigger if exists trg_document_versions_updated_at on public.document_versions;
create trigger trg_document_versions_updated_at
before update on public.document_versions
for each row execute function public.set_updated_at();

update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/tiff',
      'image/tif'
    ]
where id = 'family-documents';

commit;
