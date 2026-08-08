begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.financial_entries
  add column if not exists classification_category_id uuid;

alter table public.financial_entries
  add constraint financial_entries_classification_category_family_fkey
  foreign key (classification_category_id, family_id)
  references public.financial_categories(id, family_id);

create index if not exists financial_entries_classification_category_idx
  on public.financial_entries(family_id, classification_category_id)
  where classification_category_id is not null and deleted_at is null;

comment on column public.financial_entries.classification_category_id is
  'Classificação secundária exibida como Tipo; não participa dos cálculos financeiros.';

commit;
