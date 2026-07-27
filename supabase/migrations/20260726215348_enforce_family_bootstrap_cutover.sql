begin;

-- Cutover incremental: a criacao direta de familias deixa de ser uma operacao
-- do Data API. O fluxo oficial permanece em public.bootstrap_family(text, text).
revoke insert on table public.families from authenticated;

commit;
