-- Substitui exclusivamente os dados dos cartões C6 e Bradesco a partir dos
-- CSVs corrigidos de agosto/2026. Mercado Pago e Porto Seguro ficam fora do
-- conjunto afetado e são protegidos por invariantes dentro da transação.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '60s';

create temporary table _card_import_stage (
  row_no integer primary key,
  provider text not null check (provider in ('C6', 'BRADESCO')),
  purchase_date date not null,
  source_type text not null check (source_type in ('parcelado', 'recorrente', 'avulsa')),
  source_card_final text not null,
  source_category text not null,
  description text not null,
  installment_current smallint,
  installment_total smallint,
  amount numeric(18,2) not null,
  object_id uuid not null default gen_random_uuid(),
  check (
    (source_type = 'parcelado' and installment_current between 1 and installment_total)
    or (source_type <> 'parcelado' and installment_current is null and installment_total is null)
  )
) on commit drop;

insert into _card_import_stage (
  row_no, provider, purchase_date, source_type, source_card_final,
  source_category, description, installment_current, installment_total, amount
) values
  (1, 'BRADESCO', '2026-03-05', 'parcelado', '7627', 'Vestuário / Roupas', 'AVIATOR', 5, 5, 84.24),
  (2, 'BRADESCO', '2026-04-28', 'parcelado', '7627', 'Varejos Diversos', 'GILBERTO ROLIM VA', 3, 4, 450.00),
  (3, 'BRADESCO', '2026-04-28', 'parcelado', '7627', 'Assistência médica e odontológica', 'DROGARIAS TAMOIO', 3, 6, 537.27),
  (4, 'BRADESCO', '2026-05-02', 'parcelado', '7627', 'Assistência médica e odontológica', 'RD SAUDE ONLINE', 3, 3, 106.73),
  (5, 'BRADESCO', '2026-05-07', 'parcelado', '7627', 'Assistência médica e odontológica', 'QUALIOTICA TIFFANY', 3, 12, 750.00),
  (6, 'BRADESCO', '2026-05-07', 'parcelado', '7627', 'Restaurante / Lanchonete / Bar', 'HACHI FRANQUIAS', 3, 3, 132.66),
  (7, 'BRADESCO', '2026-05-12', 'parcelado', '7627', 'Assistência médica e odontológica', 'RD SAUDE ONLINE', 3, 3, 218.78),
  (8, 'BRADESCO', '2026-05-19', 'parcelado', '7627', 'Assistência médica e odontológica', 'DROGARIA CRISTAL', 3, 3, 181.28),
  (9, 'BRADESCO', '2026-05-29', 'parcelado', '7627', 'Assistência médica e odontológica', 'RD SAUDE ONLINE', 2, 3, 129.72),
  (10, 'BRADESCO', '2026-06-11', 'parcelado', '7627', 'Assistência médica e odontológica', 'RD SAUDE ONLINE', 2, 3, 975.51),
  (11, 'BRADESCO', '2026-06-27', 'avulsa', '7627', 'Serviços Profissionais', 'NOSSO PARK ESTACIONAME', null, null, 15.00),
  (12, 'BRADESCO', '2026-06-27', 'avulsa', '7627', 'Restaurante / Lanchonete / Bar', 'SABOR DE MINAS', null, null, 96.12),
  (13, 'BRADESCO', '2026-06-28', 'avulsa', '7627', 'Restaurante / Lanchonete / Bar', 'SANTA MARTA BACKER', null, null, 53.96),
  (14, 'BRADESCO', '2026-06-30', 'parcelado', '7627', 'Assistência médica e odontológica', 'RD SAUDE ONLINE', 1, 3, 81.48),
  (15, 'BRADESCO', '2026-07-01', 'parcelado', '7627', 'Assistência médica e odontológica', 'RD SAUDE ONLINE', 1, 6, 666.35),
  (16, 'BRADESCO', '2026-07-03', 'avulsa', '7627', 'Departamento / Desconto', 'ALIEXPRESS', null, null, 340.91),
  (17, 'BRADESCO', '2026-07-04', 'avulsa', '7627', 'Especialidade varejo', 'PICPAY*MUNDIALNITERO', null, null, 823.49),
  (18, 'BRADESCO', '2026-07-04', 'avulsa', '7627', 'Departamento / Desconto', 'ALIEXPRESS', null, null, 80.25),
  (19, 'BRADESCO', '2026-07-06', 'parcelado', '7627', 'Assistência médica e odontológica', 'RD SAUDE ONLINE', 1, 3, 63.82),
  (20, 'BRADESCO', '2026-07-06', 'parcelado', '7627', 'Serviços Profissionais', 'CERTIFICADOR*0014', 1, 3, 84.30),
  (21, 'BRADESCO', '2026-07-07', 'avulsa', '7627', 'Assistência médica e odontológica', 'RD SAUDE ONLINE', null, null, 74.89),
  (22, 'BRADESCO', '2026-07-07', 'avulsa', '7627', 'Departamento / Desconto', 'ALIEXPRESS', null, null, 172.68),
  (23, 'BRADESCO', '2026-07-10', 'avulsa', '7627', 'Varejos Diversos', 'EBERSONDO', null, null, 65.00),
  (24, 'BRADESCO', '2026-07-16', 'avulsa', '7627', 'Assistência médica e odontológica', 'RD SAUDE ONLINE', null, null, 73.54),
  (25, 'BRADESCO', '2026-07-18', 'avulsa', '7627', 'Restaurante / Lanchonete / Bar', 'MAIS 1 BAR', null, null, 188.43),
  (26, 'BRADESCO', '2026-07-20', 'avulsa', '7627', 'Assistência médica e odontológica', 'RD SAUDE ONLINE', null, null, 153.35),
  (27, 'BRADESCO', '2026-07-20', 'avulsa', '7627', 'Especialidade varejo', 'NESCAFE DOLCE GUSTO', null, null, 189.90),
  (28, 'BRADESCO', '2026-07-21', 'avulsa', '7627', 'Especialidade varejo', 'PICPAY*MUNDIALNITERO', null, null, 1009.83),
  (29, 'BRADESCO', '2026-07-22', 'avulsa', '7627', 'Restaurante / Lanchonete / Bar', 'HACHIKO 1', null, null, 95.99),
  (30, 'BRADESCO', '2026-07-23', 'avulsa', '7627', 'Especialidade varejo', 'NESCAFE DOLCE GUSTO', null, null, 94.50),
  (31, 'BRADESCO', '2026-07-24', 'avulsa', '7627', 'Varejos Diversos', 'LOJA 13', null, null, 13.99),
  (32, 'BRADESCO', '2026-07-27', 'avulsa', '7627', 'Assistência médica e odontológica', 'RD SAUDE ONLINE', null, null, 118.20),
  (33, 'BRADESCO', '2026-07-27', 'avulsa', '7627', 'Seguro', 'SEGURO SUPERPROTEGIDO', null, null, 6.99),
  (34, 'BRADESCO', '2025-11-04', 'parcelado', '7528', 'Serviços Profissionais', 'CERTISIGN', 9, 12, 21.07),
  (35, 'BRADESCO', '2025-11-28', 'parcelado', '7528', 'Vestuário / Roupas', 'CENTAURO.COM', 8, 11, 31.81),
  (36, 'BRADESCO', '2025-11-30', 'parcelado', '7528', 'Assistência médica e odontológica', 'DROGARIA VENANCIO', 8, 10, 299.90),
  (37, 'BRADESCO', '2026-01-23', 'parcelado', '7528', 'Departamento / Desconto', 'MP*MERCADOLIVRE', 7, 7, 51.28),
  (38, 'C6', '2025-12-15', 'parcelado', '1580', 'Vestuário / Roupas', 'E-COMMERCE', 8, 10, 60.21),
  (39, 'C6', '2026-01-14', 'parcelado', '1580', 'Governo', 'CRECI*CRECI', 7, 12, 76.50),
  (40, 'C6', '2026-08-03', 'recorrente', '3172', '-', 'Estorno Tarifa', null, null, -98.00),
  (41, 'C6', '2026-08-03', 'recorrente', '3172', '-', 'Anuidade Diferenciada', null, null, 98.00),
  (42, 'C6', '2026-02-09', 'parcelado', '4611', 'Assistência médica e odontológica', 'DROGARIAS PACHECO S.A.', 6, 6, 501.12),
  (43, 'C6', '2026-04-16', 'parcelado', '4611', 'Recreativo', 'COMPROP*FLEXMOBI MOBIL', 4, 21, 400.00),
  (44, 'C6', '2026-04-17', 'parcelado', '4611', 'Empresa para empresa', 'SHOPEE *GLOBILIASELECA', 4, 12, 90.56),
  -- Regra solicitada: 03/mar deve ser interpretado como 02/03.
  (45, 'C6', '2026-05-10', 'parcelado', '4611', 'Serviços Profissionais', 'TICKETMASTER*CFAAFA0DA', 2, 3, 214.50),
  (46, 'C6', '2026-05-12', 'parcelado', '4611', 'Departamento / Desconto', 'MERCADOLIVRE*MERCADOL', 3, 10, 543.89),
  (47, 'C6', '2026-05-12', 'parcelado', '4611', 'Especialidade varejo', 'ZEE NOW     *ZEE NOW', 2, 3, 43.32),
  (48, 'C6', '2026-05-21', 'parcelado', '4611', 'Especialidade varejo', 'ZEE NOW     *ZEE NOW', 2, 3, 74.05),
  (49, 'C6', '2026-06-21', 'parcelado', '4611', 'Especialidade varejo', 'ZEE NOW     *ZEE NOW', 2, 3, 71.39),
  (50, 'C6', '2026-07-08', 'recorrente', '4611', 'Seguro', 'TOKIO MARINE*RESI14D36', null, null, 17.07),
  (51, 'C6', '2026-07-10', 'recorrente', '4611', 'Seguro', 'AMIL DENTAL SP RECORRE', null, null, 5296.66),
  (52, 'C6', '2026-07-11', 'recorrente', '4611', 'Seguro', 'AMIL DENTAL SP RECORRE', null, null, 42.31),
  (53, 'C6', '2026-07-13', 'avulsa', '4611', 'Entretenimento', 'APPLE.COM/BILL', null, null, 49.99),
  (54, 'C6', '2026-07-14', 'recorrente', '4611', 'Entretenimento', 'APPLE.COM/BILL', null, null, 99.90),
  (55, 'C6', '2026-07-17', 'recorrente', '4611', 'Seguro', 'TOKIO MARINE*RESI25D36', null, null, 15.59),
  (56, 'C6', '2026-07-17', 'avulsa', '4611', 'Especialidade varejo', 'ZEE NOW     *ZEE NOW', null, null, 129.98),
  (57, 'C6', '2026-07-20', 'recorrente', '4611', 'Seguro', 'TOKIO MARINE*RESI25D36', null, null, 10.88),
  (58, 'C6', '2026-07-23', 'recorrente', '4611', 'Seguro', 'PETLOVE SAUD*PETLOVE S', null, null, 291.67),
  (59, 'C6', '2026-07-27', 'recorrente', '4611', 'Seguro', 'AMIL DENTAL SP RECORRE', null, null, 253.98),
  (60, 'C6', '2026-07-27', 'avulsa', '4611', 'Restaurante / Lanchonete / Bar', 'COMENDADOR B R LTDA', null, null, 268.02),
  (61, 'C6', '2026-07-29', 'recorrente', '4611', 'Entretenimento', 'APPLE.COM/BILL', null, null, 33.00),
  (62, 'C6', '2026-08-05', 'recorrente', '4611', 'Varejos Diversos', 'SEG FATURA PROTEG AGO/26', null, null, 9.90),
  (63, 'C6', '2026-08-05', 'recorrente', '4611', 'Elétrico', 'OPENAI *CHATGPT SUBSCR SA', null, null, 105.09),
  (64, 'C6', '2026-08-05', 'recorrente', '4611', 'Elétrico', 'OPENAI *CHATGPT SUBSCR SA', null, null, 3.68);

