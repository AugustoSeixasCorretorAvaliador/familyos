-- Applied remotely as migration 20260816204645.
begin;

select pg_advisory_xact_lock(hashtext('familyos:integridade-patrimonial-locaticia-cambial:v1'));

create table public.data_integrity_audit (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  migration_key text not null,
  entity_type text not null,
  source_id uuid,
  target_id uuid,
  status text not null default 'completed' check (status in ('planned','completed','review_required','reverted')),
  details jsonb not null default '{}'::jsonb,
  executed_at timestamptz not null default now(),
  executed_by uuid references auth.users(id) on delete set null,
  constraint data_integrity_audit_mapping_unique unique (migration_key, source_id, target_id)
);

create index data_integrity_audit_family_executed_idx
  on public.data_integrity_audit(family_id, executed_at desc);

alter table public.data_integrity_audit enable row level security;
create policy data_integrity_audit_select_family_member on public.data_integrity_audit
  for select to authenticated using (private.is_family_member(family_id));
revoke all on table public.data_integrity_audit from anon, authenticated;
grant select on table public.data_integrity_audit to authenticated;

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$' and currency <> 'BRL'),
  rate_date date not null,
  rate_to_brl numeric(20,8) not null check (rate_to_brl > 0),
  source varchar(40) not null default 'manual' check (source in ('manual','BCB_PTAX')),
  source_reference text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exchange_rates_identity_unique unique (family_id, currency, rate_date, source),
  constraint exchange_rates_id_family_unique unique (id, family_id)
);

create index exchange_rates_family_currency_date_idx
  on public.exchange_rates(family_id, currency, rate_date desc);

alter table public.exchange_rates enable row level security;
create policy exchange_rates_select_family_member on public.exchange_rates
  for select to authenticated using (private.is_family_member(family_id));
create policy exchange_rates_insert_family_editor on public.exchange_rates
  for insert to authenticated with check (private.can_edit_family(family_id));
create policy exchange_rates_update_family_editor on public.exchange_rates
  for update to authenticated using (private.can_edit_family(family_id)) with check (private.can_edit_family(family_id));
revoke all on table public.exchange_rates from anon, authenticated;
grant select, insert, update on table public.exchange_rates to authenticated;

create trigger trg_exchange_rates_updated_at
  before update on public.exchange_rates for each row execute function public.set_updated_at();
create trigger trg_exchange_rates_auth_audit
  before insert or update on public.exchange_rates for each row execute function public.set_auth_audit_fields();

alter table public.properties
  add column outstanding_debt numeric(18,2) check (outstanding_debt is null or outstanding_debt >= 0),
  add column valuation_date date,
  add column valuation_source varchar(160),
  add column ownership_review_status varchar(30) not null default 'review_required'
    check (ownership_review_status in ('review_required','confirmed'));

alter table public.lease_contracts
  add column review_status varchar(30) not null default 'review_required'
    check (review_status in ('review_required','confirmed'));

alter table public.investment_positions
  add column native_market_value numeric(18,2) check (native_market_value is null or native_market_value >= 0),
  add column exchange_rate_id uuid,
  add column exchange_rate_to_brl numeric(20,8) check (exchange_rate_to_brl is null or exchange_rate_to_brl > 0),
  add column market_value_brl numeric(18,2) check (market_value_brl is null or market_value_brl >= 0),
  add column valuation_status varchar(30) not null default 'review_required'
    check (valuation_status in ('review_required','confirmed')),
  add column valuation_notes text;

alter table public.investment_positions
  add constraint investment_positions_exchange_rate_family_fkey
  foreign key (exchange_rate_id, family_id)
  references public.exchange_rates(id, family_id) on delete restrict;

create index investment_positions_exchange_rate_idx
  on public.investment_positions(family_id, exchange_rate_id)
  where exchange_rate_id is not null;

update public.properties p
set ownership_review_status = case
  when exists (
    select 1 from public.property_owners po
    where po.property_id = p.id and po.ownership_percentage is null
  ) then 'review_required'
  when exists (select 1 from public.property_owners po where po.property_id = p.id)
    then 'confirmed'
  else 'review_required'
end;

