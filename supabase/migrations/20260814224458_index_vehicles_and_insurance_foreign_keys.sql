-- Cover foreign keys introduced by the vehicles and insurance modules.

begin;

create index if not exists documents_vehicle_family_fkey_idx
  on public.documents(vehicle_id, family_id)
  where vehicle_id is not null;
create index if not exists documents_insurance_policy_family_fkey_idx
  on public.documents(insurance_policy_id, family_id)
  where insurance_policy_id is not null;

create index if not exists vehicles_owner_family_fkey_idx
  on public.vehicles(owner_person_id, family_id)
  where owner_person_id is not null;
create index if not exists vehicles_created_by_fkey_idx
  on public.vehicles(created_by)
  where created_by is not null;
create index if not exists vehicles_updated_by_fkey_idx
  on public.vehicles(updated_by)
  where updated_by is not null;

create index if not exists insurance_policies_created_by_fkey_idx
  on public.insurance_policies(created_by)
  where created_by is not null;
create index if not exists insurance_policies_updated_by_fkey_idx
  on public.insurance_policies(updated_by)
  where updated_by is not null;

create index if not exists insurance_policy_links_policy_family_fkey_idx
  on public.insurance_policy_links(policy_id, family_id);
create index if not exists insurance_policy_links_person_family_fkey_idx
  on public.insurance_policy_links(person_id, family_id)
  where person_id is not null;
create index if not exists insurance_policy_links_property_family_fkey_idx
  on public.insurance_policy_links(property_id, family_id)
  where property_id is not null;
create index if not exists insurance_policy_links_vehicle_family_fkey_idx
  on public.insurance_policy_links(vehicle_id, family_id)
  where vehicle_id is not null;
create index if not exists insurance_policy_links_card_family_fkey_idx
  on public.insurance_policy_links(credit_card_id, family_id)
  where credit_card_id is not null;
create index if not exists insurance_policy_links_created_by_fkey_idx
  on public.insurance_policy_links(created_by)
  where created_by is not null;

commit;
