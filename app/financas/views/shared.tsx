import type { ReactNode } from "react";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { SubmitButton } from "@/app/components/submit-button";
import { archiveFinanceRecord } from "@/app/financas/actions";
import { currentCompetence } from "@/lib/finance/services";
import type { FinanceView, FinanceWorkspace, FinancialEntryRow } from "@/lib/finance/types";

export const field = "min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100";
export const panel = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5";
export const primary = "rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60";
export const danger = "rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60";
export const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });

export function formatDate(value?: string | null) {
  if (!value) return "—";
  return dateFormat.format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export function monthLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

export function Options({ rows, placeholder }: { rows: Array<{ id: string; label: string }>; placeholder: string }) {
  return <><option value="">{placeholder}</option>{rows.map((row) => <option key={row.id} value={row.id}>{row.label}</option>)}</>;
}

export function FieldLabel({ label, help, children, className = "" }: { label: string; help: string; children: ReactNode; className?: string }) {
  return <label className={`text-xs font-medium text-slate-600 ${className}`}>
    <span className="mb-1 flex items-center gap-1.5">
      <span>{label}</span>
      <span tabIndex={0} role="img" aria-label={`Informação sobre ${label}: ${help}`} title={help} className="inline-grid h-4 w-4 cursor-help place-items-center rounded-full border border-sky-300 bg-sky-50 text-[10px] font-bold text-sky-700">i</span>
    </span>
    {children}
  </label>;
}

export function FormPanel({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return <details open={open} className={`${panel} group`}><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-900"><span>{title}</span><span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-sky-100 text-sky-700 transition group-open:rotate-45">+</span></summary><div className="mt-5">{children}</div></details>;
}

export function SaveButton({ label = "Salvar alterações" }: { label?: string }) {
  return <SubmitButton label={label} pendingLabel="Processando..." className={primary}/>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function ArchiveForm({ id, entity, label = "Arquivar", returnView, returnCompetence, incomeOrder, expenseOrder }: { id: string; entity: string; label?: string; returnView?: FinanceView; returnCompetence?: string; incomeOrder?: string; expenseOrder?: string }) {
  const confirmMessage = entity === "entry"
    ? "Somente este lançamento será arquivado. Parcelas e recorrências dos outros meses permanecerão ativas. Deseja continuar?"
    : "Esta ação arquiva o registro sem apagar o histórico. Deseja continuar?";
  return <form action={archiveFinanceRecord}><input type="hidden" name="id" value={id}/><input type="hidden" name="entity" value={entity}/>{returnView && <input type="hidden" name="return_view" value={returnView}/>} {returnCompetence && <input type="hidden" name="return_competence" value={returnCompetence}/>} {incomeOrder && <input type="hidden" name="income_order" value={incomeOrder}/>} {expenseOrder && <input type="hidden" name="expense_order" value={expenseOrder}/>}<ConfirmSubmitButton label={label} confirmMessage={confirmMessage} className={danger}/></form>;
}

export function EntryFields({ workspace, entry, defaultCompetence }: { workspace: FinanceWorkspace; entry?: FinancialEntryRow; defaultCompetence?: string }) {
  const people = workspace.people.map((person) => ({ id: person.id, label: `${person.first_name} ${person.last_name}` }));
  return <>
    <FieldLabel label="Descrição" help="Nome usado para localizar e reconhecer o lançamento nas movimentações, relatórios e projeções." className="md:col-span-2"><input name="description" required defaultValue={entry?.description} placeholder="Ex.: Aluguel CenterV" className={`block w-full ${field}`}/></FieldLabel>
    <FieldLabel label="Natureza" help="Define se o lançamento representa entrada, saída ou movimentação de investimento e determina sua direção nos cálculos financeiros."><select name="entry_type" required defaultValue={entry?.entry_type ?? "expense"} className={`block w-full ${field}`}><option value="expense">Despesa</option><option value="income">Receita</option><option value="investment_application">Aporte</option><option value="investment_redemption">Resgate</option><option value="investment_yield">Rendimento</option>{entry?.entry_type === "adjustment" && <option value="adjustment">Ajuste de saldo</option>}</select></FieldLabel>
    {entry?.entry_type === "adjustment" && <input type="hidden" name="adjustment_direction" value={entry.cash_direction}/>}
    <FieldLabel label="Competência" help="Mês em que o lançamento entra nos totais e projeções; pode ser diferente das datas de vencimento e realização."><input name="competence" type="month" required defaultValue={(entry?.competence ?? defaultCompetence ?? currentCompetence()).slice(0, 7)} className={`block w-full ${field}`}/></FieldLabel>
    <FieldLabel label="Valor previsto" help="Valor planejado usado enquanto o lançamento ainda não possui um valor realizado."><input name="expected_amount" required inputMode="decimal" defaultValue={entry?.expected_amount} placeholder="Ex.: 1.250,00" className={`block w-full ${field}`}/></FieldLabel>
    <FieldLabel label="Valor realizado" help="Valor que efetivamente entrou ou saiu. Quando informado, passa a representar a realização do lançamento."><input name="actual_amount" inputMode="decimal" defaultValue={entry?.actual_amount ?? ""} placeholder="Deixe vazio enquanto pendente" className={`block w-full ${field}`}/></FieldLabel>
    <FieldLabel label="Data prevista" help="Data estimada para a ocorrência; serve como referência de planejamento."><input name="expected_date" type="date" defaultValue={entry?.expected_date ?? ""} className={`block w-full ${field}`}/></FieldLabel>
    <FieldLabel label="Data de vencimento" help="Prazo de pagamento ou recebimento; não altera a competência selecionada."><input name="due_date" type="date" defaultValue={entry?.due_date ?? ""} className={`block w-full ${field}`}/></FieldLabel>
    <FieldLabel label="Data efetiva" help="Data em que o dinheiro realmente entrou ou saiu e passou a afetar o saldo da conta."><input name="effective_date" type="date" defaultValue={entry?.effective_date ?? ""} className={`block w-full ${field}`}/></FieldLabel>
    <FieldLabel label="Status" help="Indica a etapa operacional do lançamento, como planejado, a pagar, pago, a receber ou recebido."><select name="status" defaultValue={entry?.status ?? "planned"} className={`block w-full ${field}`}><option value="planned">Planejado</option><option value="payable">A pagar</option><option value="receivable">A receber</option><option value="paid">Pago</option><option value="received">Recebido</option><option value="pending_confirmation">A confirmar</option><option value="overdue">Vencido</option></select></FieldLabel>
    <FieldLabel label="Categoria" help="Agrupamento principal usado para organizar e analisar receitas, despesas e investimentos."><select name="category_id" defaultValue={entry?.category_id ?? ""} className={`block w-full ${field}`}><Options placeholder="Sem categoria" rows={workspace.categories.map((item) => ({ id: item.id, label: item.name }))}/></select></FieldLabel>
    <FieldLabel label="Tipo / classificação" help="Classificação complementar para detalhar o lançamento sem substituir sua categoria principal."><select name="classification_category_id" defaultValue={entry?.classification_category_id ?? ""} className={`block w-full ${field}`}><Options placeholder="Sem tipo" rows={workspace.categories.map((item) => ({ id: item.id, label: item.name }))}/></select></FieldLabel>
    <FieldLabel label="Conta" help="Conta associada ao caixa. O saldo é afetado quando o lançamento possui realização e direção de entrada ou saída."><select name="account_id" defaultValue={entry?.account_id ?? ""} className={`block w-full ${field}`}><Options placeholder="Sem conta" rows={workspace.accounts.map((item) => ({ id: item.id, label: item.institution }))}/></select></FieldLabel>
    <FieldLabel label="Cartão" help="Vincula o lançamento ao cartão para agrupamento e acompanhamento das despesas da fatura."><select name="card_id" defaultValue={entry?.card_id ?? ""} className={`block w-full ${field}`}><Options placeholder="Sem cartão" rows={workspace.cards.map((item) => ({ id: item.id, label: item.name }))}/></select></FieldLabel>
    <FieldLabel label="Pessoa relacionada" help="Pessoa da família ligada ao lançamento; permite responsabilidade e filtros por pessoa."><select name="responsible_person_id" defaultValue={entry?.responsible_person_id ?? ""} className={`block w-full ${field}`}><Options placeholder="Sem pessoa" rows={people}/></select></FieldLabel>
    <FieldLabel label="Imóvel" help="Relaciona o lançamento a um imóvel para análises patrimoniais e de receitas ou despesas imobiliárias."><select name="property_id" defaultValue={entry?.property_id ?? ""} className={`block w-full ${field}`}><Options placeholder="Sem imóvel" rows={workspace.properties.map((item) => ({ id: item.id, label: item.title }))}/></select></FieldLabel>
    <FieldLabel label="Contrato" help="Vincula o lançamento a um contrato de locação específico e preserva sua rastreabilidade."><select name="lease_contract_id" defaultValue={entry?.lease_contract_id ?? ""} className={`block w-full ${field}`}><Options placeholder="Sem contrato" rows={workspace.leases.map((item) => ({ id: item.id, label: `${formatDate(item.start_date)} · ${currency.format(item.base_rent)}` }))}/></select></FieldLabel>
    <FieldLabel label="Ativo de investimento" help="Relaciona aportes, resgates ou rendimentos ao ativo correspondente na carteira."><select name="investment_asset_id" defaultValue={entry?.investment_asset_id ?? ""} className={`block w-full ${field}`}><Options placeholder="Sem ativo" rows={workspace.assets.map((item) => ({ id: item.id, label: item.name }))}/></select></FieldLabel>
    <FieldLabel label="Observações" help="Informações complementares para consulta e auditoria; não alteram os cálculos financeiros." className="md:col-span-2"><textarea name="notes" defaultValue={entry?.notes ?? ""} placeholder="Observações opcionais" className={`block w-full ${field}`}/></FieldLabel>
  </>;
}
