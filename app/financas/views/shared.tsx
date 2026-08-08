import type { ReactNode } from "react";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { SubmitButton } from "@/app/components/submit-button";
import { archiveFinanceRecord } from "@/app/financas/actions";
import { currentCompetence } from "@/lib/finance/services";
import type { FinanceWorkspace, FinancialEntryRow } from "@/lib/finance/types";

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

export function FormPanel({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return <details open={open} className={`${panel} group`}><summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-900"><span>{title}</span><span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-sky-100 text-sky-700 transition group-open:rotate-45">+</span></summary><div className="mt-5">{children}</div></details>;
}

export function SaveButton({ label = "Salvar alterações" }: { label?: string }) {
  return <SubmitButton label={label} pendingLabel="Processando..." className={primary}/>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function ArchiveForm({ id, entity, label = "Arquivar" }: { id: string; entity: string; label?: string }) {
  return <form action={archiveFinanceRecord}><input type="hidden" name="id" value={id}/><input type="hidden" name="entity" value={entity}/><ConfirmSubmitButton label={label} confirmMessage="Esta ação arquiva o registro sem apagar o histórico. Deseja continuar?" className={danger}/></form>;
}

export function EntryFields({ workspace, entry }: { workspace: FinanceWorkspace; entry?: FinancialEntryRow }) {
  const people = workspace.people.map((person) => ({ id: person.id, label: `${person.first_name} ${person.last_name}` }));
  return <>
    <input name="description" required defaultValue={entry?.description} placeholder="Descrição" className={`${field} md:col-span-2`}/>
    <select name="entry_type" required defaultValue={entry?.entry_type ?? "expense"} className={field}><option value="expense">Despesa</option><option value="income">Receita</option><option value="investment_application">Aporte</option><option value="investment_redemption">Resgate</option><option value="investment_yield">Rendimento</option><option value="adjustment">Ajuste</option></select>
    <input name="competence" type="month" required defaultValue={(entry?.competence ?? currentCompetence()).slice(0, 7)} className={field}/>
    <input name="expected_amount" required inputMode="decimal" defaultValue={entry?.expected_amount} placeholder="Valor previsto" className={field}/><input name="actual_amount" inputMode="decimal" defaultValue={entry?.actual_amount ?? ""} placeholder="Valor realizado" className={field}/>
    <input name="expected_date" type="date" defaultValue={entry?.expected_date ?? ""} className={field}/><input name="due_date" type="date" defaultValue={entry?.due_date ?? ""} className={field}/><input name="effective_date" type="date" defaultValue={entry?.effective_date ?? ""} className={field}/>
    <select name="status" defaultValue={entry?.status ?? "planned"} className={field}><option value="planned">Planejado</option><option value="payable">A pagar</option><option value="receivable">A receber</option><option value="paid">Pago</option><option value="received">Recebido</option><option value="pending_confirmation">A confirmar</option><option value="overdue">Vencido</option></select>
    <select name="category_id" defaultValue={entry?.category_id ?? ""} className={field}><Options placeholder="Categoria" rows={workspace.categories.map((item) => ({ id: item.id, label: item.name }))}/></select>
    <select name="classification_category_id" defaultValue={entry?.classification_category_id ?? ""} className={field} aria-label="Tipo"><Options placeholder="Tipo (opcional)" rows={workspace.categories.map((item) => ({ id: item.id, label: item.name }))}/></select>
    <select name="account_id" defaultValue={entry?.account_id ?? ""} className={field}><Options placeholder="Conta" rows={workspace.accounts.map((item) => ({ id: item.id, label: item.institution }))}/></select>
    <select name="card_id" defaultValue={entry?.card_id ?? ""} className={field}><Options placeholder="Cartão" rows={workspace.cards.map((item) => ({ id: item.id, label: item.name }))}/></select>
    <select name="responsible_person_id" defaultValue={entry?.responsible_person_id ?? ""} className={field}><Options placeholder="Pessoa" rows={people}/></select>
    <select name="property_id" defaultValue={entry?.property_id ?? ""} className={field}><Options placeholder="Imóvel" rows={workspace.properties.map((item) => ({ id: item.id, label: item.title }))}/></select>
    <select name="lease_contract_id" defaultValue={entry?.lease_contract_id ?? ""} className={field}><Options placeholder="Contrato" rows={workspace.leases.map((item) => ({ id: item.id, label: `${formatDate(item.start_date)} · ${currency.format(item.base_rent)}` }))}/></select>
    <select name="investment_asset_id" defaultValue={entry?.investment_asset_id ?? ""} className={field}><Options placeholder="Ativo" rows={workspace.assets.map((item) => ({ id: item.id, label: item.name }))}/></select>
    <textarea name="notes" defaultValue={entry?.notes ?? ""} placeholder="Observações" className={field}/>
  </>;
}
