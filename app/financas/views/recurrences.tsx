import { Fragment } from "react";
import Link from "next/link";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { DuplicateAmountForm } from "@/app/financas/duplicate-amount-form";
import { createRecurrence, endRecurrence, generateRecurrenceOccurrences, toggleRecurrence, updateRecurrence } from "@/app/financas/actions";
import type { FinanceWorkspace } from "@/lib/finance/types";
import { sortRecurrencesForEditing } from "@/lib/finance/recurrence";
import { currency, danger, Empty, field, FieldLabel, formatDate, FormPanel, Options, panel, SaveButton } from "@/app/financas/views/shared";

export type RecurrenceFilters = {
  query?: string;
  entryType?: string;
  status?: string;
  categoryId?: string;
};

const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

export function RecurrencesView({ workspace, competence, canEdit, filters }: { workspace: FinanceWorkspace; competence: string; canEdit: boolean; filters: RecurrenceFilters }) {
  const orderedRecurrences = sortRecurrencesForEditing(workspace.recurrences).filter((item) => {
    const rule = typeof item.rule === "object" && item.rule && !Array.isArray(item.rule) ? item.rule as Record<string, unknown> : {};
    if (filters.query && !normalized(item.description ?? "").includes(normalized(filters.query))) return false;
    if (filters.entryType && item.entry_type !== filters.entryType) return false;
    if (filters.status === "active" && !item.active) return false;
    if (filters.status === "paused" && (item.active || item.end_date)) return false;
    if (filters.status === "ended" && (item.active || !item.end_date)) return false;
    if (filters.categoryId && item.category_id !== filters.categoryId && rule.classification_category_id !== filters.categoryId) return false;
    return true;
  });
  const categoryRows = workspace.categories.map((row) => ({ id: row.id, label: row.name }));
  const fieldsFor = (item?: FinanceWorkspace["recurrences"][number]) => {
    const rule = typeof item?.rule === "object" && item.rule && !Array.isArray(item.rule) ? item.rule as Record<string, unknown> : {};
    return <>
      <FieldLabel label="Descrição" help="Nome usado para localizar a recorrência e identificar cada lançamento gerado."><input name="description" required defaultValue={item?.description ?? ""} placeholder="Ex.: Condomínio CenterV" className={`block w-full ${field}`}/></FieldLabel>
      <FieldLabel label="Natureza" help="Define se os lançamentos entram como receita a receber ou despesa a pagar."><select name="entry_type" defaultValue={item?.entry_type ?? "expense"} className={`block w-full ${field}`}><option value="expense">Despesa</option><option value="income">Receita</option></select></FieldLabel>
      <FieldLabel label="Valor previsto" help="Valor usado nas novas ocorrências. Alterar a regra não modifica lançamentos que já foram gerados."><input name="expected_amount" required inputMode="decimal" defaultValue={item?.expected_amount ?? ""} placeholder="Ex.: 648,65" className={`block w-full ${field}`}/></FieldLabel>
      <FieldLabel label="Frequência" help="A geração automática atual funciona para recorrências mensais; semanal e anual ficam registradas, mas não são materializadas automaticamente."><select name="frequency" defaultValue={item?.frequency ?? "monthly"} className={`block w-full ${field}`}><option value="monthly">Mensal</option><option value="weekly">Semanal</option><option value="yearly">Anual</option></select></FieldLabel>
      <FieldLabel label="Intervalo" help="Quantidade de períodos entre ocorrências. Em uma recorrência mensal, 1 significa todo mês e 2 significa a cada dois meses."><input name="interval_value" type="number" min="1" max="120" defaultValue={item?.interval_value ?? 1} className={`block w-full ${field}`}/></FieldLabel>
      <FieldLabel label="Dia do mês" help="Dia preferencial do vencimento. Em meses mais curtos, o sistema usa o último dia disponível."><input name="day_of_month" type="number" min="1" max="31" defaultValue={item?.day_of_month ?? ""} placeholder="Ex.: 1" className={`block w-full ${field}`}/></FieldLabel>
      <FieldLabel label="Data inicial" help="Primeira data possível da recorrência. No cadastro, também inicia o ponteiro da próxima ocorrência."><input name="start_date" required type="date" defaultValue={item?.start_date ?? ""} className={`block w-full ${field}`}/></FieldLabel>
      <FieldLabel label="Data final (opcional)" help="Impede a geração depois desta data. Deixe em branco para manter a recorrência sem prazo final."><input name="end_date" type="date" defaultValue={item?.end_date ?? ""} className={`block w-full ${field}`}/></FieldLabel>
      {item && <FieldLabel label="Próxima ocorrência" help="Ponto de partida do próximo lote manual. Para ampliar a visão, informe a quantidade no botão Gerar da recorrência."><input name="next_occurrence" type="date" defaultValue={item.next_occurrence ?? ""} className={`block w-full ${field}`}/></FieldLabel>}
      <FieldLabel label="Categoria" help="Categoria principal usada nos lançamentos gerados."><select name="category_id" defaultValue={item?.category_id ?? ""} className={`block w-full ${field}`}><Options placeholder="Sem categoria" rows={categoryRows}/></select></FieldLabel>
      <FieldLabel label="Tipo / classificação" help="Classificação complementar. Toda categoria ativa cadastrada em Categorias fica disponível aqui."><select name="classification_category_id" defaultValue={typeof rule.classification_category_id === "string" ? rule.classification_category_id : ""} className={`block w-full ${field}`}><Options placeholder="Sem tipo" rows={categoryRows}/></select></FieldLabel>
      <FieldLabel label="Conta" help="Conta relacionada à receita ou despesa; pode ficar em branco quando não se aplica."><select name="account_id" defaultValue={item?.account_id ?? ""} className={`block w-full ${field}`}><Options placeholder="Sem conta" rows={workspace.accounts.map((row) => ({ id: row.id, label: row.institution }))}/></select></FieldLabel>
      <FieldLabel label="Cartão" help="Quando selecionado, as ocorrências são agrupadas no cartão correspondente na Visão Geral."><select name="card_id" defaultValue={item?.card_id ?? ""} className={`block w-full ${field}`}><Options placeholder="Sem cartão" rows={workspace.cards.map((row) => ({ id: row.id, label: row.name }))}/></select></FieldLabel>
    </>;
  };

  return <div className="space-y-5">
    <form className={`${panel} grid gap-3 sm:grid-cols-2 lg:grid-cols-5`}>
      <input type="hidden" name="view" value="recurrences"/>
      <input type="hidden" name="competence" value={competence.slice(0, 7)}/>
      <input name="recurrence_q" defaultValue={filters.query} placeholder="Buscar despesa ou receita recorrente" aria-label="Buscar recorrência" className={field}/>
      <select name="recurrence_type" defaultValue={filters.entryType} aria-label="Filtrar por natureza" className={field}><option value="">Receitas e despesas</option><option value="expense">Despesas</option><option value="income">Receitas</option></select>
      <select name="recurrence_status" defaultValue={filters.status} aria-label="Filtrar por status" className={field}><option value="">Todos os status</option><option value="active">Ativas</option><option value="paused">Pausadas</option><option value="ended">Encerradas</option></select>
      <select name="recurrence_category" defaultValue={filters.categoryId} aria-label="Filtrar por categoria ou tipo" className={field}><Options placeholder="Todas as categorias e tipos" rows={categoryRows}/></select>
      <div className="flex gap-2"><button className="flex-1 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">Filtrar</button><Link href={`/financas?view=recurrences&competence=${competence.slice(0, 7)}`} className="rounded-xl border px-4 py-2.5 text-center text-sm">Limpar</Link></div>
    </form>
    {canEdit && <FormPanel title="Nova recorrência"><DuplicateAmountForm action={createRecurrence} amountField="expected_amount" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{fieldsFor()}<p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">Ao criar uma recorrência mensal, a Visão Geral materializa automaticamente o período selecionado e os 12 meses seguintes. Use “Gerar ocorrências” para ampliar a projeção, por exemplo em mais 15 ocorrências.</p><div className="sm:col-span-2 lg:col-span-3"><SaveButton label="Criar recorrência"/></div></DuplicateAmountForm></FormPanel>}
    <section className={panel}>
      <h2 className="font-semibold">Recorrências</h2>
      {orderedRecurrences.length ? <div className="mt-4 space-y-3">{orderedRecurrences.map((item, index) => <Fragment key={item.id}>
        {!item.active && (index === 0 || orderedRecurrences[index - 1].active) && <div className="mt-6 border-t border-slate-200 pt-5"><h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">Recorrências inativas</h3></div>}
        <article className="rounded-xl border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-semibold">{item.description}</p><p className="text-sm text-slate-500">{item.frequency} · {currency.format(item.expected_amount ?? 0)} · próxima {formatDate(item.next_occurrence)}</p></div><span className={`w-fit rounded-full px-2 py-1 text-xs ${item.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{item.active ? "Ativa" : item.end_date ? "Encerrada" : "Pausada"}</span></div>
          {canEdit && <div className="mt-4 flex flex-wrap items-end gap-2">
            <form action={toggleRecurrence}><input type="hidden" name="id" value={item.id}/><input type="hidden" name="active" value={String(!item.active)}/>{!item.active && <input type="hidden" name="from_competence" value={competence.slice(0, 7)}/>}<SaveButton label={item.active ? "Pausar" : "Reativar"}/></form>
            {item.active && item.frequency === "monthly" && <form action={generateRecurrenceOccurrences} className="flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={item.id}/><FieldLabel label="Quantidade de ocorrências" help="Gera a partir da data Próxima ocorrência. Em uma regra mensal com intervalo 1, digitar 15 cria os próximos 15 meses."><input name="count" type="number" min="1" max="60" defaultValue="15" className={`${field} block w-28`}/></FieldLabel><SaveButton label="Gerar ocorrências"/></form>}
            {item.active && <form action={endRecurrence} className="flex flex-wrap items-end gap-2"><input type="hidden" name="id" value={item.id}/><FieldLabel label="Encerrar a partir de" help="Arquiva apenas ocorrências não realizadas desta competência em diante e preserva o histórico anterior."><input name="from_competence" type="month" required defaultValue={competence.slice(0, 7)} className={`${field} block w-auto`}/></FieldLabel><ConfirmSubmitButton label="Encerrar deste mês em diante" confirmMessage="A recorrência será encerrada e as ocorrências não realizadas deste mês em diante serão arquivadas. Os meses anteriores serão preservados. Continuar?" className={danger}/></form>}
          </div>}
          {canEdit && <FormPanel title="Editar recorrência"><form action={updateRecurrence} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><input type="hidden" name="id" value={item.id}/>{fieldsFor(item)}<p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-3">Salvar altera a regra para as próximas gerações. Lançamentos já gerados são preservados para não sobrescrever ajustes ou pagamentos feitos manualmente.</p><div className="sm:col-span-2 lg:col-span-3"><SaveButton/></div></form></FormPanel>}
        </article>
      </Fragment>)}</div> : <Empty>Nenhuma recorrência encontrada com os filtros selecionados.</Empty>}
    </section>
  </div>;
}
