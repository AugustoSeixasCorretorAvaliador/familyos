# Recuperação e validação do Supabase

Data do checkpoint: 26/07/2026 19:16:57 -03:00  
Projeto confirmado e vinculado: `ffzqloiwmbvbeycaevfm` (`familyos`)  
CLI: Supabase 2.109.1  
Escopo: baseline, push aprovado e validação remota pós-aplicação

Este relatório não contém tokens, chaves, senhas ou connection strings.

## Conclusão executiva

A Estratégia C foi concluída e as duas migrations incrementais aprovadas foram aplicadas no remoto:

1. `20260726215348_enforce_family_bootstrap_cutover.sql`
2. `20260726215403_create_financial_patrimonial_core.sql`

O `migration list --linked` pós-push mostra todos os oito timestamps alinhados entre local e remoto. Nenhuma migration adicional foi aplicada.

O catálogo remoto confirmou 12 tabelas financeiras, RLS em todas, 34 policies familiares, zero grants para `anon`, constraints validadas, função privada e 23 triggers. Lint, typecheck, 99 testes e build passaram.

**DB PUSH EXECUTADO. LIBERADO PARA AS FASES 3 E 4**, com findings informativos de performance registrados para tratamento incremental posterior.

## Baseline remoto reproduzido localmente

| Migration remota | Arquivo local anterior | Arquivo baseline novo | Evidência | Situação |
| --- | --- | --- | --- | --- |
| `20260716193333_create_mcp_audit_logs.sql` | `mcp-server/supabase/migrations/20260716120000_create_mcp_audit_logs.sql` | `supabase/migrations/20260716193333_create_mcp_audit_logs.sql` | Efeito SQL idêntico ignorando somente whitespace; MD5 compacto `35fdfc2d7b3d4025a6b539b8601f286a` | Alinhada |
| `20260716195307_harden_mcp_audit_and_families_rls.sql` | `mcp-server/supabase/migrations/20260716_harden_mcp_audit_and_families_rls.sql` | `supabase/migrations/20260716195307_harden_mcp_audit_and_families_rls.sql` | Efeito SQL idêntico ignorando somente whitespace; MD5 compacto `3454bb85cc389ec3fc88135886cdda7c` | Alinhada |
| `20260717151805_reconcile_production_crud_schema.sql` | `20260717141223_reconcile_production_crud_schema.sql` | `20260717151805_reconcile_production_crud_schema.sql` | SQL normalizado idêntico; MD5 `7abb82ad308d2ee09775cb07fc639205` | Substituída na cadeia ativa |
| `20260717151819_secure_family_bootstrap_and_invitations.sql` | `20260717141228_secure_family_bootstrap_and_invitations.sql` | `20260717151819_secure_family_bootstrap_and_invitations.sql` | SQL normalizado idêntico; MD5 `2ec0c6e5fe3bce440c66a2529570dafc` | Substituída na cadeia ativa |
| `20260717151831_link_documents_to_properties.sql` | `20260717141233_link_documents_to_properties.sql` | `20260717151831_link_documents_to_properties.sql` | SQL normalizado idêntico; MD5 `ad91ae3d5acc0892aa57a5f65a96ba28` | Substituída na cadeia ativa |
| `20260717152559_create_family_consolidation_backups.sql` | Mesmo arquivo/timestamp | Mesmo arquivo/timestamp | Já sincronizada | Mantida |

Os dois arquivos originais do MCP permanecem intactos em `mcp-server/supabase/migrations/`. As cópias na raiz possuem apenas um comentário adicional identificando que são baselines do histórico compartilhado; nenhuma operação SQL funcional foi acrescentada.

## Rastreabilidade do cutover

O arquivo antigo foi retirado da cadeia ativa e preservado integralmente em:

`docs/archive/migrations/20260717144000_enforce_family_bootstrap_cutover.sql`

O conteúdo arquivado foi comparado com `HEAD` e permanece idêntico. Ele saiu de `supabase/migrations/` porque seu timestamp era anterior a migrations já registradas no remoto.

A CLI criou a substituição incremental:

```text
20260726215348_enforce_family_bootstrap_cutover.sql
```

Seu único efeito funcional é:

```sql
revoke insert on table public.families from authenticated;
```

O `REVOKE` é idempotente, não altera dados, não cria objetos e não inclui os findings de privilégios antigos.

## Rastreabilidade da migration financeira

O cutover gerado às `21:53:48` ficou posterior ao timestamp financeiro antigo. Para preservar a ordem cronológica, o arquivo financeiro foi renomeado sem duplicação:

| Arquivo anterior | Arquivo atual | Conteúdo funcional |
| --- | --- | --- |
| `20260726210300_create_financial_patrimonial_core.sql` | `20260726215403_create_financial_patrimonial_core.sql` | Preservado integralmente |

A ordem final da cadeia ativa é:

```text
histórico remoto reproduzido localmente
→ 20260726215348_enforce_family_bootstrap_cutover.sql
→ 20260726215403_create_financial_patrimonial_core.sql
```

## Resultado de `migration list --linked`

```text
Local            Remote
20260716193333    20260716193333
20260716195307    20260716195307
20260717151805    20260717151805
20260717151819    20260717151819
20260717151831    20260717151831
20260717152559    20260717152559
20260726215348    —
20260726215403    —
```

Resultado: nenhuma migration remota sem arquivo local, nenhuma migration antiga local divergente e somente as duas incrementais esperadas pendentes.