update public.lease_contracts
set review_status = case
  when status = 'active'
    and adjustment_index is not null
    and adjustment_frequency_months is not null
    and next_adjustment_date is not null
    then 'confirmed'
  when status <> 'active' then 'confirmed'
  else 'review_required'
end;

update public.investment_positions ip
set native_market_value = ip.market_value,
    exchange_rate_to_brl = 1,
    market_value_brl = ip.market_value,
    valuation_status = 'confirmed'
from public.investment_assets ia
where ia.id = ip.asset_id
  and ia.family_id = ip.family_id
  and upper(trim(ia.currency)) = 'BRL';

update public.investment_positions ip
set valuation_status = 'review_required',
    valuation_notes = coalesce(ip.valuation_notes, 'Valor legado preservado; confirme o valor nativo e a cotacao antes da consolidacao em BRL.')
from public.investment_assets ia
where ia.id = ip.asset_id
  and ia.family_id = ip.family_id
  and upper(trim(ia.currency)) <> 'BRL';

do $$
declare
  v_family_id constant uuid := '3cf2f9ef-5ada-4572-806f-b4d5a5610d25';
  v_mapping record;
  v_before jsonb;
  v_after jsonb;
begin
  if not exists (select 1 from public.families where id = v_family_id and name = 'Familia Seixas') then
    raise exception 'Familia Seixas esperada nao encontrada; migracao interrompida';
  end if;

  drop table if exists pg_temp.property_integrity_mapping;
  create temporary table property_integrity_mapping (
    source_id uuid primary key,
    target_id uuid not null unique,
    mapping_reason text not null
  ) on commit drop;

  insert into property_integrity_mapping(source_id, target_id, mapping_reason) values
    ('d8b6198d-f2d7-57b7-9408-1e4e55ad9e41', '5f03207f-07a4-45e2-a27c-02521df4d2f1', 'Rua Lopes Trovao 469; cadastro importado 469 para Predio Comercial 3 Andares'),
    ('24756b6e-8efc-5b79-af5f-ab9d14abd2a5', '94544ba5-39f9-439f-abc1-61aee2ae0e19', 'Americo apto 1604; divergencia historica de numero 21/22 registrada para auditoria'),
    ('e74a0ed1-2808-5ae8-b78e-496d9a5a9ded', 'f9003859-faf3-438f-9b96-0eb41654aa2a', 'Center V, Rua Lopes Trovao 134 loja 218'),
    ('053b585e-c444-5d57-a56f-47878a8d4902', '0a4ef433-a16a-4432-845b-34d0959a8e10', 'Noronha Torrezao 181 apto 501; Villagio dei Fiori'),
    ('de4fafbf-e26d-5dfe-94f3-51bf753b0dc7', '9476afc8-764c-4351-97f8-fb6638f61b41', 'Rua Santa Rosa 38; Predio Comercial 3 Lojas 50%');

  if (select count(*) from public.properties p join property_integrity_mapping m on p.id = m.source_id where p.family_id = v_family_id and p.deleted_at is not null) <> 5
     or (select count(*) from public.properties p join property_integrity_mapping m on p.id = m.target_id where p.family_id = v_family_id and p.deleted_at is null) <> 5 then
    raise exception 'Pre-condicao dos cinco vinculos patrimoniais nao confere; migracao interrompida';
  end if;

  lock table public.property_units, public.lease_contracts, public.financial_entries,
    public.documents, public.family_tasks, public.insurance_policy_links in share row exclusive mode;

  alter table public.lease_contracts drop constraint lease_contracts_unit_property_family_fkey;

  for v_mapping in select * from property_integrity_mapping loop
    select jsonb_build_object(
      'property_units', (select count(*) from public.property_units where family_id = v_family_id and property_id = v_mapping.source_id),
      'lease_contracts', (select count(*) from public.lease_contracts where family_id = v_family_id and property_id = v_mapping.source_id),
      'financial_entries', (select count(*) from public.financial_entries where family_id = v_family_id and property_id = v_mapping.source_id),
      'documents', (select count(*) from public.documents where family_id = v_family_id and property_id = v_mapping.source_id),
      'family_tasks', (select count(*) from public.family_tasks where family_id = v_family_id and related_property_id = v_mapping.source_id),
      'insurance_policy_links', (select count(*) from public.insurance_policy_links where family_id = v_family_id and property_id = v_mapping.source_id)
    ) into v_before;

    update public.property_units set property_id = v_mapping.target_id where family_id = v_family_id and property_id = v_mapping.source_id;
    update public.lease_contracts set property_id = v_mapping.target_id where family_id = v_family_id and property_id = v_mapping.source_id;
    update public.financial_entries set property_id = v_mapping.target_id where family_id = v_family_id and property_id = v_mapping.source_id;
    update public.documents set property_id = v_mapping.target_id where family_id = v_family_id and property_id = v_mapping.source_id;
    update public.family_tasks set related_property_id = v_mapping.target_id where family_id = v_family_id and related_property_id = v_mapping.source_id;
    update public.insurance_policy_links set property_id = v_mapping.target_id where family_id = v_family_id and property_id = v_mapping.source_id;

    select jsonb_build_object(
      'property_units', (select count(*) from public.property_units where family_id = v_family_id and property_id = v_mapping.target_id),
      'lease_contracts', (select count(*) from public.lease_contracts where family_id = v_family_id and property_id = v_mapping.target_id),
      'financial_entries', (select count(*) from public.financial_entries where family_id = v_family_id and property_id = v_mapping.target_id),
      'documents', (select count(*) from public.documents where family_id = v_family_id and property_id = v_mapping.target_id),
      'family_tasks', (select count(*) from public.family_tasks where family_id = v_family_id and related_property_id = v_mapping.target_id),
      'insurance_policy_links', (select count(*) from public.insurance_policy_links where family_id = v_family_id and property_id = v_mapping.target_id)
    ) into v_after;

    insert into public.data_integrity_audit(
      family_id, migration_key, entity_type, source_id, target_id, status, details
    ) values (
      v_family_id,
      'integridade-patrimonial-locaticia-cambial-v1',
      'property_reference_relink',
      v_mapping.source_id,
      v_mapping.target_id,
      'completed',
      jsonb_build_object('reason', v_mapping.mapping_reason, 'before', v_before, 'after', v_after)
    );
  end loop;

  if exists (
    select 1 from property_integrity_mapping m
    where exists (select 1 from public.property_units where family_id = v_family_id and property_id = m.source_id)
       or exists (select 1 from public.lease_contracts where family_id = v_family_id and property_id = m.source_id)
       or exists (select 1 from public.financial_entries where family_id = v_family_id and property_id = m.source_id)
       or exists (select 1 from public.documents where family_id = v_family_id and property_id = m.source_id)
       or exists (select 1 from public.family_tasks where family_id = v_family_id and related_property_id = m.source_id)
       or exists (select 1 from public.insurance_policy_links where family_id = v_family_id and property_id = m.source_id)
  ) then
    raise exception 'Persistiram referencias aos imóveis arquivados; migracao interrompida';
  end if;

  update public.accounts
  set metadata = (metadata - 'saldo_atual' - 'data_atualizacao') || jsonb_build_object(
    'legacy_balance_snapshot', jsonb_strip_nulls(jsonb_build_object(
      'balance', metadata -> 'saldo_atual',
      'updated_at', metadata -> 'data_atualizacao',
      'migrated_at', now(),
      'reason', 'Razao financeiro passa a ser a fonte canonica do saldo.'
    ))
  )
  where family_id = v_family_id
    and (metadata ? 'saldo_atual' or metadata ? 'data_atualizacao');

  insert into public.data_integrity_audit(
    family_id, migration_key, entity_type, status, details
  ) values (
    v_family_id,
    'integridade-patrimonial-locaticia-cambial-v1-accounts',
    'account_balance_source',
    'completed',
    jsonb_build_object('canonical_source', 'opening_balance_plus_realized_ledger', 'legacy_snapshots_preserved', true)
  );
end $$;

alter table public.lease_contracts
  add constraint lease_contracts_unit_property_family_fkey
  foreign key (unit_id, property_id, family_id)
  references public.property_units(id, property_id, family_id);

commit;
