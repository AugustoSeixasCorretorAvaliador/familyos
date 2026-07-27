-- HERO.FamilyOS - financial and patrimonial core
-- This migration is schema-only. It does not import spreadsheet or production data.

begin;

create unique index if not exists accounts_id_family_unique on public.accounts(id, family_id);
create unique index if not exists people_id_family_unique on public.people(id, family_id);
create unique index if not exists properties_id_family_unique on public.properties(id, family_id);
create unique index if not exists documents_id_family_unique on public.documents(id, family_id);

alter table public.accounts
  add column if not exists opening_balance numeric(18,2) not null default 0,
  add column if not exists opening_balance_date date,
  add column if not exists is_demo boolean not null default false;

alter table public.properties
  add column if not exists is_demo boolean not null default false;

create table if not exists public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  parent_id uuid,
  name varchar(120) not null,
  category_type varchar(20) not null check (category_type in ('income','expense','investment','transfer','adjustment')),
  color varchar(20),
  icon varchar(80),
  active boolean not null default true,
  is_demo boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists financial_categories_id_family_unique
  on public.financial_categories(id, family_id);
create unique index if not exists financial_categories_name_unique
  on public.financial_categories(family_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name))
  where deleted_at is null;
alter table public.financial_categories drop constraint if exists financial_categories_parent_family_fkey;
alter table public.financial_categories add constraint financial_categories_parent_family_fkey
  foreign key (parent_id, family_id) references public.financial_categories(id, family_id);

create table if not exists public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  holder_person_id uuid,
  payment_account_id uuid,
  name varchar(120) not null,
  brand varchar(80),
  institution varchar(120) not null,
  last_four char(4),
  credit_limit numeric(18,2) check (credit_limit is null or credit_limit >= 0),
  closing_day smallint check (closing_day between 1 and 31),
  due_day smallint check (due_day between 1 and 31),
  best_purchase_day smallint check (best_purchase_day between 1 and 31),
  active boolean not null default true,
  is_demo boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint credit_cards_holder_family_fkey foreign key (holder_person_id, family_id) references public.people(id, family_id),
  constraint credit_cards_account_family_fkey foreign key (payment_account_id, family_id) references public.accounts(id, family_id)
);

create unique index if not exists credit_cards_id_family_unique on public.credit_cards(id, family_id);
create unique index if not exists credit_cards_identity_unique
  on public.credit_cards(family_id, lower(name), coalesce(last_four, '')) where deleted_at is null;

create table if not exists public.property_units (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  property_id uuid not null,
  code varchar(80) not null,
  name varchar(160) not null,
  unit_type varchar(80),
  status varchar(30) not null default 'vacant' check (status in ('active','vacant','negotiating','closed','sold','inactive')),
  notes text,
  is_demo boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint property_units_property_family_fkey foreign key (property_id, family_id) references public.properties(id, family_id)
);

create unique index if not exists property_units_id_family_unique on public.property_units(id, family_id);
create unique index if not exists property_units_id_property_family_unique on public.property_units(id, property_id, family_id);
create unique index if not exists property_units_code_unique
  on public.property_units(property_id, lower(code)) where deleted_at is null;

create table if not exists public.lease_contracts (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  property_id uuid not null,
  unit_id uuid,
  tenant_person_id uuid,
  principal_owner_person_id uuid,
  base_rent numeric(18,2) not null check (base_rent >= 0),
  charges_amount numeric(18,2) not null default 0 check (charges_amount >= 0),
  start_date date not null,
  end_date date,
  adjustment_index varchar(80),
  adjustment_frequency_months smallint check (adjustment_frequency_months is null or adjustment_frequency_months > 0),
  next_adjustment_date date,
  guarantee_type varchar(80),
  status varchar(30) not null default 'active' check (status in ('active','vacant','negotiating','closed','sold')),
  notes text,
  is_demo boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint lease_contracts_dates_check check (end_date is null or end_date >= start_date),
  constraint lease_contracts_property_family_fkey foreign key (property_id, family_id) references public.properties(id, family_id),
  constraint lease_contracts_unit_property_family_fkey foreign key (unit_id, property_id, family_id) references public.property_units(id, property_id, family_id),
  constraint lease_contracts_tenant_family_fkey foreign key (tenant_person_id, family_id) references public.people(id, family_id),
  constraint lease_contracts_owner_family_fkey foreign key (principal_owner_person_id, family_id) references public.people(id, family_id)
);