## Resultado do dry-run

Comando executado:

```powershell
npx --no-install supabase db push --linked --dry-run
```

Saída relevante:

```text
DRY RUN: migrations will *not* be pushed to the database.
Would push these migrations:
 • 20260726215348_enforce_family_bootstrap_cutover.sql
 • 20260726215403_create_financial_patrimonial_core.sql
```

- Nenhuma baseline apareceu para execução.
- Nenhum warning foi emitido.
- Nenhuma alteração remota foi realizada.

## Análise SQL do dry-run

### Cutover `20260726215348`

- Revoga somente `INSERT` direto de `authenticated` em `public.families`.
- Não revoga `SELECT`, `UPDATE` ou `DELETE` de nenhuma tabela.
- Não altera RLS, policies, funções, triggers, índices, constraints ou dados.
- Não toca nos privilégios preexistentes `TRUNCATE`, `REFERENCES` e `TRIGGER`.

### Financeiro `20260726215403`

Tabelas criadas:

- `financial_categories`
- `credit_cards`
- `property_units`
- `lease_contracts`
- `lease_owner_shares`
- `investment_assets`
- `investment_positions`
- `installment_purchases`
- `card_invoices`
- `financial_entries`
- `financial_entry_history`
- `financial_alert_rules`

Alterações em tabelas existentes:

- `accounts`: `opening_balance`, `opening_balance_date` e `is_demo`.
- `properties`: `is_demo`.
- `recurrences`: descrição, categoria, conta, cartão, responsável, valor esperado, tipo, demo e soft delete.
- Índices únicos `(id, family_id)` são garantidos antes das FKs compostas dependentes.

Segurança e acesso:

- RLS habilitada nas 12 tabelas novas.
- 12 policies de leitura por membro da família.
- 11 policies de inserção por editor e 11 de atualização por editor, todas isoladas por `family_id`.
- `anon` recebe `REVOKE ALL` e nenhum grant posterior.
- As 11 tabelas operacionais concedem somente `SELECT`, `INSERT` e `UPDATE` a `authenticated`.
- `financial_entry_history` concede somente `SELECT` a `authenticated`.
- Não há grant de `DELETE`; o modelo operacional usa `deleted_at`.

Funções e triggers:

- Cria `private.capture_financial_entry_history()` como `SECURITY DEFINER`, com `search_path=''` e `EXECUTE` revogado de `public`, `anon` e `authenticated`.
- O uso de `SECURITY DEFINER` é restrito ao trigger que grava histórico em tabela sem escrita para o cliente.
- Cria um trigger de histórico em `financial_entries`.
- Cria triggers `updated_at` e auditoria de usuário nas 11 tabelas operacionais.
- As funções dependidas `public.set_updated_at()`, `public.set_auth_audit_fields()`, `private.is_family_member()`, `private.can_edit_family()` e `private.can_admin_family()` já existem no remoto.

Tipos, constraints e índices:

- Não cria nem altera enums. Estados de domínio são `varchar` com check constraints locais.
- Dinheiro usa `numeric(18,2)`; quantidades e preços unitários usam `numeric(24,8)`.
- FKs de domínio incluem `family_id` para impedir relacionamentos entre famílias.
- Índices explícitos cobrem FKs, família, competência, vencimento, cartão, imóvel, unidade, contrato, pessoa, recorrência, parcela, fatura e documento.
- Unicidade evita duplicação por `source_key`, parcela e fatura/cartão/competência.
- Pagamento de fatura é representado por vínculo à fatura/conta; as despesas do cartão permanecem lançamentos próprios, evitando transformar o pagamento da fatura em nova despesa de resultado.
- Transferências usam `entry_type='transfer'`, `cash_direction` e `transfer_group_id`; investimentos distinguem aplicação, resgate e rendimento, evitando distorção do resultado.

Operações potencialmente destrutivas:

- Não há `DROP TABLE`, `TRUNCATE`, exclusão de dados, reset ou desativação de RLS.
- Há `DROP ... IF EXISTS` somente para constraints, triggers e policies gerenciados pela própria migration; na inspeção pré-push, esses objetos financeiros ainda não existiam.
- O cutover remove um privilégio de escrita direta, sem remover dados nem acesso de leitura dos membros.
- `ALTER TABLE` e criação de índices podem adquirir locks durante o push real; esse é o principal risco operacional remanescente.

## Teste estático do fluxo de cutover

Fluxo confirmado:

```text
usuário authenticated
→ public.bootstrap_family(text, text)
→ valida auth.uid() e serializa concorrência por usuário
→ cria public.families como SECURITY DEFINER
→ cria/regulariza public.family_members com papel owner
→ acesso posterior controlado por RLS e family_id
```

Evidências:

- `bootstrap_family` está materializada no remoto e seu SQL local equivalente é `SECURITY DEFINER` com `search_path=''`.
- `EXECUTE` foi revogado de `PUBLIC` e `anon` e concedido explicitamente a `authenticated`.
- A função verifica `auth.uid()` e cria tanto a família quanto a associação do proprietário.
- O `REVOKE INSERT` sobre a tabela não impede o proprietário da função de executar o `INSERT` interno.
- `create_family_invitation`, `get_pending_family_invitation`, `accept_family_invitation` e `regularize_family_member` permanecem inalteradas.
- Nenhum dado ou vínculo existente é modificado pelo cutover.
- Nenhuma chave `service_role` é necessária ou usada no frontend.

