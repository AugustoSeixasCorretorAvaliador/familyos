# Mapeamento da planilha para o módulo financeiro

Este documento descreve o mapeamento estrutural. As imagens não são fonte confiável para importar valores reais. A importação só será implementada após análise do XLSX/CSV original.

| Origem antiga | Campo novo | Transformação | Validação |
| --- | --- | --- | --- |
| Aba/mês | `financial_entries.competence` | Converter para o primeiro dia do mês | Competência válida e no período permitido |
| Categoria | `financial_categories.name` | Normalizar espaços, preservar nome legível | Única por família, pai e nome |
| Subcategoria | `financial_categories.parent_id` + `name` | Vincular à categoria superior | Pai da mesma família |
| Descrição | `financial_entries.description` | Texto sem fórmulas da planilha | Obrigatória e limitada |
| Valor previsto | `financial_entries.expected_amount` | BRL textual para `numeric(18,2)` | Não negativo; nunca sobrescrito pelo realizado |
| Valor pago/recebido | `financial_entries.actual_amount` | BRL textual para `numeric(18,2)` | Compatível com status e data efetiva |
| Diferença | `difference_amount` | Calculada: realizado menos previsto | Nunca importar fórmula como fonte de verdade |
| Vencimento | `due_date` | Data brasileira para ISO | Data válida |
| Pagamento/recebimento | `effective_date` | Data brasileira para ISO | Exigida quando realizado |
| Status/observação | `status` + `notes` | Mapear vocabulário antigo | Somente status suportado |
| Saldo anterior | `accounts.opening_balance` ou ajuste | Importar uma vez na data de corte | Proibir duplicação mensal |
| Receita | `entry_type=income` | Lançamento positivo operacional | Categoria de receita |
| Despesa | `entry_type=expense` | Lançamento positivo com direção de saída | Categoria de despesa |
| Aplicação | `entry_type=investment_application` | Saída de caixa não operacional | Ativo/instituição quando disponível |
| Resgate | `entry_type=investment_redemption` | Entrada de caixa não operacional | Não classificar principal como receita |
| Rendimento | `entry_type=investment_yield` | Entrada e resultado de investimento | Separar do principal |
| Cartão/aba | `credit_cards` | Cadastrar cartão, instituição e final | Não fixar os quatro nomes no código |
| Despesa fixa do cartão | `recurrences` + lançamentos | Criar template e ocorrências | `source_key` idempotente |
| Compra parcelada | `installment_purchases` + lançamentos | Uma compra gera N competências | Soma das parcelas igual ao total |
| Parcela N/T | `installment_number/count` | Extrair números quando confiáveis | 1 ≤ N ≤ T |
| Compra avulsa | `purchase_kind=one_off` | Um lançamento no ciclo | Cartão e competência válidos |
| Estorno | `entry_type=reversal` | Vincular ao lançamento original | Não apagar o original |
| Fatura prevista | `card_invoices.expected_amount` | Somar itens menos estornos | Única por cartão/competência |
| Fatura fechada | `closed_amount` | Registrar sem alterar itens | Exige data de fechamento |
| Pagamento da fatura | `paid_amount`/liquidação | Saída para passivo, fora do resultado | Não duplicar despesas |
| Imóvel | `properties` | Reusar cadastro mestre | Mesmo `family_id` |
| Frente/fundos/loja | `property_units` | Criar unidade/exploração | Única por imóvel e código |
| Contrato/locatário | `lease_contracts` | Estruturar vigência e aluguel-base | Pessoa e unidade da mesma família |
| Percentual do proprietário | `lease_owner_shares.percentage` | Decimal com duas casas | Soma válida por vigência |
| IPTU/condomínio/taxa | `financial_entries.property_id/unit_id` | Despesa vinculada ao patrimônio | Categoria e imóvel válidos |
| Investimento/ativo | `investment_assets` | Cadastrar ativo e moeda | Ativo único por família/instituição |
| Posição | `investment_positions` | Quantidade, custo e valor na data | Uma posição por ativo/data |

## Importador oficial de pacotes ZIP

Implementado em `/financas/importar` com duas etapas estritas:

1. **Preview:** abre o ZIP em memória, valida `README.md`, `manifest.json`, todos os datasets e `import_review.json`, resolve referências e consulta os IDs já existentes sob a sessão/RLS.
2. **Commit:** somente é habilitado quando não existe finding bloqueante; relê o mesmo ZIP, confirma o SHA-256 da Preview e executa upserts ordenados pelos Services financeiros.

Regras de identidade e segurança:

- `family_id`, `created_by` e `updated_by` são derivados de `getFamilyContext()`; valores enviados pelo cliente são rejeitados;
- não existe cliente `service_role` nem bypass de RLS;
- o `external_id` é usado sem normalização para derivar UUID determinístico e `source_key` quando a tabela possui esse campo;
- reenvio do mesmo pacote atualiza os mesmos registros e não duplica lançamentos;
- os JSON originais não são modificados e IDs internos nunca são escritos neles;
- totais, saldos e diferenças não são materializados como lançamentos.

### Pacote 08/2026

O ZIP oficial contém 190 registros-fonte em 13 datasets. O plano completo deriva 338 operações persistíveis, incluindo 8 unidades patrimoniais e 236 lançamentos/ocorrências. A validação referencial encontrou zero `external_id` duplicado e zero referência nomeada quebrada.

O commit está bloqueado por `import_review.json` (`requires_review_before_commit`) e pelos registros explicitamente marcados:

- `rental_charges/charge-marte-iptu-2026-08`;
- `investment_assets/inv-unidentified-215k`;
- `investment_positions/pos-unidentified-215k-2026-08`.

Os oito códigos bloqueantes oficiais também são exibidos integralmente na Preview. Nenhuma gravação remota foi executada para esta carga.
