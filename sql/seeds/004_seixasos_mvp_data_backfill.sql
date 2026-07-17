-- SeixasOS MVP - Data backfill (idempotent)
-- Goal: ensure dashboard modules are populated for Familia Seixas.
-- Run in Supabase SQL Editor as postgres role.

begin;

with family_target as (
  select id
  from public.families
  where lower(name) = lower('Familia Seixas') and deleted_at is null
  limit 1
)
insert into public.properties (
  family_id,
  title,
  address,
  city,
  state,
  postal_code,
  country,
  property_type,
  registry_number,
  status,
  metadata
)
select
  ft.id,
  p.title,
  p.address,
  p.city,
  p.state,
  p.postal_code,
  'Brasil',
  p.property_type,
  p.registry_number,
  'active'::public.record_status,
  p.metadata::jsonb
from family_target ft
cross join (
  values
    ('Porto Real 402', 'Rua Demo 402', 'Rio de Janeiro', 'RJ', '20000-001', 'Apartamento', 'REG-0001', '{"situacao":"Proprio","valor_estimado":1200000.00,"renda_mensal":0.00,"condominio":1800.00,"iptu":450.00,"observacoes":"Backfill seed"}'),
    ('Icarai 1201', 'Av. Demo 1201', 'Niteroi', 'RJ', '24000-002', 'Apartamento', 'REG-0002', '{"situacao":"Alugado","valor_estimado":980000.00,"renda_mensal":5500.00,"condominio":1200.00,"iptu":380.00,"observacoes":"Backfill seed"}'),
    ('Cobertura Lagoa', 'Rua Demo Lagoa', 'Rio de Janeiro', 'RJ', '22400-003', 'Cobertura', 'REG-0003', '{"situacao":"A venda","valor_estimado":2100000.00,"renda_mensal":0.00,"condominio":2400.00,"iptu":620.00,"observacoes":"Backfill seed"}'),
    ('Casa Serra', 'Estrada Demo Serra', 'Petropolis', 'RJ', '25600-004', 'Casa', 'REG-0004', '{"situacao":"Proprio","valor_estimado":780000.00,"renda_mensal":0.00,"condominio":0.00,"iptu":220.00,"observacoes":"Backfill seed"}'),
    ('Sala Comercial Centro', 'Rua Demo Centro', 'Rio de Janeiro', 'RJ', '20010-005', 'Sala Comercial', 'REG-0005', '{"situacao":"Alugado","valor_estimado":430000.00,"renda_mensal":3200.00,"condominio":650.00,"iptu":170.00,"observacoes":"Backfill seed"}'),
    ('Terreno Buzios', 'Alameda Demo Buzios', 'Armacao dos Buzios', 'RJ', '28950-006', 'Terreno', 'REG-0006', '{"situacao":"Vago","valor_estimado":390000.00,"renda_mensal":0.00,"condominio":0.00,"iptu":90.00,"observacoes":"Backfill seed"}'),
    ('Apartamento Lisboa', 'Rua Demo Lisboa', 'Lisboa', 'PT', '1000-001', 'Apartamento', 'REG-0007', '{"situacao":"Em aquisicao","valor_estimado":1600000.00,"renda_mensal":0.00,"condominio":900.00,"iptu":0.00,"observacoes":"Backfill seed"}'),
    ('Casa Praia', 'Rua Demo Praia', 'Angra dos Reis', 'RJ', '23900-008', 'Casa', 'REG-0008', '{"situacao":"Vendido","valor_estimado":0.00,"renda_mensal":0.00,"condominio":0.00,"iptu":0.00,"observacoes":"Backfill seed"}')
) as p(title, address, city, state, postal_code, property_type, registry_number, metadata)
where not exists (
  select 1
  from public.properties pr
  where pr.family_id = ft.id
    and pr.title = p.title
    and pr.deleted_at is null
);

