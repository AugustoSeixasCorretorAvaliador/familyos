begin;

alter table public.documents
  add column if not exists property_id uuid;

-- A chave composta impede vincular documento de uma familia a imovel de outra.
create unique index if not exists properties_id_family_unique
  on public.properties(id, family_id);

do $constraint$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'documents_property_family_fkey'
      and conrelid = 'public.documents'::regclass
  ) then
    alter table public.documents
      add constraint documents_property_family_fkey
      foreign key (property_id, family_id)
      references public.properties(id, family_id)
      on update cascade
      on delete restrict;
  end if;
end
$constraint$;

create index if not exists idx_documents_family_property
  on public.documents(family_id, property_id, created_at desc)
  where property_id is not null;

-- Inclui TIFF para documentos patrimoniais digitalizados.
update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array[
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/tiff',
  'image/tif'
]
where id = 'family-documents';

commit;