do $$
begin
  if (select count(*) from _card_import_stage where provider = 'BRADESCO') <> 37
     or (select count(*) from _card_import_stage where provider = 'C6') <> 27 then
    raise exception 'A carga CSV não contém os totais esperados (Bradesco=37, C6=27).';
  end if;
end $$;

create temporary table _migration_context (
  family_id uuid not null,
  c6_card_id uuid not null,
  bradesco_card_id uuid not null,
  c6_category_id uuid not null,
  bradesco_category_id uuid not null
) on commit drop;

do $$
declare
  v_family_id uuid;
  v_c6_card_id uuid;
  v_bradesco_card_id uuid;
  v_c6_category_id uuid;
  v_bradesco_category_id uuid;
begin
  select id into strict v_family_id
  from public.families
  where name = 'Familia Seixas' and deleted_at is null;

  select id into strict v_c6_card_id
  from public.credit_cards
  where family_id = v_family_id
    and institution = 'C6 Bank'
    and last_four = '1580'
    and deleted_at is null;

  select id into strict v_bradesco_card_id
  from public.credit_cards
  where family_id = v_family_id
    and institution = 'Bradesco'
    and deleted_at is null;

  select id into strict v_c6_category_id
  from public.financial_categories
  where family_id = v_family_id
    and name = 'Cartão de Crédito C6'
    and deleted_at is null;

  select id into strict v_bradesco_category_id
  from public.financial_categories
  where family_id = v_family_id
    and name = 'Cartão de Crédito Bradesco'
    and deleted_at is null;

  insert into _migration_context values (
    v_family_id, v_c6_card_id, v_bradesco_card_id,
    v_c6_category_id, v_bradesco_category_id
  );