create unique index if not exists lease_contracts_id_family_unique on public.lease_contracts(id, family_id);

create table if not exists public.lease_owner_shares (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  lease_contract_id uuid not null,
  person_id uuid not null,
  share_type varchar(20) not null default 'percentage' check (share_type in ('percentage','fixed_amount','custom')),
  percentage numeric(7,4) check (percentage is null or (percentage >= 0 and percentage <= 100)),
  fixed_amount numeric(18,2) check (fixed_amount is null or fixed_amount >= 0),
  rule jsonb not null default '{}'::jsonb,
  valid_from date not null,
  valid_until date,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint lease_owner_shares_dates_check check (valid_until is null or valid_until >= valid_from),
  constraint lease_owner_shares_contract_family_fkey foreign key (lease_contract_id, family_id) references public.lease_contracts(id, family_id),
  constraint lease_owner_shares_person_family_fkey foreign key (person_id, family_id) references public.people(id, family_id)
);

create table if not exists public.investment_assets (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  account_id uuid,
  institution varchar(120) not null,
  name varchar(160) not null,
  asset_type varchar(40) not null check (asset_type in ('fixed_income','fund','cdb','foreign_currency','interest_account','other')),
  currency char(3) not null default 'BRL',
  active boolean not null default true,
  is_demo boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint investment_assets_account_family_fkey foreign key (account_id, family_id) references public.accounts(id, family_id)
);

create unique index if not exists investment_assets_id_family_unique on public.investment_assets(id, family_id);

create table if not exists public.investment_positions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  asset_id uuid not null,
  position_date date not null,
  quantity numeric(24,8),
  unit_price numeric(24,8),
  cost_amount numeric(18,2),
  market_value numeric(18,2) not null check (market_value >= 0),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investment_positions_asset_family_fkey foreign key (asset_id, family_id) references public.investment_assets(id, family_id),
  constraint investment_positions_unique unique (asset_id, position_date)
);

create table if not exists public.installment_purchases (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  card_id uuid,
  category_id uuid,
  responsible_person_id uuid,
  description varchar(240) not null,
  total_amount numeric(18,2) not null check (total_amount >= 0),
  installment_count smallint not null check (installment_count > 0),
  first_competence date not null check (first_competence = date_trunc('month', first_competence)::date),
  purchase_date date,
  status varchar(30) not null default 'active' check (status in ('active','completed','cancelled','anticipated')),
  is_demo boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint installment_purchases_card_family_fkey foreign key (card_id, family_id) references public.credit_cards(id, family_id),
  constraint installment_purchases_category_family_fkey foreign key (category_id, family_id) references public.financial_categories(id, family_id),
  constraint installment_purchases_person_family_fkey foreign key (responsible_person_id, family_id) references public.people(id, family_id)
);

create unique index if not exists installment_purchases_id_family_unique on public.installment_purchases(id, family_id);

create table if not exists public.card_invoices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  card_id uuid not null,
  competence date not null check (competence = date_trunc('month', competence)::date),
  closing_date date,
  due_date date not null,
  expected_amount numeric(18,2) not null default 0 check (expected_amount >= 0),
  closed_amount numeric(18,2) check (closed_amount is null or closed_amount >= 0),
  paid_amount numeric(18,2) check (paid_amount is null or paid_amount >= 0),
  payment_date date,
  payment_account_id uuid,
  document_id uuid,
  status varchar(30) not null default 'open' check (status in ('open','closed','partially_paid','paid','overdue','cancelled')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint card_invoices_card_family_fkey foreign key (card_id, family_id) references public.credit_cards(id, family_id),
  constraint card_invoices_account_family_fkey foreign key (payment_account_id, family_id) references public.accounts(id, family_id),
  constraint card_invoices_document_family_fkey foreign key (document_id, family_id) references public.documents(id, family_id)
);

create unique index if not exists card_invoices_id_family_unique on public.card_invoices(id, family_id);
create unique index if not exists card_invoices_card_competence_unique
  on public.card_invoices(card_id, competence) where deleted_at is null;

alter table public.recurrences
  add column if not exists description varchar(240),
  add column if not exists category_id uuid,
  add column if not exists account_id uuid,
  add column if not exists card_id uuid,
  add column if not exists responsible_person_id uuid,
  add column if not exists expected_amount numeric(18,2),
  add column if not exists entry_type varchar(40),
  add column if not exists is_demo boolean not null default false,
  add column if not exists deleted_at timestamptz;