Conclusão estática: criação oficial de família, associação, convites e isolamento RLS são preservados.

## Finding preexistente separado

O catálogo remoto mostrou que `authenticated` possui privilégios adicionais de `TRUNCATE`, `REFERENCES` e `TRIGGER` em algumas tabelas antigas da reconciliação. O SQL histórico concedeu DML sem revogar previamente todos os defaults de `authenticated`.

Esse finding:

- antecede o módulo financeiro;
- não foi alterado;
- não foi incluído no cutover;
- não será misturado à migration financeira;
- exige análise e migration própria antes de eventual correção.

## Por que não foi usado `migration repair`

Não havia necessidade de alterar `supabase_migrations.schema_migrations`. As três divergências eram cópias exatas sob timestamps diferentes, e as duas migrations MCP tinham fontes locais preservadas no subprojeto. A cadeia pôde ser alinhada fielmente apenas com arquivos locais, mantendo o histórico remoto intocado.

## Push real e confirmação do histórico

Comando executado uma única vez, após dry-run final:

```powershell
npx --no-install supabase db push --linked
```

Migrations efetivamente aplicadas, na ordem:

1. `20260726215348_enforce_family_bootstrap_cutover.sql`
2. `20260726215403_create_financial_patrimonial_core.sql`

O push emitiu apenas notices esperados de `IF EXISTS`/`IF NOT EXISTS`. Ao final, a CLI avisou que não conseguiu atualizar o cache local `pg-delta` porque Docker Desktop não estava disponível. Esse warning ocorreu depois da aplicação e não alterou o banco. A confirmação independente por `migration list --linked` mostrou:

```text
Local            Remote
20260716193333    20260716193333
20260716195307    20260716195307
20260717151805    20260717151805
20260717151819    20260717151819
20260717151831    20260717151831
20260717152559    20260717152559
20260726215348    20260726215348
20260726215403    20260726215403
```

## Validação remota pós-push

### Cutover

- `authenticated` agora possui em `public.families`: `SELECT`, `UPDATE` e `DELETE`; `INSERT` não está presente.
- Os demais privilégios legítimos permaneceram.
- `bootstrap_family(text,text)`, `create_family_invitation(...)` e `accept_family_invitation(text)` continuam disponíveis para `authenticated`.
- As funções são `SECURITY DEFINER`, possuem `search_path=''` e mantêm os checks internos de identidade e autorização.
- O bootstrap continua criando a família e a associação `owner`; convites e vínculos existentes não foram alterados.

### Inventário financeiro

Foram confirmadas 12 tabelas:

`financial_categories`, `credit_cards`, `property_units`, `lease_contracts`, `lease_owner_shares`, `investment_assets`, `investment_positions`, `installment_purchases`, `card_invoices`, `financial_entries`, `financial_entry_history` e `financial_alert_rules`.

- Todas possuem PK UUID e todas as constraints do módulo estão validadas.
- Foram confirmadas 68 FKs, 1 unique constraint declarada, 36 check constraints e os índices únicos/parciais previstos.
- Os valores monetários são `numeric(18,2)`; quantidades e preços unitários são `numeric(24,8)`.
- `financial_entries.difference_amount` é coluna gerada `numeric(18,2)`.
- Nenhum enum foi criado ou alterado; os estados usam `varchar` com checks.
- A função `private.capture_financial_entry_history()` é `SECURITY DEFINER`, `search_path=''` e executável apenas pelo proprietário.
- Foram confirmados 23 triggers: auditoria e `updated_at` nas 11 tabelas operacionais, mais o histórico de `financial_entries`.

### Matriz RLS, policies e grants

| Grupo | RLS | SELECT | INSERT | UPDATE | DELETE | Grant `anon` |
| --- | --- | --- | --- | --- | --- | --- |
| 11 tabelas operacionais | Ativa | membro da família | editor da família | editor da família, com `USING` e `WITH CHECK` | sem grant | nenhum |
| `financial_entry_history` | Ativa | membro da família | somente trigger privado | não permitido | não permitido | nenhum |

Verificação consolidada do catálogo:

- tabelas esperadas/atuais: `12/12`;
- tabelas sem RLS: `0`;
- policies fora de `authenticated` ou sem predicado familiar: `0`;
- grants para `anon`: `0`;
- tabelas operacionais: `SELECT, INSERT, UPDATE` para `authenticated`;
- histórico: apenas `SELECT` para `authenticated`.

Não foi encontrado `service_role`, `SUPABASE_SERVICE_ROLE_KEY` ou equivalente no código frontend. O isolamento é feito por `family_id` e pelas funções `private.is_family_member`/`private.can_edit_family`.

## Advisors

### Segurança

Nenhum finding foi introduzido pelo módulo financeiro.

| Finding | Origem | Classificação | Bloqueio |
| --- | --- | --- | --- |
| `private.family_consolidation_backups` com RLS e sem policy | Preexistente, schema privado | Informativo | Não bloqueante |
| `public.set_updated_at` sem `search_path` fixo | Preexistente, função invoker | Warning | Não bloqueante para o módulo |
| Funções públicas de onboarding `SECURITY DEFINER` executáveis por `authenticated` | Preexistente e intencional; possuem checks e `search_path=''` | Informativo/aceito | Não bloqueante |
| `add_family_creator_as_owner` e `handle_new_auth_user` executáveis por `anon`/`authenticated` | Preexistente; são trigger functions com `search_path=''` | Warning a revisar separadamente | Não bloqueante para as fases 3 e 4 |
| Proteção contra senhas vazadas desabilitada | Configuração Auth preexistente | Warning | Não bloqueante para o módulo |