end $$;

-- Congela exatamente o conjunto afetado antes de renomear/unificar cartões.
create temporary table _affected_cards on commit drop as
select cc.id
from public.credit_cards cc
join _migration_context ctx on ctx.family_id = cc.family_id
where cc.deleted_at is null
  and (cc.institution = 'C6 Bank' or cc.institution = 'Bradesco');

-- Invariantes dos cartões explicitamente preservados.
create temporary table _protected_before on commit drop as
select cc.id,
       cc.name,
       cc.institution,
       cc.last_four,
       cc.metadata,
       (select count(*) from public.financial_entries e where e.card_id = cc.id and e.deleted_at is null) entry_count,
       (select count(*) from public.recurrences r where r.card_id = cc.id and r.deleted_at is null) recurrence_count,
       (select count(*) from public.installment_purchases i where i.card_id = cc.id and i.deleted_at is null) installment_count,
       (select count(*) from public.card_invoices f where f.card_id = cc.id and f.deleted_at is null) invoice_count
from public.credit_cards cc
join _migration_context ctx on ctx.family_id = cc.family_id
where cc.deleted_at is null
  and cc.institution in ('Mercado Pago', 'Porto Seguro');

-- Registros apenas vinculados por engano a C6/Bradesco devem permanecer
-- visíveis para arquivamento manual: Mercado Pago, Porto Seguro, receitas,
-- aluguéis e encargos imobiliários.
create temporary table _preserved_recurrences on commit drop as
select r.id
from public.recurrences r
where r.deleted_at is null
  and r.card_id in (select id from _affected_cards)
  and (
    r.rule ? 'lease_contract_id'
    or r.rule ? 'property_id'
    or lower(coalesce(r.rule ->> 'external_id', '')) like '%porto%'
    or lower(coalesce(r.description, '')) like 'aluguel%'
    or lower(coalesce(r.description, '')) like 'property_tax%'
    or lower(coalesce(r.description, '')) like 'rental_%'
    or lower(coalesce(r.description, '')) like 'condominio%'
  );

