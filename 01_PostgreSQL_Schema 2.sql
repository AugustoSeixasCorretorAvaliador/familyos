-- FamilyOS — PostgreSQL Schema v0.1
-- Target: PostgreSQL / Supabase
-- Generated from:
--   - Vision & Product Definition v0.1
--   - Knowledge Model v0.1
--   - Event Model v0.1
--   - Data Dictionary v0.3
--   - Knowledge Graph Schema v0.1
--
-- Scope: MVP
--   Families, people, documents, properties, expenses, payments,
--   suppliers, accounts, trips, travel readiness, alerts, tasks and events.

begin;

create extension if not exists pgcrypto;

-- ============================================================
-- Helper function
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- ENUMS
-- ============================================================

do $$ begin
  create type public.record_status as enum (
    'active',
    'inactive',
    'pending',
    'expired',
    'archived',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.operational_status as enum (
    'planned',
    'issued',
    'pending',
    'paid',
    'received',
    'overdue',
    'contested',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.alert_severity as enum (
    'low',
    'medium',
    'high',
    'critical'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.automation_status as enum (
    'manual_required',
    'partially_automated',
    'automated',
    'completed',
    'failed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.travel_readiness_status as enum (
    'not_checked',
    'ready',
    'attention',
    'blocked'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_direction as enum (
    'inflow',
    'outflow'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_method as enum (
    'pix',
    'ted',
    'boleto',
    'automatic_debit',
    'credit_card',
    'debit_card',
    'cash',
    'other'
  );
exception when duplicate_object then null;
end $$;

-- ============================================================
-- CORE
-- ============================================================

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name varchar(200) not null,
  description text,
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  first_name varchar(100) not null,
  last_name varchar(100) not null,
  birth_date date,
  cpf varchar(20),
  rg varchar(30),
  cnh varchar(30),
  nationality varchar(80),
  email varchar(200),
  phone varchar(50),
  family_role varchar(80),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint people_cpf_unique unique (cpf)
);

-- ============================================================
-- DOCUMENTS / FAMILY VAULT
-- ============================================================

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  owner_person_id uuid references public.people(id) on delete set null,
  document_type varchar(80) not null,
  document_number varchar(120),
  title varchar(200) not null,
  issue_date date,
  expiration_date date,
  issuing_authority varchar(200),
  country varchar(100),
  storage_provider varchar(50) not null default 'google_drive',
  storage_path text not null,
  file_name varchar(255),
  mime_type varchar(120),
  version integer not null default 1 check (version > 0),
  is_current boolean not null default true,
  status public.record_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Generic links preserve graph-like relationships without polymorphic FKs
create table if not exists public.entity_relationships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  source_type varchar(80) not null,
  source_id uuid not null,
  relationship_type varchar(100) not null,
  target_type varchar(80) not null,
  target_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint entity_relationships_unique
    unique (family_id, source_type, source_id, relationship_type, target_type, target_id)
);

-- ============================================================
-- PROPERTY
-- ============================================================

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title varchar(200) not null,
  address text not null,
  city varchar(100),
  state varchar(80),
  postal_code varchar(20),
  country varchar(80) not null default 'Brasil',
  property_type varchar(50),
  registry_number varchar(100),
  municipal_registration varchar(100),
  status public.record_status not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.property_owners (
  property_id uuid not null references public.properties(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  ownership_percentage numeric(5,2) check (
    ownership_percentage is null or
    (ownership_percentage >= 0 and ownership_percentage <= 100)
  ),
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  primary key (property_id, person_id)
);

-- ============================================================
-- FINANCIAL
-- ============================================================

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name varchar(200) not null,
  legal_name varchar(200),
  tax_document varchar(50),
  email varchar(200),
  phone varchar(50),
  category varchar(80),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  owner_person_id uuid references public.people(id) on delete set null,
  institution varchar(120) not null,
  account_type varchar(50) not null,
  currency char(3) not null default 'BRL',
  account_identifier varchar(120),
  status public.record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.recurrences (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  frequency varchar(30) not null,
  interval_value integer not null default 1 check (interval_value > 0),
  day_of_month integer check (day_of_month between 1 and 31),
  start_date date not null,
  end_date date,
  next_occurrence date,
  rule jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  responsible_person_id uuid references public.people(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  recurrence_id uuid references public.recurrences(id) on delete set null,
  description text not null,
  category varchar(80) not null,
  nature varchar(40),
  expected_amount numeric(14,2) not null check (expected_amount >= 0),
  currency char(3) not null default 'BRL',
  due_date date not null,
  status public.operational_status not null default 'planned',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  expense_id uuid references public.expenses(id) on delete set null,
  account_id uuid references public.accounts(id) on delete set null,
  executed_by_person_id uuid references public.people(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  receipt_document_id uuid references public.documents(id) on delete set null,
  direction public.payment_direction not null default 'outflow',
  payment_method public.payment_method not null default 'other',
  payment_date timestamptz not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency char(3) not null default 'BRL',
  status public.operational_status not null default 'paid',
  external_reference varchar(200),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TRAVEL
-- ============================================================

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title varchar(200) not null,
  destination_country varchar(100) not null,
  destination_city varchar(100),
  departure_date date not null,
  return_date date,
  status public.record_status not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint trips_date_check check (
    return_date is null or return_date >= departure_date
  )
);

create table if not exists public.trip_participants (
  trip_id uuid not null references public.trips(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  role varchar(50),
  created_at timestamptz not null default now(),
  primary key (trip_id, person_id)
);

create table if not exists public.travel_readiness (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  passport_ok boolean,
  visa_ok boolean,
  esta_eta_ok boolean,
  vaccine_ok boolean,
  insurance_ok boolean,
  readiness_score integer check (readiness_score between 0 and 100),
  status public.travel_readiness_status not null default 'not_checked',
  blocking_reasons jsonb not null default '[]'::jsonb,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint travel_readiness_unique unique (trip_id, person_id)
);

-- ============================================================
-- GOVERNANCE
-- ============================================================

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  related_entity_type varchar(80),
  related_entity_id uuid,
  severity public.alert_severity not null default 'medium',
  title varchar(200) not null,
  description text,
  due_date date,
  status public.record_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  assigned_person_id uuid references public.people(id) on delete set null,
  alert_id uuid references public.alerts(id) on delete set null,
  title varchar(200) not null,
  description text,
  due_date date,
  priority public.alert_severity not null default 'medium',
  status public.record_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

-- ============================================================
-- EVENT LOG
-- ============================================================

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  event_type varchar(100) not null,
  source varchar(80) not null,
  affected_entity_type varchar(80) not null,
  affected_entity_id uuid,
  related_person_id uuid references public.people(id) on delete set null,
  previous_state jsonb,
  new_state jsonb,
  priority public.alert_severity not null default 'medium',
  evidence_document_id uuid references public.documents(id) on delete set null,
  responsible_person_id uuid references public.people(id) on delete set null,
  automation_status public.automation_status not null default 'manual_required',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_people_family_id
  on public.people(family_id);

create index if not exists idx_documents_family_id
  on public.documents(family_id);

create index if not exists idx_documents_owner_person_id
  on public.documents(owner_person_id);

create index if not exists idx_documents_type
  on public.documents(document_type);

create index if not exists idx_documents_expiration_date
  on public.documents(expiration_date)
  where expiration_date is not null and deleted_at is null;

create index if not exists idx_properties_family_id
  on public.properties(family_id);

create index if not exists idx_expenses_family_due
  on public.expenses(family_id, due_date);

create index if not exists idx_expenses_status
  on public.expenses(status);

create index if not exists idx_payments_family_date
  on public.payments(family_id, payment_date);

create index if not exists idx_trips_family_departure
  on public.trips(family_id, departure_date);

create index if not exists idx_alerts_family_due
  on public.alerts(family_id, due_date);

create index if not exists idx_alerts_status
  on public.alerts(status);

create index if not exists idx_tasks_family_due
  on public.tasks(family_id, due_date);

create index if not exists idx_events_family_occurred
  on public.events(family_id, occurred_at desc);

create index if not exists idx_events_type
  on public.events(event_type);

create index if not exists idx_entity_relationships_source
  on public.entity_relationships(family_id, source_type, source_id);

create index if not exists idx_entity_relationships_target
  on public.entity_relationships(family_id, target_type, target_id);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'families',
    'people',
    'documents',
    'properties',
    'suppliers',
    'accounts',
    'recurrences',
    'expenses',
    'payments',
    'trips',
    'travel_readiness',
    'alerts',
    'tasks'
  ]
  loop
    execute format(
      'drop trigger if exists trg_%I_updated_at on public.%I',
      table_name, table_name
    );
    execute format(
      'create trigger trg_%I_updated_at
       before update on public.%I
       for each row execute function public.set_updated_at()',
      table_name, table_name
    );
  end loop;
end $$;

commit;