### Performance

O advisor retornou somente nível `INFO`:

- banco total: 137 FKs sem índice covering e 53 índices ainda não utilizados;
- módulo financeiro: 57 FKs sem índice covering e 35 índices não utilizados.

Os 35 índices não utilizados são esperados imediatamente após a criação das tabelas e são informativos. Os 57 findings de FK incluem FKs compostas cujos índices locais começam por `family_id` em vez da ordem literal da constraint e FKs auxiliares de `created_by`/`updated_by`. São introduzidos pelo módulo, não comprometem integridade nem segurança e foram classificados como **não bloqueantes**, mas devem ser tratados em migration incremental própria antes de crescimento relevante de volume. Nenhum índice foi removido ou criado automaticamente neste checkpoint.

Os findings antigos de `TRUNCATE`, `REFERENCES` e `TRIGGER` continuam separados e não foram corrigidos.

## Tipos e validações do projeto

- Tipos remotos gerados em `lib/supabase/database.types.ts` para o schema `public`.
- Arquivo: 112.978 bytes; contém as 12 tabelas financeiras.
- Lint: passou, sem warnings ou erros.
- Typecheck: `npx tsc --noEmit` passou.
- Testes: 24 arquivos, 99 testes passaram.
- Build: Next.js 14.2.35 compilou e gerou 22 páginas com sucesso.
- Warning não bloqueante dos testes: API CJS do Vite está depreciada.

## Comandos executados neste checkpoint

```powershell
npx --no-install supabase migration new enforce_family_bootstrap_cutover
npx --no-install supabase migration new create_financial_patrimonial_core
npx --no-install supabase migration list --linked
npx --no-install supabase db push --linked --dry-run
npx --no-install supabase db push --linked
npx --no-install supabase db query --linked "<consultas SELECT de validação>"
npx --no-install supabase db advisors --linked --type security --level info --fail-on none --output json
npx --no-install supabase db advisors --linked --type performance --level info --fail-on none --output json
npx --no-install supabase gen types typescript --linked --schema public
npm run lint
npx tsc --noEmit
npm test -- --run
npm run build
```

Também foram usados `Get-Content`, `rg`, `git status`, `git diff --check` e hashes locais para validação. Não foram executados `migration repair`, `db reset` ou SQL remoto manual de escrita.

## Checkpoint final

| Item | Estado |
| --- | --- |
| Baseline remoto na cadeia raiz | Completo |
| Arquivos MCP originais | Preservados |
| Três timestamps divergentes antigos | Retirados da cadeia ativa |
| Cutover antigo | Preservado em `docs/archive/migrations/` |
| Novo cutover | `20260726215348` |
| Migration financeira renomeada | `20260726210300` → `20260726215403` |
| Histórico local/remoto antigo | Alinhado |
| Dry-run | Somente cutover + financeiro |
| Warnings do dry-run | Nenhum |
| Push real | Executado: somente cutover + financeiro |
| Histórico pós-push | Oito timestamps alinhados |
| Schema financeiro | 12 tabelas confirmadas |
| RLS/policies/grants | Confirmados |
| Advisors | Segurança e performance executados |
| Tipos | Regenerados |
| Lint/typecheck/testes/build | Aprovados |
| Migration repair/reset | Não executados |
| Estado | **LIBERADO PARA AS FASES 3 E 4** |

## Veredito

**DB PUSH EXECUTADO E VALIDADO NO REMOTO.**  
**LIBERADO PARA AS FASES 3 E 4**, com backlog não bloqueante de índices covering e findings preexistentes documentados.

---

## Implementação das Fases 3 e 4 — 26/07/2026

### Arquitetura adotada

- Mantido o App Router, Server Components, Server Actions, cliente Supabase de sessão e autenticação existentes.
- `lib/supabase/server.ts` e `lib/supabase/client.ts` passaram a usar o genérico `Database` de `lib/supabase/database.types.ts`.
- Os aliases de domínio em `lib/finance/types.ts` são derivados exclusivamente por `Tables<>`, `TablesInsert<>` e `TablesUpdate<>`; não existe segundo modelo persistente.
- `family_id` é obtido por `getFamilyContext()` em todas as ações. Formulários que enviarem `family_id` são rejeitados por `assertNoClientFamilyId`.
- Não foi criada migration, tabela, seed, cliente Supabase, autenticação ou schema paralelo.

### Fase 3 — domínio, serviços e operações

Foram implementados:

- validação de moeda, precisão decimal, datas, competência, parcelas, dias de cartão, percentuais, enums funcionais e contexto familiar;
- consultas familiares para as 12 tabelas do núcleo financeiro e para pessoas/imóveis existentes;
- categorias hierárquicas, contas e cartões com arquivamento lógico;
- receitas, despesas, aportes, resgates, rendimentos e vínculos com conta, cartão, categoria, pessoa, imóvel, contrato e ativo;
- pagamento e desfazimento sem sobrescrever `expected_amount`;
- transferência representada por duas pernas com o mesmo `transfer_group_id`, sem efeito no resultado operacional;
- recorrências com `source_key` determinística e `upsert ... ignoreDuplicates`;
- parcelamentos com arredondamento na última parcela e `source_key` determinística;
- cancelamento somente de parcelas futuras sem `actual_amount`, preservando parcelas realizadas;
- montagem de fatura por competência e vínculo dos lançamentos;
- pagamento de fatura como `transfer`, não como nova despesa, com chave única `invoice-payment:<id>`;
- unidades, contratos de locação e rateios de proprietários;
- ativos e posições de investimento, com lançamentos patrimoniais no ledger;
- consulta somente leitura de `financial_entry_history`; alterações do ledger continuam registradas pelo trigger remoto.

Fórmulas dos indicadores:

| Indicador | Fórmula |
| --- | --- |
| Saldo disponível | soma dos saldos iniciais + entradas realizadas − saídas realizadas |
| Saldo projetado | saldo disponível + receitas previstas ainda não realizadas − despesas previstas ainda não realizadas |
| Saldo contábil | saldo inicial + movimentos efetivos com direção de caixa |
| Saldo comprometido | despesas ativas futuras e ainda não realizadas |
| Resultado mensal | receitas realizadas operacionais − despesas realizadas operacionais |
| Resultado imobiliário | aluguéis realizados − despesas vinculadas aos imóveis |
| Patrimônio financeiro | última posição conhecida de cada ativo |

### Fase 4 — interface financeira

A rota única `/financas` ganhou navegação por query string, mantendo um ledger único e sem páginas/tabelas físicas por mês:

- Visão geral, Movimentações, Contas, Cartões, Faturas, Parcelamentos, Recorrências, Imóveis e aluguéis, Investimentos, Categorias e Alertas;
- dashboard responsivo com 13 indicadores;
- filtros por competência, texto, conta, cartão, categoria, pessoa, imóvel, status, tipo e realização;
- linha do tempo horizontal com 24 meses de receitas, despesas e resultado;
- formulários progressivos para lançamento, transferência, conta, cartão, categoria, recorrência, parcelamento, unidade, contrato, rateio, ativo e posição;
- tabelas responsivas, estados vazios, feedback de sucesso/erro, `loading.tsx`, `error.tsx`, labels e atributos ARIA;
- cards com limite utilizado/disponível, faturas com fechamento/pagamento, resultado por imóvel e evolução das posições de investimento;
- serviços de consulta e cálculo reutilizáveis por uma futura integração oficial do HERO.IA.

Nenhum dado demonstrativo ou pessoal foi inserido.

### Validação desta implementação

| Verificação | Resultado |
| --- | --- |
| `npx --no-install tsc --noEmit` | Aprovado |
| `npm run lint` | Aprovado, zero warnings/erros |
| `npm test -- --reporter=verbose` | 25 arquivos e 106 testes aprovados |
| Testes financeiros | 18 de domínio + 6 de validação = 24 aprovados |
| `npm run build` | Aprovado; Next.js 14.2.35, 22 páginas, `/financas` dinâmica |
| Inspeção no navegador interno | Não concluída: conexão expirou duas vezes antes de abrir a página |

O build inicialmente ultrapassou o limite de 4 minutos do executor, mas o processo foi acompanhado até encerrar. Uma segunda execução com janela maior concluiu com exit code `0`, compilação, typecheck, geração das 22 páginas e traces aprovados em 310,4 segundos.

O warning CJS da API Node do Vite permanece informativo e preexistente. A validação visual autenticada em desktop/mobile continua como checkpoint manual recomendado; nenhum erro de compilação, lint, tipos ou testes permanece.

### Arquivos da implementação

Criados:

- `app/financas/finance-nav.tsx`
- `app/financas/loading.tsx`
- `app/financas/error.tsx`
- `lib/finance/types.ts`
- `lib/finance/validation.ts`
- `lib/finance/validation.test.ts`
- `lib/finance/services.ts`

Alterados nesta etapa:

- `app/financas/actions.ts`
- `app/financas/page.tsx`
- `lib/finance/domain.test.ts`
- `lib/supabase/server.ts`
- `lib/supabase/client.ts`
- ajustes estritamente tipados em `app/dashboard/actions.ts`, `app/documentos/actions.ts`, `app/relacionamentos/page.tsx` e `lib/timeline/log-event.ts`, revelados ao ativar o cliente Supabase tipado.

### Limites e backlog

- A UI expõe criação e principais operações, mas a edição inline completa de todos os cadastros auxiliares e a visualização detalhada do JSON de cada evento histórico podem receber uma iteração de UX dedicada.
- O gerador operacional de recorrências mensais, cancelamento futuro de parcelas e montagem de faturas estão implementados como Server Actions; controles administrativos mais avançados podem ser refinados na UI.
- Paginação do ledger está limitada a 1.000 lançamentos no serviço atual; antes de famílias ultrapassarem esse volume, deve ser substituída por paginação cursor-based.
- Permanecem os findings de índices covering e privilégios antigos já classificados separadamente; não foram misturados nesta implementação.

### Veredito das fases

**FASE 3 CONCLUÍDA** para o escopo operacional principal e critérios de segurança/contabilidade/testes.  
**FASE 4 NÃO CONCLUÍDA integralmente** até a validação visual autenticada e a exposição/refino dos controles administrativos avançados indicados no backlog.

---

## Importador financeiro oficial — carga 08/2026

