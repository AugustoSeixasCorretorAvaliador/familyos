# Módulo Financeiro e Patrimonial Familiar

## Auditoria da arquitetura existente

O HERO.FamilyOS é uma aplicação Next.js 14 com App Router, React Server Components, TypeScript estrito, React 18 e Tailwind CSS. As páginas privadas usam Supabase Auth por SSR, `getFamilyContext()` para resolver usuário, família e papel, e RLS no Postgres como barreira definitiva de autorização. Não há ORM: o acesso é feito com `@supabase/supabase-js` por Server Components e Server Actions.

As rotas ficam em `app/`, as regras reutilizáveis em `lib/`, os componentes compartilhados em `app/components/` e as migrations oficiais em `supabase/migrations/`. Formulários seguem o padrão de Server Actions, `ExpandableCreateForm`, `SubmitButton`, redirecionamento com códigos seguros e `reportActionError`. O estado é majoritariamente server-side; estado React local é usado apenas para interação visual. Os testes usam Vitest e Testing Library. A responsividade usa utilitários Tailwind mobile-first.

O módulo atual em `/financas` cadastra somente contas e mantém saldo/data de atualização em `accounts.metadata`. Já existem as tabelas `families`, `family_members`, `people`, `accounts`, `expenses`, `payments`, `recurrences`, `properties`, `property_owners`, `documents`, `events` e `alerts`. `expenses` e `payments` não serão removidas: permanecem como legado durante a migração progressiva para a base unificada.

## Leitura das planilhas de referência

As oito imagens mostram três camadas de negócio, não oito telas a copiar:

1. Fluxo mensal consolidado: receitas, investimentos/resgates, despesas, impostos, saldo anterior e transporte de saldo.
2. Projeção de cartões por ciclo: recorrentes, parcelados, avulsos, estornos, fatura prevista, fatura fechada e diferença.
3. Patrimônio e locações: imóveis/unidades, contratos, ocupação, aluguel bruto, encargos, rateio entre proprietários e resultado líquido.

As colunas Jul/26, Ago/26 e Set/26 serão visualizações por competência sobre uma única base de lançamentos. Os quatro cartões observados são dados cadastráveis, não constantes do código. A imagem repetida do Porto Seguro reforça o mesmo fluxo e não representa um quinto cartão.

## Componentes e padrões reutilizados

- `getFamilyContext`, `canEditFamily` e `canAdminFamily` para autenticação e papéis.
- `createClient()` SSR e políticas `private.is_family_member`, `private.can_edit_family` e `private.can_admin_family`.
- `MainNav`, `ExpandableCreateForm`, `SubmitButton` e `ConfirmSubmitButton`.
- `reportActionError`, mensagens seguras e revalidação de rotas.
- `properties`, `property_owners`, `people`, `accounts` e `documents` como cadastros mestres.
- `events`/timeline para eventos relevantes em fases posteriores.
- Tailwind e identidade visual HERO.FamilyOS, sem mudança global de design.

## Modelo de dados

### Reaproveitado

- `families` / `family_members`: núcleo e isolamento familiar.
- `people`: responsáveis, titulares, locatários e proprietários.
- `accounts`: contas financeiras; recebe saldo inicial controlado e marcador DEMO.
- `properties` / `property_owners`: imóvel e propriedade registral/econômica.
- `documents`: anexos de faturas, contratos e comprovantes.
- `recurrences`: regra genérica existente, ampliada para templates financeiros.
- `expenses` / `payments`: legado preservado para migração assistida futura.

### Novo núcleo

- `financial_categories`: categorias e subcategorias hierárquicas.
- `credit_cards`: cadastro genérico de cartões.
- `installment_purchases`: compra original, total e quantidade de parcelas.
- `card_invoices`: ciclo, previsto, fechado, pago e conciliação.
- `financial_entries`: base única de receitas, despesas, transferências, aplicações, resgates, rendimentos, ajustes e estornos.
- `financial_entry_history`: trilha imutável de criação/alteração/exclusão.
- `property_units`: unidades ou explorações de um imóvel.
- `lease_contracts` / `lease_owner_shares`: contratos e rateios com vigência.
- `investment_assets` / `investment_positions`: ativo e posição patrimonial.
- `financial_alert_rules`: regras futuras de atenção financeira.

Valores monetários usam `numeric(18,2)` no Postgres e centavos inteiros nas regras TypeScript. `financial_entries.expected_amount` nunca é substituído por `actual_amount`; `difference_amount` é calculado pelo banco. Exclusão é lógica. Chaves estrangeiras compostas com `family_id` impedem referências cruzadas entre famílias.

## Rotas propostas

- `/financas`: dashboard mensal e linha do tempo.
- `/financas/lancamentos`: consulta e edição de lançamentos.
- `/financas/cartoes`: cartões, faturas, recorrentes e parcelamentos.
- `/financas/patrimonio`: imóveis, unidades, contratos e investimentos.
- Server Actions sob `app/financas/actions.ts`, com regras puras em `lib/finance/`.

Na primeira execução somente as Fases 1 e 2 são implementadas; as rotas adicionais são propostas, não criadas ainda.

## Decisões técnicas

- Base única por lançamento e competência, sem tabelas mensais.
- Competência é o primeiro dia do mês; datas previstas e efetivas são independentes.
- Transferências, aplicações e resgates afetam caixa, mas não resultado operacional.
- Pagamento de fatura liquida o passivo e não cria uma segunda despesa.
- Recorrências e parcelas usam `source_key` idempotente para impedir duplicidade.
- Faturas são únicas por cartão e competência.
- Histórico financeiro não é editável pelo cliente autenticado.
- O schema remoto não foi alterado nesta fase.

## Riscos de regressão e mitigação

- **Schema remoto divergente:** validar migrations e tabelas antes da aplicação. O conector remoto retornou permissão insuficiente nesta sessão.
- **Dados legados em `expenses`/`payments`:** preservar tabelas e planejar migração idempotente, sem conversão automática pelas imagens.
- **Saldo atual em JSON:** manter compatibilidade de leitura até a nova visão derivada estar aprovada.
- **Faturas duplicadas:** chave única cartão/competência e pagamento fora do resultado operacional.
- **Referências entre famílias:** FKs compostas e RLS por `family_id`.
- **Arredondamento:** cálculo em centavos; diferença residual vai para a última parcela.
- **Alterações financeiras destrutivas:** exclusão lógica e histórico por trigger.

## Fases

1. Auditoria, documentação e riscos.
2. Migration do núcleo, regras de domínio e testes unitários.
3. Server Actions transacionais, validação, autorização e seed DEMO opcional.
4. Dashboard mensal, filtros e formulário de lançamento.
5. Recorrências, parcelamentos, cartões e faturas.
6. Unidades, contratos, rateio, investimentos e indicadores patrimoniais.
7. Aplicação/validação remota, advisors, lint, testes, typecheck e build.

## Itens que dependem de confirmação posterior

- Data de corte e saldos iniciais reais de cada conta.
- Arquivo XLSX/CSV original e mapeamento das 24 abas.
- Regras de fechamento/vencimento de cada cartão real.
- Titulares, percentuais e vigências reais dos rateios.
- Critério de competência dos aluguéis e impostos.
- Estratégia de migração de `expenses`/`payments` para `financial_entries`.
- Reautenticação do conector Supabase para validar e aplicar a migration no projeto `ffzqloiwmbvbeycaevfm`.