create temporary table _preserved_entries on commit drop as
select e.id
from public.financial_entries e
where e.deleted_at is null
  and e.card_id in (select id from _affected_cards)
  and (
    coalesce(e.metadata ->> 'dataset', '') in ('rental_income', 'rental_charges')
    or e.recurrence_id in (select id from _preserved_recurrences)
    or lower(coalesce(e.source_key, '')) like '%mpago%'
    or lower(coalesce(e.source_key, '')) like '%mercado-pago%'
    or lower(coalesce(e.source_key, '')) like '%porto%'
    or lower(coalesce(e.metadata ->> 'external_id', '')) like '%mpago%'
    or lower(coalesce(e.metadata ->> 'external_id', '')) like '%mercado-pago%'
    or lower(coalesce(e.metadata ->> 'external_id', '')) like '%porto%'
  );

-- Limpeza lógica: mantém auditoria e possibilidade de recuperação.
update public.financial_entries
set deleted_at = now(), updated_at = now()
where deleted_at is null
  and card_id in (select id from _affected_cards)
  and id not in (select id from _preserved_entries);

update public.card_invoices
set deleted_at = now(), updated_at = now()
where deleted_at is null and card_id in (select id from _affected_cards);

update public.recurrences
set deleted_at = now(), active = false, updated_at = now()
where deleted_at is null
  and card_id in (select id from _affected_cards)
  and id not in (select id from _preserved_recurrences);

