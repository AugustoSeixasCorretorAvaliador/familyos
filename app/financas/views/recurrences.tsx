import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { createRecurrence, endRecurrence, generateRecurrenceOccurrences, toggleRecurrence, updateRecurrence } from "@/app/financas/actions";
import type { FinanceWorkspace } from "@/lib/finance/types";
import { currency, danger, Empty, field, formatDate, FormPanel, Options, panel, SaveButton } from "@/app/financas/views/shared";

export function RecurrencesView({ workspace, competence, canEdit }: { workspace: FinanceWorkspace; competence: string; canEdit: boolean }) {
  const fieldsFor = (item?: FinanceWorkspace["recurrences"][number]) => <>
    <input name="description" required defaultValue={item?.description ?? ""} placeholder="Descrição" className={field}/>
    <select name="entry_type" defaultValue={item?.entry_type ?? "expense"} className={field}><option value="expense">Despesa</option><option value="income">Receita</option></select>
    <input name="expected_amount" required inputMode="decimal" defaultValue={item?.expected_amount ?? ""} placeholder="Valor previsto" className={field}/>
    <select name="frequency" defaultValue={item?.frequency ?? "monthly"} className={field}><option value="monthly">Mensal</option><option value="weekly">Semanal</option><option value="yearly">Anual</option></select>
    <input name="interval_value" type="number" min="1" defaultValue={item?.interval_value ?? 1} className={field}/>
    <input name="day_of_month" type="number" min="1" max="31" defaultValue={item?.day_of_month ?? ""} placeholder="Dia do mês" className={field}/>
    <input name="start_date" required type="date" defaultValue={item?.start_date ?? ""} className={field}/>
    <input name="end_date" type="date" defaultValue={item?.end_date ?? ""} className={field}/>
    {item && <input name="next_occurrence" type="date" defaultValue={item.next_occurrence ?? ""} className={field}/>}
    <select name="category_id" defaultValue={item?.category_id ?? ""} className={field}><Options placeholder="Categoria" rows={workspace.categories.map((row) => ({ id: row.id, label: row.name }))}/></select>
    <select name="account_id" defaultValue={item?.account_id ?? ""} className={field}><Options placeholder="Conta" rows={workspace.accounts.map((row) => ({ id: row.id, label: row.institution }))}/></select>
    <select name="card_id" defaultValue={item?.card_id ?? ""} className={field}><Options placeholder="Cartão" rows={workspace.cards.map((row) => ({ id: row.id, label: row.name }))}/></select>
  </>;

  return <div className="space-y-5">
    {canEdit && <FormPanel title="Nova recorrência"><form action={createRecurrence} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {fieldsFor()}
      <div className="sm:col-span-2 lg:col-span-3"><SaveButton label="Criar recorrência"/></div>
    </form></FormPanel>}
    <section className={panel}>
      <h2 className="font-semibold">Recorrências</h2>
      {workspace.recurrences.length ? <div className="mt-4 space-y-3">{workspace.recurrences.map((item) => <article key={item.id} className="rounded-xl border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="font-semibold">{item.description}</p><p className="text-sm text-slate-500">{item.frequency} · {currency.format(item.expected_amount ?? 0)} · próxima {formatDate(item.next_occurrence)}</p></div>
          <span className={`w-fit rounded-full px-2 py-1 text-xs ${item.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.active ? "Ativa" : item.end_date ? "Encerrada" : "Pausada"}</span>
        </div>
        {canEdit && <div className="mt-4 flex flex-wrap gap-2">
          <form action={toggleRecurrence}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="active" value={String(!item.active)}/><SaveButton label={item.active ? "Pausar" : "Reativar"}/></form>
          {item.active && <form action={generateRecurrenceOccurrences} className="flex gap-2"><input type="hidden" name="id" value={item.id}/><input name="count" type="number" min="1" max="24" defaultValue="3" aria-label="Quantidade de ocorrências" className={`${field} w-24`}/><SaveButton label="Gerar"/></form>}
          {item.active && <form action={endRecurrence} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="id" value={item.id}/>
            <label className="text-xs font-medium text-slate-600">Encerrar a partir de</label>
            <input name="from_competence" type="month" required defaultValue={competence.slice(0, 7)} aria-label="Competência inicial do encerramento" className={`${field} w-auto`}/>
            <ConfirmSubmitButton label="Encerrar deste mês em diante" confirmMessage="A recorrência será encerrada e as ocorrências não realizadas deste mês em diante serão arquivadas. Os meses anteriores serão preservados. Continuar?" className={danger}/>
          </form>}
        </div>}
        {canEdit && <FormPanel title="Editar recorrência"><form action={updateRecurrence} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><input type="hidden" name="id" value={item.id}/>{fieldsFor(item)}<div className="sm:col-span-2 lg:col-span-3"><SaveButton/></div></form></FormPanel>}
      </article>)}</div> : <Empty>Nenhuma recorrência cadastrada.</Empty>}
    </section>
  </div>;
}