create unique index if not exists recurrences_id_family_unique on public.recurrences(id, family_id);

alter table public.recurrences drop constraint if exists recurrences_category_family_fkey;
alter table public.recurrences add constraint recurrences_category_family_fkey
  foreign key (category_id, family_id) references public.financial_categories(id, family_id);
alter table public.recurrences drop constraint if exists recurrences_account_family_fkey;
alter table public.recurrences add constraint recurrences_account_family_fkey
  foreign key (account_id, family_id) references public.accounts(id, family_id);
alter table public.recurrences drop constraint if exists recurrences_card_family_fkey;
alter table public.recurrences add constraint recurrences_card_family_fkey
  foreign key (card_id, family_id) references public.credit_cards(id, family_id);
alter table public.recurrences drop constraint if exists recurrences_person_family_fkey;
alter table public.recurrences add constraint recurrences_person_family_fkey
  foreign key (responsible_person_id, family_id) references public.people(id, family_id);

create table if not exists public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  responsible_person_id uuid,
  economic_owner_person_id uuid,
  category_id uuid,
  account_id uuid,
  card_id uuid,
  property_id uuid,
  property_unit_id uuid,
  lease_contract_id uuid,
  investment_asset_id uuid,
  recurrence_id uuid,
  installment_purchase_id uuid,
  card_invoice_id uuid,
  document_id uuid,
  parent_entry_id uuid,
  reversal_of_entry_id uuid,
  transfer_group_id uuid,
  competence date not null check (competence = date_trunc('month', competence)::date),
  due_date date,
  expected_date date,
  effective_date date,
  entry_type varchar(40) not null check (entry_type in ('income','expense','transfer','investment_application','investment_redemption','investment_yield','adjustment','reversal')),
  cash_direction varchar(10) not null check (cash_direction in ('inflow','outflow','none')),
  purchase_kind varchar(20) check (purchase_kind is null or purchase_kind in ('recurring','installment','one_off')),
  description varchar(240) not null,
  notes text,
  expected_amount numeric(18,2) not null check (expected_amount >= 0),
  actual_amount numeric(18,2) check (actual_amount is null or actual_amount >= 0),
  difference_amount numeric(18,2) generated always as (
    case when actual_amount is null then null else actual_amount - expected_amount end
  ) stored,
  status varchar(30) not null default 'planned' check (status in ('planned','confirmed','payable','paid','receivable','received','partially_paid','partially_received','overdue','cancelled','reversed','pending_confirmation')),
  installment_number smallint,
  installment_count smallint,
  origin varchar(20) not null default 'manual' check (origin in ('manual','recurrence','installment','lease','import','ai','system')),
  source_key varchar(240),
  is_demo boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint financial_entries_installment_range_check check (
    (installment_number is null and installment_count is null)
    or (installment_number between 1 and installment_count)
  ),
  constraint financial_entries_responsible_family_fkey foreign key (responsible_person_id, family_id) references public.people(id, family_id),
  constraint financial_entries_owner_family_fkey foreign key (economic_owner_person_id, family_id) references public.people(id, family_id),
  constraint financial_entries_category_family_fkey foreign key (category_id, family_id) references public.financial_categories(id, family_id),
  constraint financial_entries_account_family_fkey foreign key (account_id, family_id) references public.accounts(id, family_id),
  constraint financial_entries_card_family_fkey foreign key (card_id, family_id) references public.credit_cards(id, family_id),
  constraint financial_entries_property_family_fkey foreign key (property_id, family_id) references public.properties(id, family_id),
  constraint financial_entries_unit_family_fkey foreign key (property_unit_id, family_id) references public.property_units(id, family_id),
  constraint financial_entries_lease_family_fkey foreign key (lease_contract_id, family_id) references public.lease_contracts(id, family_id),
  constraint financial_entries_asset_family_fkey foreign key (investment_asset_id, family_id) references public.investment_assets(id, family_id),
  constraint financial_entries_recurrence_family_fkey foreign key (recurrence_id, family_id) references public.recurrences(id, family_id),
  constraint financial_entries_purchase_family_fkey foreign key (installment_purchase_id, family_id) references public.installment_purchases(id, family_id),
  constraint financial_entries_invoice_family_fkey foreign key (card_invoice_id, family_id) references public.card_invoices(id, family_id),
  constraint financial_entries_document_family_fkey foreign key (document_id, family_id) references public.documents(id, family_id)
);