update public.installment_purchases
set deleted_at = now(), status = 'cancelled', updated_at = now()
where deleted_at is null and card_id in (select id from _affected_cards);

-- Um único cartão ativo para cada instituição solicitada.
update public.credit_cards cc
set name = 'C6 final 1585',
    last_four = '1585',
    active = true,
    metadata = cc.metadata || jsonb_build_object(
      'external_id', 'card-c6-1585',
      'csv_migration', '2026-08-corrected',
      'unified_from_finals', jsonb_build_array('1580', '3172', '4611')
    ),
    updated_at = now()
from _migration_context ctx
where cc.id = ctx.c6_card_id;

update public.credit_cards cc
set name = 'BRADESCO',
    active = true,
    metadata = cc.metadata || jsonb_build_object(
      'external_id', 'card-bradesco',
      'csv_migration', '2026-08-corrected',
      'unified_from_finals', jsonb_build_array('7627', '7528')
    ),
    updated_at = now()
from _migration_context ctx
where cc.id = ctx.bradesco_card_id;

update public.credit_cards cc
set deleted_at = now(), active = false, updated_at = now()
from _migration_context ctx
where cc.family_id = ctx.family_id
  and cc.institution = 'C6 Bank'
  and cc.id <> ctx.c6_card_id
  and cc.deleted_at is null;

-- Parcelamentos: agosto é a primeira competência importada, mas o número da
-- parcela preserva a posição indicada no CSV corrigido.
insert into public.installment_purchases (
  id, family_id, card_id, category_id, description, total_amount,
  installment_count, first_competence, purchase_date, status
)
select s.object_id,
       ctx.family_id,
       case s.provider when 'C6' then ctx.c6_card_id else ctx.bradesco_card_id end,
       case s.provider when 'C6' then ctx.c6_category_id else ctx.bradesco_category_id end,
       s.description,
       abs(s.amount) * s.installment_total,
       s.installment_total,
       (date '2026-08-01' - make_interval(months => s.installment_current - 1))::date,
       s.purchase_date,
       'active'
from _card_import_stage s
cross join _migration_context ctx
where s.source_type = 'parcelado';

-- Recorrências sem end_date representam duração indefinida. A aplicação
-- materializa continuamente os meses futuros em janela móvel.
insert into public.recurrences (
  id, family_id, frequency, interval_value, day_of_month, start_date,
  end_date, next_occurrence, rule, active, description, category_id,
  card_id, expected_amount, entry_type
)
select s.object_id,
       ctx.family_id,
       'monthly',
       1,
       extract(day from s.purchase_date)::integer,
       make_date(2026, 8, least(extract(day from s.purchase_date)::integer, 31)),
       null,
       make_date(2026, 9, least(extract(day from s.purchase_date)::integer, 30)),
       jsonb_build_object(
         'csv_migration', '2026-08-corrected',
         'source_row', s.row_no,
         'source_card_final', s.source_card_final,
         'source_category', s.source_category,
         'indefinite', true
       ),
       true,
       s.description,
       case s.provider when 'C6' then ctx.c6_category_id else ctx.bradesco_category_id end,
       case s.provider when 'C6' then ctx.c6_card_id else ctx.bradesco_card_id end,
       abs(s.amount),
       case when s.amount < 0 then 'reversal' else 'expense' end
from _card_import_stage s
cross join _migration_context ctx
where s.source_type = 'recorrente';