- Rota: `/financas/importar`.
- Fonte: ZIP oficial; `README.md`, `manifest.json` e `import_review.json` são autoritativos.
- Autenticação: sessão Supabase existente; `family_id` e usuário são derivados no servidor.
- Persistência: Services financeiros, upsert por UUID determinístico derivado do `external_id` exato e `source_key` para o ledger.
- Segurança: sem migration, alteração de schema, `service_role` ou desativação de RLS.
- Preview: novos/atualizados por conjunto, inconsistências bloqueantes, warnings e registros `review_required`.
- Integridade local do pacote: 190 registros-fonte, zero IDs duplicados, zero referências nomeadas quebradas e 338 operações planejadas com IDs únicos.
- Estado da carga: **BLOQUEADA ANTES DO COMMIT** por 8 findings oficiais e 3 registros `review_required`.
- Escrita remota nesta etapa: **nenhuma**.

Validação da implementação:

| Verificação | Resultado |
| --- | --- |
| `npm run typecheck` | Aprovado |
| `npm run lint` | Aprovado, sem warnings ou erros |
| `npm test -- --pool=forks --poolOptions.forks.singleFork` | 28 arquivos e 114 testes aprovados |
| Testes do importador com o ZIP anexado | 2 arquivos e 5 testes aprovados |
| Integridade do plano | 338 IDs únicos; valores representativos conferidos sem transformação |
| `git diff --check` | Aprovado |
| Rota local sem sessão | `307 /login`, comportamento esperado |

O warning de depreciação da API CJS do Vite permanece informativo e preexistente. A Preview remota autenticada deve ser aberta pelo usuário em `/financas/importar`; como o pacote está bloqueado pela própria documentação oficial, nenhum commit foi tentado.

---

## Auditoria de duplicidades e acesso MCP — 07/08/2026 22:40:39 -03:00

### Identificação e acesso

- Arquivo de acompanhamento confirmado: `docs/SUPABASE_RECOVERY_AND_VALIDATION.md`.
- Projeto auditado: `ffzqloiwmbvbeycaevfm`.
- MCP utilizado: `supabase_familyos`.
- Autenticação ativa: Bearer Token fornecido pela variável de ambiente `SUPABASE_FAMILYOS_TOKEN`.
- Não foram executados `codex mcp login`, OAuth, migration, `DELETE`, commit, push, merge ou publicação.
- O valor do token não foi lido, exibido ou gravado.

### Critérios utilizados

- Imóvel ativo: `deleted_at is null`, com o `status` registrado separadamente para distinguir `active`, `pending` e `inactive`.
- Identidade física: nome, endereço normalizado, matrícula, inscrição municipal, CEP, tipo, metadados patrimoniais e datas de criação.
- Evidência relacional: unidades, contratos, rateios de locação, documentos, proprietários, tarefas e lançamentos financeiros, incluindo vínculos arquivados.
- Lançamento de agosto de 2026: competência `2026-08-01` ou qualquer `due_date`, `expected_date` ou `effective_date` entre `2026-08-01` e `2026-08-31`.
- Chave estrita financeira: descrição normalizada, tipo, direção de caixa, valor previsto e realizado, categoria, imóvel, unidade, contrato, cartão, conta, ativo, recorrência, parcelamento, fatura, documento, registros pai/estorno/transferência, competência, datas, status, parcela e origem.
- Chaves adicionais: `source_key` e `metadata.external_id`.
- Cópia inequívoca de teste: exigiria marcador objetivo como `is_demo=true`, texto `test`/`teste`/`demo`/`mock`, chave repetida ou histórico que demonstrasse criação de teste. Nenhum desses sinais foi encontrado nos registros ativos examinados.

### Tabelas examinadas

`properties`, `property_units`, `property_owners`, `lease_contracts`, `lease_owner_shares`, `documents`, `document_metadata`, `document_versions`, `family_tasks`, `financial_entries`, `financial_entry_history`, `financial_categories`, `credit_cards`, `accounts`, `installment_purchases`, `card_invoices` e `recurrences`.

### Imóveis possivelmente duplicados

Foram encontrados cinco pares físicos. A confirmação visual do usuário mostrou simultaneamente os dois lados na tela `Imóveis e resultado`: os registros operacionais concentram unidades, contratos e resultado, enquanto os cadastros antigos aparecem sem unidades, sem contratos ativos e com resultado zero. Essa evidência resolveu a classificação pendente. Os cinco cadastros antigos foram arquivados logicamente; documentos, proprietários e histórico permaneceram vinculados e intactos.

