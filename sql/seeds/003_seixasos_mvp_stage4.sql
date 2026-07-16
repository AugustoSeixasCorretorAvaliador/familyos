-- SeixasOS MVP 0.1 - Stage 4 seed (idempotent)

begin;

with family_target as (
  select id
  from public.families
  where lower(name) = lower('Familia Seixas') and deleted_at is null
  limit 1
),
person_target as (
  select p.id
  from public.people p
  join family_target ft on ft.id = p.family_id
  where p.first_name = 'Augusto' and p.last_name = 'Seixas' and p.deleted_at is null
  limit 1
)
insert into public.legal_cases (
  family_id,
  case_number,
  title,
  case_type,
  person_id,
  court,
  start_date,
  lawyer,
  claim_value,
  expected_value,
  last_update,
  last_update_date,
  status,
  notes
)
select
  ft.id,
  '0000000-00.2026.8.26.0001',
  'Inventario Familia Seixas',
  'Inventario',
  pt.id,
  'TJSP',
  '2026-01-10',
  'Advogado Demo',
  100000.00,
  85000.00,
  'Distribuicao inicial',
  '2026-07-01',
  'Ativo',
  'Registro de demonstracao'
from family_target ft
left join person_target pt on true
where not exists (
  select 1 from public.legal_cases lc
  where lc.family_id = ft.id and lc.title = 'Inventario Familia Seixas'
);

with family_target as (
  select id
  from public.families
  where lower(name) = lower('Familia Seixas') and deleted_at is null
  limit 1
),
person_target as (
  select p.id
  from public.people p
  join family_target ft on ft.id = p.family_id
  where p.first_name = 'Augusto' and p.last_name = 'Seixas' and p.deleted_at is null
  limit 1
)
insert into public.family_tasks (
  family_id,
  title,
  description,
  responsible_person_id,
  category,
  priority,
  status,
  due_date
)
select
  ft.id,
  t.title,
  t.description,
  pt.id,
  t.category,
  t.priority,
  t.status,
  t.due_date::date
from family_target ft
left join person_target pt on true
cross join (
  values
    ('Atualizar documentos de viagem', 'Conferir vencimento de passaportes', 'Documentos', 'Alta', 'Em andamento', '2026-08-10'),
    ('Reuniao com advogado', 'Alinhar proximo andamento do processo', 'Processos', 'Urgente', 'A fazer', '2026-07-25'),
    ('Revisar check-up anual', 'Confirmar exames pendentes', 'Saude', 'Media', 'Aguardando terceiro', '2026-07-20')
) as t(title, description, category, priority, status, due_date)
where not exists (
  select 1 from public.family_tasks ft2
  where ft2.family_id = ft.id and ft2.title = t.title
);

commit;