-- Parcelas restantes, começando em agosto/2026.
insert into public.financial_entries (
  family_id, category_id, classification_category_id, card_id,
  installment_purchase_id, competence, due_date, expected_date,
  entry_type, cash_direction, purchase_kind, description, notes,
  expected_amount, status, installment_number, installment_count,
  origin, source_key, metadata
)
select ctx.family_id,
       case s.provider when 'C6' then ctx.c6_category_id else ctx.bradesco_category_id end,
       cat.id,
       case s.provider when 'C6' then ctx.c6_card_id else ctx.bradesco_card_id end,
       s.object_id,
       (date '2026-08-01' + make_interval(months => n.number - s.installment_current))::date,
       (date_trunc('month', date '2026-08-01' + make_interval(months => n.number - s.installment_current)) + interval '1 month - 1 day')::date,
       (date_trunc('month', date '2026-08-01' + make_interval(months => n.number - s.installment_current)) + interval '1 month - 1 day')::date,
       'expense', 'outflow', 'installment', s.description,
       format('Parcela %s/%s; origem CSV %s; cartão de origem final %s.', n.number, s.installment_total, s.provider, s.source_card_final),
       abs(s.amount), 'payable', n.number, s.installment_total,
       'installment',
       format('csv-card-import:2026-08:%s:%s:installment:%s', lower(s.provider), s.row_no, n.number),
       jsonb_build_object(
         'csv_migration', '2026-08-corrected',
         'source_row', s.row_no,
         'source_type', s.source_type,
         'source_card_final', s.source_card_final,
         'source_category', s.source_category,
         'source_purchase_date', s.purchase_date,
         'parcela', format('%s/%s', n.number, s.installment_total)
       )
from _card_import_stage s
cross join _migration_context ctx
cross join lateral generate_series(s.installment_current::integer, s.installment_total::integer) n(number)
left join lateral (
  select fc.id
  from public.financial_categories fc
  where fc.family_id = ctx.family_id
    and fc.deleted_at is null
    and fc.name = case
      when s.source_category in ('Assistência médica e odontológica') then 'Saúde'
      when s.source_category in ('Restaurante / Lanchonete / Bar') then 'Alimentação'
      when s.source_category in ('Seguro') then 'Seguros'
      when s.source_category in ('Entretenimento', 'Elétrico') then 'Software e assinaturas'
      when s.source_category in ('Serviços Profissionais', 'Governo') then 'Serviços e utilidades'
      else 'Compras'
    end
  limit 1
) cat on true
where s.source_type = 'parcelado';

-- Compras únicas (AVULSA -> ÚNICA) somente em agosto/2026.
insert into public.financial_entries (
  family_id, category_id, classification_category_id, card_id,
  competence, due_date, expected_date, entry_type, cash_direction,
  purchase_kind, description, notes, expected_amount, status, origin,
  source_key, metadata
)
select ctx.family_id,
       case s.provider when 'C6' then ctx.c6_category_id else ctx.bradesco_category_id end,
       cat.id,
       case s.provider when 'C6' then ctx.c6_card_id else ctx.bradesco_card_id end,
       date '2026-08-01', date '2026-08-31', date '2026-08-31',
       'expense', 'outflow', 'one_off', s.description,
       format('ÚNICA; origem CSV %s; cartão de origem final %s.', s.provider, s.source_card_final),
       abs(s.amount), 'payable', 'import',
       format('csv-card-import:2026-08:%s:%s:unique', lower(s.provider), s.row_no),
       jsonb_build_object(
         'csv_migration', '2026-08-corrected',
         'source_row', s.row_no,
         'source_type', s.source_type,
         'source_card_final', s.source_card_final,
         'source_category', s.source_category,
         'source_purchase_date', s.purchase_date,
         'parcela', 'ÚNICA'
       )
from _card_import_stage s
cross join _migration_context ctx
left join lateral (
  select fc.id
  from public.financial_categories fc
  where fc.family_id = ctx.family_id
    and fc.deleted_at is null
    and fc.name = case
      when s.source_category in ('Assistência médica e odontológica') then 'Saúde'
      when s.source_category in ('Restaurante / Lanchonete / Bar') then 'Alimentação'
      when s.source_category in ('Seguro') then 'Seguros'
      when s.source_category in ('Entretenimento', 'Elétrico') then 'Software e assinaturas'
      when s.source_category in ('Serviços Profissionais', 'Governo') then 'Serviços e utilidades'
      else 'Compras'
    end
  limit 1
) cat on true
where s.source_type = 'avulsa';