with family_target as (
  select id
  from public.families
  where lower(name) = lower('Familia Seixas') and deleted_at is null
  limit 1
), augusto as (
  select p.id
  from public.people p
  join family_target ft on ft.id = p.family_id
  where p.first_name = 'Augusto' and p.last_name = 'Seixas' and p.deleted_at is null
  limit 1
)
insert into public.property_owners (property_id, person_id, ownership_percentage)
select pr.id, a.id, 100.00
from public.properties pr
join family_target ft on ft.id = pr.family_id
cross join augusto a
where pr.deleted_at is null
  and not exists (
    select 1 from public.property_owners po
    where po.property_id = pr.id and po.person_id = a.id
  );

-- Stage 3 data safety (accounts/doctors/exams already seeded in 002)
with family_target as (
  select id from public.families
  where lower(name) = lower('Familia Seixas') and deleted_at is null
  limit 1
), person_target as (
  select p.id
  from public.people p
  join family_target ft on ft.id = p.family_id
  where p.first_name = 'Augusto' and p.last_name = 'Seixas' and p.deleted_at is null
  limit 1
), doctor_target as (
  select d.id
  from public.doctors d
  join family_target ft on ft.id = d.family_id
  where d.doctor_name = 'Dra. Demo Endocrino'
  limit 1
)
insert into public.medications (
  family_id,
  person_id,
  doctor_id,
  medication_name,
  dosage,
  frequency,
  schedule,
  start_date,
  end_date,
  status,
  notes
)
select
  ft.id,
  pt.id,
  dt.id,
  m.medication_name,
  m.dosage,
  m.frequency,
  m.schedule,
  m.start_date::date,
  m.end_date::date,
  m.status,
  'Backfill seed'
from family_target ft
left join person_target pt on true
left join doctor_target dt on true
cross join (
  values
    ('Vitamina D', '1 capsula', 'Diaria', '08:00', '2026-01-01', null, 'Em uso'),
    ('Omega 3', '1 capsula', 'Diaria', '12:00', '2026-02-01', null, 'Em uso'),
    ('Antialergico Demo', '10mg', 'Quando necessario', '22:00', '2026-03-01', null, 'Suspenso'),
    ('Probiotico Demo', '1 capsula', 'Diaria', '07:00', '2026-01-15', '2026-06-15', 'Encerrado')
) as m(medication_name, dosage, frequency, schedule, start_date, end_date, status)
where not exists (
  select 1 from public.medications med
  where med.family_id = ft.id and med.medication_name = m.medication_name
);

-- Ensure timeline > 0 with family events, aligned to dashboard table (events)
with family_target as (
  select id from public.families
  where lower(name) = lower('Familia Seixas') and deleted_at is null
  limit 1
), doc_target as (
  select d.id
  from public.documents d
  join family_target ft on ft.id = d.family_id
  where d.deleted_at is null
  order by d.created_at desc
  limit 1
)
insert into public.events (
  family_id,
  event_type,
  source,
  affected_entity_type,
  affected_entity_id,
  priority,
  automation_status,
  occurred_at
)
select
  ft.id,
  e.event_type,
  'seed.backfill',
  e.affected_entity_type,
  case when e.affected_entity_type = 'documents' then dt.id else null end,
  e.priority,
  'partially_automated'::public.automation_status,
  now() - (e.offset_days || ' days')::interval
from family_target ft
left join doc_target dt on true
cross join (
  values
    ('family_bootstrap', 'families', 'low', 30),
    ('properties_seeded', 'properties', 'medium', 10),
    ('health_seeded', 'health_exams', 'medium', 8),
    ('tasks_seeded', 'family_tasks', 'medium', 6),
    ('document_uploaded', 'documents', 'high', 1)
) as e(event_type, affected_entity_type, priority, offset_days)
where not exists (
  select 1 from public.events ev
  where ev.family_id = ft.id and ev.event_type = e.event_type
);

commit;
