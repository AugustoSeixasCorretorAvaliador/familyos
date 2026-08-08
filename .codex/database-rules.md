# Regras de banco e Supabase

## Projeto oficial

- Project ref: `ffzqloiwmbvbeycaevfm`.
- Antes de qualquer operacao remota, confirme que o projeto acessivel possui exatamente esse identificador.

## Acesso remoto pelo Codex

- O MCP configurado para este projeto e `supabase_familyos`.
- A autenticacao ativa usa `Authorization: Bearer` com o token fornecido exclusivamente pela variavel de ambiente `SUPABASE_FAMILYOS_TOKEN`.
- Nao execute `codex mcp login` para `supabase_familyos` e nao substitua essa configuracao por OAuth.
- Nunca grave, imprima, versione ou exponha o valor de `SUPABASE_FAMILYOS_TOKEN`.
- Esta autenticacao do MCP e separada da autenticacao dos usuarios da aplicacao FamilyOS.

## Migrations

- Toda mudanca de schema deve nascer em uma migration versionada.
- Migrations do MCP ficam em `mcp-server/supabase/migrations/`.
- Use nomes descritivos e operacoes idempotentes quando isso for seguro.
- Antes de aplicar, verifique o schema atual e o historico para evitar duplicidade.
- Depois de aplicar, valide objetos criados, grants, RLS, policies, indices, historico e advisors.
- Nao altere outras tabelas ou dados fora do escopo da migration.

## RLS e autorizacao

- Habilite RLS em toda tabela de schema exposto, incluindo `public`.
- Uma policy deve autorizar o recurso e a familia corretos; `TO authenticated` sozinho nao e autorizacao suficiente.
- Policies de `UPDATE` devem possuir `USING` e `WITH CHECK` coerentes.
- Evite `auth.role()`; use o `TO` da policy e predicados baseados no usuario/familia.
- Nunca use `user_metadata` como fonte de autorizacao. Use dados controlados pelo servidor ou `app_metadata` quando apropriado.
- Views expostas devem usar `security_invoker = true` quando suportado.
- Funcoes `SECURITY DEFINER` exigem justificativa, schema nao exposto, `search_path` seguro e grants explicitos.

## Chaves e clientes

- Frontend: somente publishable key ou anon key legada, sempre protegida por RLS.
- Backend confiavel: secret/service role somente quando realmente necessario.
- Nunca use `service_role` em componente cliente, variavel `NEXT_PUBLIC_`, log, teste versionado ou resposta HTTP.
- Operacoes do usuario devem preferir o JWT do proprio usuario para manter RLS ativa.

## Privilegios e desempenho

- Revogue privilegios amplos antes de conceder o conjunto minimo necessario.
- Crie indices para chaves estrangeiras e filtros reais, evitando indices redundantes.
- Execute advisors de seguranca e desempenho depois de DDL relevante.
- Registre avisos aceitos e sua justificativa no resultado da tarefa ou release.