-- Primeira ocorrência de cada recorrência. end_date permanece nulo; os meses
-- seguintes são gerados pela janela móvel do FamilyOS.
insert into public.financial_entries (
  family_id, category_id, classification_category_id, card_id,
  recurrence_id, competence, due_date, expected_date, entry_type,
  cash_direction, purchase_kind, description, notes, expected_amount,
  status, origin, source_key, metadata
)
select ctx.family_id,
       case s.provider when 'C6' then ctx.c6_category_id else ctx.bradesco_category_id end,
       cat.id,
       case s.provider when 'C6' then ctx.c6_card_id else ctx.bradesco_card_id end,
       s.object_id,
       date '2026-08-01',
       make_date(2026, 8, least(extract(day from s.purchase_date)::integer, 31)),
       make_date(2026, 8, least(extract(day from s.purchase_date)::integer, 31)),
       case when s.amount < 0 then 'reversal' else 'expense' end,
       case when s.amount < 0 then 'none' else 'outflow' end,
       'recurring', s.description,
       format('RECORRENTE sem data final; origem CSV C6; cartão de origem final %s.', s.source_card_final),
       abs(s.amount), 'payable', 'recurrence',
       format('csv-card-import:2026-08:%s:%s:recurrence:2026-08', lower(s.provider), s.row_no),
       jsonb_build_object(
         'csv_migration', '2026-08-corrected',
         'source_row', s.row_no,
         'source_type', s.source_type,
         'source_card_final', s.source_card_final,
         'source_category', s.source_category,
         'source_purchase_date', s.purchase_date,
         'indefinite', true
       )
from _card_import_stage s
cross join _migration_context ctx
left join lateral (
  select fc.id
  from public.financial_categories fc
  where fc.family_id = ctx.family_id
    and fc.deleted_at is null
    and fc.name = case
      when s.source_category in ('Assistência médica e odontológica') then 'Saúde'
      when s.source_category in ('Restaurante / Lanchonete / Bar') then 'Alimentação'
      when s.source_category in ('Seguro') then 'Seguros'
      when s.source_category in ('Entretenimento', 'Elétrico') then 'Software e assinaturas'
      when s.source_category in ('Serviços Profissionais', 'Governo') then 'Serviços e utilidades'
      else 'Compras'
    end
  limit 1
) cat on true
where s.source_type = 'recorrente';

-- Uma fatura de agosto por cartão, somando despesas e descontando estornos.
insert into public.card_invoices (
  id, family_id, card_id, competence, due_date, expected_amount, status, notes
)
select gen_random_uuid(),
       ctx.family_id,
       card.id,
       date '2026-08-01',
       date '2026-08-31',
       sum(case when e.entry_type = 'reversal' then -e.expected_amount else e.expected_amount end),
       'open',
       'Fatura reconstruída pelos CSVs corrigidos de agosto/2026.'
from _migration_context ctx
cross join lateral (values (ctx.c6_card_id), (ctx.bradesco_card_id)) card(id)
join public.financial_entries e
  on e.family_id = ctx.family_id
 and e.card_id = card.id
 and e.competence = date '2026-08-01'
 and e.deleted_at is null
 and e.source_key like 'csv-card-import:2026-08:%'
group by ctx.family_id, card.id;

update public.financial_entries e
set card_invoice_id = f.id, updated_at = now()
from public.card_invoices f
join _migration_context ctx on ctx.family_id = f.family_id
where e.family_id = ctx.family_id
  and e.card_id = f.card_id
  and e.competence = f.competence
  and e.competence = date '2026-08-01'
  and e.deleted_at is null
  and e.source_key like 'csv-card-import:2026-08:%'
  and f.deleted_at is null;

-- Validação transacional: qualquer divergência aborta tudo.
do $$
declare
  ctx _migration_context%rowtype;
  v_protected_after jsonb;
  v_protected_before jsonb;