create unique index if not exists financial_entries_id_family_unique on public.financial_entries(id, family_id);
alter table public.financial_entries drop constraint if exists financial_entries_parent_family_fkey;
alter table public.financial_entries add constraint financial_entries_parent_family_fkey
  foreign key (parent_entry_id, family_id) references public.financial_entries(id, family_id);
alter table public.financial_entries drop constraint if exists financial_entries_reversal_family_fkey;
alter table public.financial_entries add constraint financial_entries_reversal_family_fkey
  foreign key (reversal_of_entry_id, family_id) references public.financial_entries(id, family_id);

create unique index if not exists financial_entries_source_unique
  on public.financial_entries(family_id, source_key) where source_key is not null and deleted_at is null;
create unique index if not exists financial_entries_installment_unique
  on public.financial_entries(installment_purchase_id, installment_number)
  where installment_purchase_id is not null and deleted_at is null;
create index if not exists financial_entries_family_competence_idx
  on public.financial_entries(family_id, competence, status) where deleted_at is null;
create index if not exists financial_entries_family_due_idx
  on public.financial_entries(family_id, due_date) where deleted_at is null;
create index if not exists financial_entries_card_competence_idx
  on public.financial_entries(family_id, card_id, competence) where deleted_at is null;
create index if not exists financial_entries_property_competence_idx
  on public.financial_entries(family_id, property_id, competence) where deleted_at is null;

-- Foreign-key indexes support ownership checks, joins and parent-row maintenance.
create index if not exists financial_categories_parent_idx
  on public.financial_categories(family_id, parent_id) where parent_id is not null;
create index if not exists credit_cards_holder_idx
  on public.credit_cards(family_id, holder_person_id) where holder_person_id is not null;
create index if not exists credit_cards_payment_account_idx
  on public.credit_cards(family_id, payment_account_id) where payment_account_id is not null;
create index if not exists property_units_property_idx
  on public.property_units(family_id, property_id) where deleted_at is null;
create index if not exists lease_contracts_property_idx
  on public.lease_contracts(family_id, property_id) where deleted_at is null;
create index if not exists lease_contracts_unit_idx
  on public.lease_contracts(family_id, unit_id) where unit_id is not null and deleted_at is null;
create index if not exists lease_contracts_tenant_idx
  on public.lease_contracts(family_id, tenant_person_id) where tenant_person_id is not null and deleted_at is null;
create index if not exists lease_contracts_owner_idx
  on public.lease_contracts(family_id, principal_owner_person_id) where principal_owner_person_id is not null and deleted_at is null;
create index if not exists lease_owner_shares_contract_idx
  on public.lease_owner_shares(family_id, lease_contract_id) where deleted_at is null;
create index if not exists lease_owner_shares_person_idx
  on public.lease_owner_shares(family_id, person_id) where deleted_at is null;
create index if not exists investment_assets_account_idx
  on public.investment_assets(family_id, account_id) where account_id is not null and deleted_at is null;
create index if not exists investment_positions_asset_idx
  on public.investment_positions(family_id, asset_id, position_date desc);
create index if not exists installment_purchases_card_idx
  on public.installment_purchases(family_id, card_id) where card_id is not null and deleted_at is null;
create index if not exists installment_purchases_category_idx
  on public.installment_purchases(family_id, category_id) where category_id is not null and deleted_at is null;
create index if not exists installment_purchases_person_idx
  on public.installment_purchases(family_id, responsible_person_id) where responsible_person_id is not null and deleted_at is null;
create index if not exists card_invoices_account_idx
  on public.card_invoices(family_id, payment_account_id) where payment_account_id is not null and deleted_at is null;
create index if not exists card_invoices_document_idx
  on public.card_invoices(family_id, document_id) where document_id is not null and deleted_at is null;
create index if not exists recurrences_category_idx
  on public.recurrences(family_id, category_id) where category_id is not null and deleted_at is null;
create index if not exists recurrences_account_idx
  on public.recurrences(family_id, account_id) where account_id is not null and deleted_at is null;
create index if not exists recurrences_card_idx
  on public.recurrences(family_id, card_id) where card_id is not null and deleted_at is null;
create index if not exists recurrences_person_idx
  on public.recurrences(family_id, responsible_person_id) where responsible_person_id is not null and deleted_at is null;
create index if not exists financial_entries_responsible_idx
  on public.financial_entries(family_id, responsible_person_id) where responsible_person_id is not null and deleted_at is null;
create index if not exists financial_entries_owner_idx
  on public.financial_entries(family_id, economic_owner_person_id) where economic_owner_person_id is not null and deleted_at is null;
