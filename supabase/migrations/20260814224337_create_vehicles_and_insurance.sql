-- HERO.FamilyOS - vehicles and insurance modules

begin;

create unique index if not exists people_id_family_unique
  on public.people(id, family_id);
create unique index if not exists properties_id_family_unique
  on public.properties(id, family_id);
create unique index if not exists credit_cards_id_family_unique
  on public.credit_cards(id, family_id);
create unique index if not exists documents_id_family_unique
  on public.documents(id, family_id);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  owner_person_id uuid,
  title varchar(160) not null,
  make varchar(100) not null,
  model varchar(120) not null,
  version varchar(120),
  manufacture_year smallint check (manufacture_year is null or manufacture_year between 1886 and 2200),
  model_year smallint check (model_year is null or model_year between 1886 and 2200),
  plate varchar(10),
  renavam varchar(20),
  vin varchar(40),
  color varchar(60),
  fuel_type varchar(60),
  acquisition_date date,
  acquisition_value numeric(18,2) check (acquisition_value is null or acquisition_value >= 0),
  estimated_value numeric(18,2) check (estimated_value is null or estimated_value >= 0),
  status varchar(30) not null default 'active'
    check (status in ('active', 'financed', 'sold', 'archived')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vehicles_owner_family_fkey
    foreign key (owner_person_id, family_id) references public.people(id, family_id)
);

create unique index if not exists vehicles_id_family_unique
  on public.vehicles(id, family_id);
create unique index if not exists vehicles_plate_family_unique
  on public.vehicles(family_id, upper(plate))
  where plate is not null and deleted_at is null;
create unique index if not exists vehicles_renavam_family_unique
  on public.vehicles(family_id, renavam)
  where renavam is not null and deleted_at is null;
create index if not exists idx_vehicles_family_status
  on public.vehicles(family_id, status, title)
  where deleted_at is null;

create table if not exists public.insurance_policies (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title varchar(180) not null,
  insurance_type varchar(30) not null
    check (insurance_type in ('vehicle', 'property', 'personal', 'life', 'health', 'travel', 'card', 'other')),
  policy_number varchar(100),
  insurer varchar(160) not null,
  broker varchar(160),
  start_date date not null,
  end_date date not null,
  insured_amount numeric(18,2) check (insured_amount is null or insured_amount >= 0),
  premium_amount numeric(18,2) check (premium_amount is null or premium_amount >= 0),
  deductible_amount numeric(18,2) check (deductible_amount is null or deductible_amount >= 0),
  payment_frequency varchar(30)
    check (payment_frequency is null or payment_frequency in ('single', 'monthly', 'quarterly', 'semiannual', 'annual', 'other')),
  status varchar(30) not null default 'active'
    check (status in ('pending', 'active', 'expired', 'cancelled', 'archived')),
  insured_description text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint insurance_policies_dates_check check (end_date >= start_date)
);

create unique index if not exists insurance_policies_id_family_unique
  on public.insurance_policies(id, family_id);
create unique index if not exists insurance_policies_number_unique
  on public.insurance_policies(family_id, lower(insurer), policy_number)
  where policy_number is not null and deleted_at is null;
create index if not exists idx_insurance_policies_family_end_date
  on public.insurance_policies(family_id, end_date, status)
  where deleted_at is null;

create table if not exists public.insurance_policy_links (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  policy_id uuid not null,
  target_type varchar(30) not null
    check (target_type in ('person', 'property', 'vehicle', 'credit_card')),
  person_id uuid,
  property_id uuid,
  vehicle_id uuid,
  credit_card_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint insurance_policy_links_single_target_check check (
    num_nonnulls(person_id, property_id, vehicle_id, credit_card_id) = 1
    and (target_type <> 'person' or person_id is not null)
    and (target_type <> 'property' or property_id is not null)
    and (target_type <> 'vehicle' or vehicle_id is not null)
    and (target_type <> 'credit_card' or credit_card_id is not null)
  ),
  constraint insurance_policy_links_policy_family_fkey
    foreign key (policy_id, family_id) references public.insurance_policies(id, family_id) on delete cascade,
  constraint insurance_policy_links_person_family_fkey
    foreign key (person_id, family_id) references public.people(id, family_id),
  constraint insurance_policy_links_property_family_fkey
    foreign key (property_id, family_id) references public.properties(id, family_id),
  constraint insurance_policy_links_vehicle_family_fkey
    foreign key (vehicle_id, family_id) references public.vehicles(id, family_id),
  constraint insurance_policy_links_card_family_fkey
    foreign key (credit_card_id, family_id) references public.credit_cards(id, family_id)
);

create unique index if not exists insurance_policy_links_target_unique
  on public.insurance_policy_links(
    policy_id,
    target_type,
    coalesce(person_id, property_id, vehicle_id, credit_card_id)
  );
create index if not exists idx_insurance_policy_links_family_policy
  on public.insurance_policy_links(family_id, policy_id);