begin
  select * into strict ctx from _migration_context;

  if (select count(*) from public.credit_cards
      where family_id = ctx.family_id and institution = 'C6 Bank'
        and deleted_at is null and active) <> 1 then
    raise exception 'A unificação do C6 não resultou em exatamente um cartão ativo.';
  end if;

  if not exists (
    select 1 from public.credit_cards
    where id = ctx.c6_card_id and name = 'C6 final 1585'
      and last_four = '1585' and deleted_at is null and active
  ) then
    raise exception 'O cartão único C6 final 1585 não foi configurado corretamente.';
  end if;

  if (select count(*) from public.credit_cards
      where family_id = ctx.family_id and institution = 'Bradesco'
        and deleted_at is null and active and name = 'BRADESCO') <> 1 then
    raise exception 'A unificação do BRADESCO não resultou em exatamente um cartão ativo.';
  end if;

  if (select count(*) from public.installment_purchases
      where family_id = ctx.family_id and card_id = ctx.c6_card_id and deleted_at is null) <> 10
     or (select count(*) from public.recurrences
      where family_id = ctx.family_id and card_id = ctx.c6_card_id and deleted_at is null
        and end_date is null and active and rule ->> 'csv_migration' = '2026-08-corrected') <> 14
     or (select count(*) from public.financial_entries
      where family_id = ctx.family_id and card_id = ctx.c6_card_id and deleted_at is null
        and source_key like 'csv-card-import:2026-08:%') <> 70 then
    raise exception 'Os totais importados do C6 divergiram do esperado.';
  end if;

  if (select count(*) from public.installment_purchases
      where family_id = ctx.family_id and card_id = ctx.bradesco_card_id and deleted_at is null) <> 18
     or (select count(*) from public.recurrences
      where family_id = ctx.family_id and card_id = ctx.bradesco_card_id and deleted_at is null
        and rule ->> 'csv_migration' = '2026-08-corrected') <> 0
     or (select count(*) from public.financial_entries
      where family_id = ctx.family_id and card_id = ctx.bradesco_card_id and deleted_at is null
        and source_key like 'csv-card-import:2026-08:%') <> 71 then
    raise exception 'Os totais importados do Bradesco divergiram do esperado.';
  end if;

  if exists (
    select 1
    from _preserved_entries p
    left join public.financial_entries e on e.id = p.id and e.deleted_at is null
    where e.id is null
  ) then
    raise exception 'Um lançamento reservado para arquivamento manual foi excluído.';
  end if;

  if exists (
    select 1
    from _preserved_recurrences p
    left join public.recurrences r on r.id = p.id and r.deleted_at is null and r.active
    where r.id is null
  ) then
    raise exception 'Uma recorrência reservada para arquivamento manual foi excluída.';
  end if;

  select jsonb_agg(to_jsonb(x) order by x.id)
  into v_protected_before
  from _protected_before x;

  select jsonb_agg(to_jsonb(x) order by x.id)
  into v_protected_after
  from (
    select cc.id,
           cc.name,
           cc.institution,
           cc.last_four,
           cc.metadata,
           (select count(*) from public.financial_entries e where e.card_id = cc.id and e.deleted_at is null) entry_count,
           (select count(*) from public.recurrences r where r.card_id = cc.id and r.deleted_at is null) recurrence_count,
           (select count(*) from public.installment_purchases i where i.card_id = cc.id and i.deleted_at is null) installment_count,
           (select count(*) from public.card_invoices f where f.card_id = cc.id and f.deleted_at is null) invoice_count
    from public.credit_cards cc
    where cc.family_id = ctx.family_id
      and cc.deleted_at is null
      and cc.institution in ('Mercado Pago', 'Porto Seguro')
  ) x;

  if v_protected_before is distinct from v_protected_after then
    raise exception 'Mercado Pago ou Porto Seguro sofreu alteração; transação abortada.';
  end if;

  if exists (
    select 1
    from public.financial_entries e
    where e.family_id = ctx.family_id
      and e.deleted_at is null
      and e.source_key like 'csv-card-import:2026-08:%'
      and (e.category_id is null or e.classification_category_id is null)
  ) then
    raise exception 'Há lançamento importado sem categoria principal ou classificação.';
  end if;
end $$;

commit;