create index if not exists financial_entries_category_idx
  on public.financial_entries(family_id, category_id) where category_id is not null and deleted_at is null;
create index if not exists financial_entries_account_idx
  on public.financial_entries(family_id, account_id) where account_id is not null and deleted_at is null;
create index if not exists financial_entries_unit_idx
  on public.financial_entries(family_id, property_unit_id) where property_unit_id is not null and deleted_at is null;
create index if not exists financial_entries_lease_idx
  on public.financial_entries(family_id, lease_contract_id) where lease_contract_id is not null and deleted_at is null;
create index if not exists financial_entries_asset_idx
  on public.financial_entries(family_id, investment_asset_id) where investment_asset_id is not null and deleted_at is null;
create index if not exists financial_entries_recurrence_idx
  on public.financial_entries(family_id, recurrence_id) where recurrence_id is not null and deleted_at is null;
create index if not exists financial_entries_purchase_idx
  on public.financial_entries(family_id, installment_purchase_id) where installment_purchase_id is not null and deleted_at is null;
create index if not exists financial_entries_invoice_idx
  on public.financial_entries(family_id, card_invoice_id) where card_invoice_id is not null and deleted_at is null;
create index if not exists financial_entries_document_idx
  on public.financial_entries(family_id, document_id) where document_id is not null and deleted_at is null;
create index if not exists financial_entries_parent_idx
  on public.financial_entries(family_id, parent_entry_id) where parent_entry_id is not null and deleted_at is null;
create index if not exists financial_entries_reversal_idx
  on public.financial_entries(family_id, reversal_of_entry_id) where reversal_of_entry_id is not null and deleted_at is null;

create table if not exists public.financial_entry_history (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  financial_entry_id uuid not null,
  change_type varchar(10) not null check (change_type in ('insert','update','delete')),
  previous_state jsonb,
  new_state jsonb,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists financial_entry_history_entry_idx
  on public.financial_entry_history(family_id, financial_entry_id, changed_at desc);

create table if not exists public.financial_alert_rules (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name varchar(160) not null,
  rule_type varchar(40) not null,
  configuration jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create or replace function private.capture_financial_entry_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.financial_entry_history (
    family_id, financial_entry_id, change_type, previous_state, new_state, changed_by
  ) values (
    coalesce(new.family_id, old.family_id),
    coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else null end,
    (select auth.uid())
  );
  return coalesce(new, old);
end;
$$;

revoke all on function private.capture_financial_entry_history() from public, anon, authenticated;

drop trigger if exists trg_financial_entries_history on public.financial_entries;
create trigger trg_financial_entries_history
after insert or update or delete on public.financial_entries
for each row execute function private.capture_financial_entry_history();

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'financial_categories','credit_cards','property_units','lease_contracts','lease_owner_shares',
    'investment_assets','investment_positions','installment_purchases','card_invoices','financial_entries',
    'financial_alert_rules'
  ]
  loop
    execute format('drop trigger if exists trg_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
    execute format('drop trigger if exists trg_%I_auth_audit on public.%I', table_name, table_name);
    execute format('create trigger trg_%I_auth_audit before insert or update on public.%I for each row execute function public.set_auth_audit_fields()', table_name, table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'financial_categories','credit_cards','property_units','lease_contracts','lease_owner_shares',
    'investment_assets','investment_positions','installment_purchases','card_invoices','financial_entries',
    'financial_entry_history','financial_alert_rules'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select_family_member', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_family_member(family_id))', table_name || '_select_family_member', table_name);
  end loop;
end $$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'financial_categories','credit_cards','property_units','lease_contracts','lease_owner_shares',
    'investment_assets','investment_positions','installment_purchases','card_invoices','financial_entries',
    'financial_alert_rules'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_family_editor', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.can_edit_family(family_id))', table_name || '_insert_family_editor', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_family_editor', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (private.can_edit_family(family_id)) with check (private.can_edit_family(family_id))', table_name || '_update_family_editor', table_name);
  end loop;
end $$;

revoke all on table public.financial_entry_history from anon, authenticated;
grant select on table public.financial_entry_history to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'financial_categories','credit_cards','property_units','lease_contracts','lease_owner_shares',
    'investment_assets','investment_positions','installment_purchases','card_invoices','financial_entries',
    'financial_alert_rules'
  ]
  loop
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update on table public.%I to authenticated', table_name);
  end loop;
end $$;

commit;
