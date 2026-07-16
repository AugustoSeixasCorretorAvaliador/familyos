-- SeixasOS MVP 0.1 - Stage 3 seed (idempotent)
-- Requires family "Familia Seixas" created in stage 1.

begin;

with family_target as (
  select id from public.families
  where lower(name) = lower('Familia Seixas') and deleted_at is null
  limit 1
)
insert into public.accounts (
  family_id,
  owner_person_id,
  institution,
  account_type,
  account_identifier,
  status,
  metadata
)
select
  ft.id,
  null,
  a.institution,
  a.account_type,
  a.account_identifier,
  'active'::public.record_status,
  a.metadata::jsonb
from family_target ft
cross join (
  values
    ('Banco Demo A', 'Conta Corrente', 'AG 0001 / **1234', '{"agencia":"0001","ultimos_quatro":"1234","saldo_atual":50000.00,"data_atualizacao":"2026-07-16","observacoes":"Conta de demonstracao"}'),
    ('Banco Demo B', 'Conta Poupanca', 'AG 0002 / **5678', '{"agencia":"0002","ultimos_quatro":"5678","saldo_atual":18000.00,"data_atualizacao":"2026-07-16","observacoes":"Conta de demonstracao"}')
) as a(institution, account_type, account_identifier, metadata)
where not exists (
  select 1 from public.accounts ac
  where ac.family_id = ft.id
    and ac.institution = a.institution
    and ac.account_identifier = a.account_identifier
    and ac.deleted_at is null
);

with family_target as (
  select id from public.families
  where lower(name) = lower('Familia Seixas') and deleted_at is null
  limit 1
)
insert into public.doctors (
  family_id,
  doctor_name,
  specialty,
  clinic,
  phone,
  email,
  address,
  notes,
  status
)
select
  ft.id,
  d.doctor_name,
  d.specialty,
  d.clinic,
  null,
  null,
  null,
  'Registro inicial de demonstracao',
  'active'::public.record_status
from family_target ft
cross join (
  values
    ('Dr. Demo Cardio', 'Cardiologia', 'Clinica Demo 1'),
    ('Dra. Demo Endocrino', 'Endocrinologia', 'Clinica Demo 2'),
    ('Dr. Demo Checkup', 'Clinica Geral', 'Clinica Demo 3'),
    ('Dra. Demo Preventiva', 'Medicina Preventiva', 'Clinica Demo 4'),
    ('Dr. Demo Lab', 'Patologia Clinica', 'Laboratorio Demo')
) as d(doctor_name, specialty, clinic)
where not exists (
  select 1 from public.doctors dc
  where dc.family_id = ft.id
    and dc.doctor_name = d.doctor_name
);

with family_target as (
  select id from public.families
  where lower(name) = lower('Familia Seixas') and deleted_at is null
  limit 1
)
insert into public.health_exams (
  family_id,
  exam_name,
  category,
  periodicity,
  due_date,
  status,
  notes
)
select
  ft.id,
  e.exam_name,
  e.category,
  'Anual',
  e.due_date::date,
  e.status,
  'Exame inicial de demonstracao'
from family_target ft
cross join (
  values
    ('Hemograma', 'Laboratorial', '2026-09-10', 'A programar'),
    ('Perfil lipidico', 'Laboratorial', '2026-10-10', 'A programar'),
    ('Glicemia', 'Laboratorial', '2026-11-10', 'A programar'),
    ('ECG', 'Cardiaco', '2026-12-10', 'A programar'),
    ('Ultrassom abdominal', 'Imagem', '2026-08-10', 'Agendado'),
    ('Check-up clinico', 'Consulta', '2026-07-01', 'A programar')
) as e(exam_name, category, due_date, status)
where not exists (
  select 1 from public.health_exams he
  where he.family_id = ft.id
    and he.exam_name = e.exam_name
);

commit;
