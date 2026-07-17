begin;

-- Aplicar somente no cutover da versao web que usa public.bootstrap_family.
-- Ate la, o Preview pode validar o fluxo novo sem interromper a versao atual.
revoke insert on table public.families from authenticated;

commit;