| Par | Cópia redundante arquivada | Registro operacional legítimo preservado | Evidência de identidade | Relações verificadas | Classificação |
| --- | --- | --- | --- | --- | --- |
| 1 | `0a4ef433-a16a-4432-845b-34d0959a8e10` — Villagio dei Fiori | `053b585e-c444-5d57-a56f-47878a8d4902` — NR181 | Matrícula `19030`; endereço Noronha 181/501 | cópia: 2 proprietários e 2 documentos, sem unidade/contrato/lançamento ativo; preservado: 1 unidade e 1 contrato `vacant` | Duplicata confirmada na interface; lado operacional preservado |
| 2 | `94544ba5-39f9-439f-abc1-61aee2ae0e19` — Edifício Marte | `24756b6e-8efc-5b79-af5f-ab9d14abd2a5` — Américo | Matrícula `6048` e unidade 1604; logradouro diverge entre nº 22 e nº 21 | cópia: 2 proprietários, 10 documentos e 1 tarefa, sem unidade/contrato/lançamento ativo; preservado: 1 unidade, 1 contrato fechado, 1 documento e 8 lançamentos | Duplicata confirmada na interface; lado com resultado preservado |
| 3 | `5f03207f-07a4-45e2-a27c-02521df4d2f1` — Prédio Comercial 3 Andares | `d8b6198d-f2d7-57b7-9408-1e4e55ad9e41` — 469 | Mesmo endereço Lopes Trovão 469; matrículas `2.327` e `28.327` | cópia: 2 proprietários e 10 documentos, sem unidade/contrato/lançamento ativo; preservado: 2 unidades, 2 contratos e 15 lançamentos | Duplicata confirmada na interface; lado com unidades e resultado preservado |
| 4 | `9476afc8-764c-4351-97f8-fb6638f61b41` — Prédio Comercial 3 Lojas 50% | `de4fafbf-e26d-5dfe-94f3-51bf753b0dc7` — Sta38 | Mesmo endereço Santa Rosa 38; matrículas `1.800` e `4.800` | cópia: 2 proprietários, 15 documentos e 1 lançamento já arquivado anteriormente, sem vínculo financeiro ativo; preservado: 3 unidades, 3 contratos e 23 lançamentos | Duplicata confirmada na interface; lado com unidades e resultado preservado |
| 5 | `f9003859-faf3-438f-9b96-0eb41654aa2a` — Loja Center V | `e74a0ed1-2808-5ae8-b78e-496d9a5a9ded` — CenterV | Matrícula `428`; mesmo endereço Lopes Trovão 134, loja 218 | cópia: 2 proprietários e 5 documentos, sem unidade/contrato/lançamento ativo; preservado: 1 unidade, 1 contrato e 14 lançamentos | Duplicata confirmada na interface; lado com unidades e resultado preservado |

Não existem `lease_owner_shares` associados aos contratos desses cinco pares. Todos os vínculos listados permaneceram intactos. O arquivamento ocorreu em uma única transação às `2026-08-07 22:43:44 -03:00`, com validação das cinco duplas, da mesma família e da ausência de unidades, contratos e lançamentos ativos nos IDs arquivados.

### Auditoria dos lançamentos de agosto de 2026

- Registros no recorte: 96, sendo 95 ativos e 1 previamente arquivado.
- Origem dos 95 ativos: 48 `import`, 5 `manual`, 16 `recurrence` e 26 `installment`.
- Registros ativos com `is_demo=true`: 0.
- Grupos duplicados pela chave estrita: 0.
- `source_key` repetida entre ativos: 0.
- `metadata.external_id` repetido entre ativos: 0.
- Marcadores objetivos de teste: 0.

Uma semelhança ampla foi encontrada:

| ID | Referência fonte | Origem atual | Valor | Classificação |
| --- | --- | --- | --- | --- |
| `56f25b17-05d2-5720-8da3-1bdc41525b97` | `rent-SR38-1-2026-08` | `import` | R$ 6.000,00 | Registro legítimo de agosto |
| `6f54fbdc-5d63-5ca0-98c5-218e6e423983` | `rent-SR38-1-2026-07` | `manual` após atualização registrada no histórico | R$ 6.000,00 | Registro legítimo distinto de julho, atualmente contabilizado na competência de agosto |

Os dois IDs têm descrição, tipo, valor, imóvel e competência atuais iguais, mas `source_key` e `external_id` diferentes. O pacote oficial contém as duas referências como competências de origem distintas (`2026-07` e `2026-08`), portanto não há evidência para arquivar qualquer uma delas.

O lançamento `b8a56337-a90f-4551-8a76-da2df277ed8b` já possuía `deleted_at=2026-07-27T02:35:00.854Z` antes desta auditoria. Ele foi apenas contabilizado nos totais históricos e não foi alterado.

### Classificação e IDs

IDs arquivados logicamente em `properties`, com o motivo `cópia redundante confirmada na interface, sem unidades, contratos ou lançamentos ativos`:

- `0a4ef433-a16a-4432-845b-34d0959a8e10`
- `94544ba5-39f9-439f-abc1-61aee2ae0e19`
- `5f03207f-07a4-45e2-a27c-02521df4d2f1`
- `9476afc8-764c-4351-97f8-fb6638f61b41`
- `f9003859-faf3-438f-9b96-0eb41654aa2a`

Registros operacionais legítimos preservados:

- `053b585e-c444-5d57-a56f-47878a8d4902` — NR181
- `24756b6e-8efc-5b79-af5f-ab9d14abd2a5` — Américo
- `d8b6198d-f2d7-57b7-9408-1e4e55ad9e41` — 469
- `de4fafbf-e26d-5dfe-94f3-51bf753b0dc7` — Sta38
- `e74a0ed1-2808-5ae8-b78e-496d9a5a9ded` — CenterV

Lançamentos legítimos preservados após a comparação financeira:

- `56f25b17-05d2-5720-8da3-1bdc41525b97`
- `6f54fbdc-5d63-5ca0-98c5-218e6e423983`

Foram executados cinco arquivamentos lógicos por `UPDATE properties SET deleted_at = ...`, dentro de uma única transação. Nenhum `DELETE` físico foi executado.

### Validação dos totais