alter table public.documents
  add column if not exists vehicle_id uuid,
  add column if not exists insurance_policy_id uuid;

alter table public.documents drop constraint if exists documents_vehicle_family_fkey;
alter table public.documents add constraint documents_vehicle_family_fkey
  foreign key (vehicle_id, family_id)
  references public.vehicles(id, family_id)
  on update cascade on delete restrict;

alter table public.documents drop constraint if exists documents_insurance_policy_family_fkey;
alter table public.documents add constraint documents_insurance_policy_family_fkey
  foreign key (insurance_policy_id, family_id)
  references public.insurance_policies(id, family_id)
  on update cascade on delete restrict;

alter table public.documents drop constraint if exists documents_single_asset_link_check;
alter table public.documents add constraint documents_single_asset_link_check
  check (num_nonnulls(property_id, vehicle_id, insurance_policy_id) <= 1);

create index if not exists idx_documents_family_vehicle
  on public.documents(family_id, vehicle_id, created_at desc)
  where vehicle_id is not null;
create index if not exists idx_documents_family_insurance_policy
  on public.documents(family_id, insurance_policy_id, created_at desc)
  where insurance_policy_id is not null;

drop trigger if exists trg_vehicles_updated_at on public.vehicles;
create trigger trg_vehicles_updated_at
  before update on public.vehicles
  for each row execute function public.set_updated_at();
drop trigger if exists trg_vehicles_auth_audit on public.vehicles;
create trigger trg_vehicles_auth_audit
  before insert or update on public.vehicles
  for each row execute function public.set_auth_audit_fields();

drop trigger if exists trg_insurance_policies_updated_at on public.insurance_policies;
create trigger trg_insurance_policies_updated_at
  before update on public.insurance_policies
  for each row execute function public.set_updated_at();
drop trigger if exists trg_insurance_policies_auth_audit on public.insurance_policies;
create trigger trg_insurance_policies_auth_audit
  before insert or update on public.insurance_policies
  for each row execute function public.set_auth_audit_fields();

alter table public.vehicles enable row level security;
alter table public.insurance_policies enable row level security;
alter table public.insurance_policy_links enable row level security;

drop policy if exists vehicles_select_family_member on public.vehicles;
create policy vehicles_select_family_member on public.vehicles
  for select to authenticated using (private.is_family_member(family_id));
drop policy if exists vehicles_insert_family_editor on public.vehicles;
create policy vehicles_insert_family_editor on public.vehicles
  for insert to authenticated with check (private.can_edit_family(family_id));
drop policy if exists vehicles_update_family_editor on public.vehicles;
create policy vehicles_update_family_editor on public.vehicles
  for update to authenticated
  using (private.can_edit_family(family_id))
  with check (private.can_edit_family(family_id));
drop policy if exists vehicles_delete_family_admin on public.vehicles;
create policy vehicles_delete_family_admin on public.vehicles
  for delete to authenticated using (private.can_admin_family(family_id));

drop policy if exists insurance_policies_select_family_member on public.insurance_policies;
create policy insurance_policies_select_family_member on public.insurance_policies
  for select to authenticated using (private.is_family_member(family_id));
drop policy if exists insurance_policies_insert_family_editor on public.insurance_policies;
create policy insurance_policies_insert_family_editor on public.insurance_policies
  for insert to authenticated with check (private.can_edit_family(family_id));
drop policy if exists insurance_policies_update_family_editor on public.insurance_policies;
create policy insurance_policies_update_family_editor on public.insurance_policies
  for update to authenticated
  using (private.can_edit_family(family_id))
  with check (private.can_edit_family(family_id));
drop policy if exists insurance_policies_delete_family_admin on public.insurance_policies;
create policy insurance_policies_delete_family_admin on public.insurance_policies
  for delete to authenticated using (private.can_admin_family(family_id));

drop policy if exists insurance_policy_links_select_family_member on public.insurance_policy_links;
create policy insurance_policy_links_select_family_member on public.insurance_policy_links
  for select to authenticated using (private.is_family_member(family_id));
drop policy if exists insurance_policy_links_insert_family_editor on public.insurance_policy_links;
create policy insurance_policy_links_insert_family_editor on public.insurance_policy_links
  for insert to authenticated with check (private.can_edit_family(family_id));
drop policy if exists insurance_policy_links_update_family_editor on public.insurance_policy_links;
create policy insurance_policy_links_update_family_editor on public.insurance_policy_links
  for update to authenticated
  using (private.can_edit_family(family_id))
  with check (private.can_edit_family(family_id));
drop policy if exists insurance_policy_links_delete_family_editor on public.insurance_policy_links;
create policy insurance_policy_links_delete_family_editor on public.insurance_policy_links
  for delete to authenticated using (private.can_edit_family(family_id));

revoke all on table public.vehicles, public.insurance_policies, public.insurance_policy_links
  from anon, authenticated;
grant select, insert, update, delete on table
  public.vehicles, public.insurance_policies, public.insurance_policy_links
  to authenticated;

commit;