| Tabela/recorte | Antes | Depois | Variação |
| --- | ---: | ---: | ---: |
| `properties` total / não arquivados / arquivados | 13 / 13 / 0 | 13 / 8 / 5 | 0 / -5 / +5 |
| `properties` por status não arquivado | 11 `active`, 1 `pending`, 1 `inactive` | 6 `active`, 1 `pending`, 1 `inactive` | -5 `active` |
| `property_units` total / não arquivadas / arquivadas | 8 / 8 / 0 | 8 / 8 / 0 | 0 |
| `lease_contracts` total / não arquivados / arquivados | 8 / 8 / 0 | 8 / 8 / 0 | 0 |
| `documents` total / não arquivados / arquivados | 74 / 74 / 0 | 74 / 74 / 0 | 0 |
| `financial_entries` total / não arquivados / arquivados | 236 / 235 / 1 | 236 / 235 / 1 | 0 |
| Lançamentos no recorte de agosto total / ativos / arquivados | 96 / 95 / 1 | 96 / 95 / 1 | 0 |

Resultado: cinco imóveis redundantes arquivados logicamente; unidades, contratos, documentos e lançamentos mantiveram os mesmos totais; nenhum relacionamento foi rompido e nenhum histórico foi removido.

### Arquivos e diretórios protegidos

Permaneceram integralmente sem alteração:

- `sql/diagnostics/`
- `sql/seeds/004_seixasos_mvp_data_backfill.sql`
- `mcp-server/`

As modificações locais preexistentes e não relacionadas no módulo financeiro também foram preservadas.

### Correção da classificação dos imóveis — 07/08/2026 22:50:47 -03:00

Esta seção **substitui a classificação e os IDs finais da ação registrada anteriormente neste mesmo checkpoint**. O usuário esclareceu que o critério canônico do módulo Imóveis é preservar ativos os cadastros que concentram os documentos anexados, e não os cadastros operacionais paralelos que concentram unidades e lançamentos.

A correção foi executada em uma única transação recuperável:

1. os cinco imóveis documentais anteriormente arquivados tiveram `deleted_at` restaurado para `null`;
2. os cinco cadastros operacionais paralelos receberam o mesmo novo `deleted_at`, `2026-08-08T01:50:47.809301Z`;
3. nenhuma unidade, contrato, documento, proprietário, lançamento ou linha de histórico foi movida, editada ou removida;
4. nenhum `DELETE` físico foi executado.

#### IDs reativados e preservados como canônicos documentais

| ID | Imóvel | Documentos ativos |
| --- | --- | ---: |
| `94544ba5-39f9-439f-abc1-61aee2ae0e19` | Edifício Marte | 10 |
| `f9003859-faf3-438f-9b96-0eb41654aa2a` | Loja Center V | 5 |
| `5f03207f-07a4-45e2-a27c-02521df4d2f1` | Prédio Comercial 3 Andares | 10 |
| `9476afc8-764c-4351-97f8-fb6638f61b41` | Prédio Comercial 3 Lojas 50% | 15 |
| `0a4ef433-a16a-4432-845b-34d0959a8e10` | Villagio dei Fiori | 2 |

#### IDs operacionais arquivados após a correção

| ID | Imóvel | Documentos | Unidades | Contratos | Lançamentos | Motivo |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `d8b6198d-f2d7-57b7-9408-1e4e55ad9e41` | 469 | 0 | 2 | 2 | 15 | Paralelo sem documentos; preservar o cadastro documental Lopes Trovão 469 |
| `24756b6e-8efc-5b79-af5f-ab9d14abd2a5` | Américo | 1 | 1 | 1 | 8 | Paralelo com apenas 1 documento; Edifício Marte concentra 10 documentos e foi definido como canônico |
| `e74a0ed1-2808-5ae8-b78e-496d9a5a9ded` | CenterV | 0 | 1 | 1 | 14 | Paralelo sem documentos; preservar Loja Center V |
| `053b585e-c444-5d57-a56f-47878a8d4902` | NR181 | 0 | 1 | 1 | 0 | Paralelo sem documentos; preservar Villagio dei Fiori |
| `de4fafbf-e26d-5dfe-94f3-51bf753b0dc7` | Sta38 | 0 | 3 | 3 | 23 | Paralelo sem documentos; preservar Prédio Comercial 3 Lojas 50% |

Os relacionamentos dos IDs arquivados continuam integralmente existentes e recuperáveis. O arquivamento afeta somente a visibilidade do imóvel por `deleted_at`.

#### Validação final após a correção

| Tabela/recorte | Total | Não arquivados | Arquivados |
| --- | ---: | ---: | ---: |
| `properties` | 13 | 8 | 5 |
| `financial_entries` | 236 | 235 | 1 |

Totais relacionais, sem variação em relação ao início da auditoria:

- `property_units`: 8;
- `lease_contracts`: 8;
- `documents`: 74;
- `financial_entries`: 236.

Imóveis visíveis finais: Edifício Diamond, Edifício Marte, Edifício Notting Hill Residence, Loja Center V, Porto Real Resort, Prédio Comercial 3 Andares, Prédio Comercial 3 Lojas 50% e Villagio dei Fiori. Todos possuem `status=active` e pelo menos um documento ativo.

Os caminhos protegidos `sql/diagnostics/`, `sql/seeds/004_seixasos_mvp_data_backfill.sql` e `mcp-server/` permaneceram sem alteração durante a correção.
