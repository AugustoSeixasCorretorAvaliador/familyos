import Link from "next/link";
import { DuplicateAmountForm } from "@/app/financas/duplicate-amount-form";
import { createMonthlyProjection, toggleCardSettlement, toggleEntrySettlement } from "@/app/financas/actions";
import { buildTimeline, calculateDashboard, cashflowEntriesForMonth, monthlyEntryAmount } from "@/lib/finance/services";
import { recurrenceRangesFromEntries } from "@/lib/finance/recurrence";
import { installmentProgressLabel, isCardCategoryName, pendingEntriesTotal, placeCardCategoriesLast, settledEntriesTotal, sortCardEntries, sortEntriesAlphabetically } from "@/lib/finance/summary";
import type { FinanceWorkspace, FinancialEntryRow } from "@/lib/finance/types";
import { ArchiveForm, currency, Empty, field, monthLabel, Options, panel, SaveButton } from "@/app/financas/views/shared";

type DashboardAccess = { canEdit: boolean; canAdmin: boolean };
type MonthlyOrder = "alpha" | "category";
type MetricTone = "slate" | "emerald" | "amber" | "red" | "sky";
type MetricItem = { label: string; amount: number; help?: string };
type PrimaryMetricItem = MetricItem & { tone: MetricTone };

function MetricInfo({ label, help, light = false }: { label: string; help: string; light?: boolean }) {
  return <span className="flex items-center gap-1.5">
    <span>{label}</span>
    <span className="group/info relative inline-flex normal-case tracking-normal">
      <button type="button" aria-label={`Como é calculado: ${label}`} className={`grid h-4 w-4 place-items-center rounded-full border text-[10px] font-bold ${light ? "border-white/50 text-white/90" : "border-slate-300 text-slate-500"}`}>i</button>
      <span role="tooltip" className="pointer-events-none invisible absolute right-0 top-full z-30 mt-2 w-72 rounded-xl bg-slate-950 p-3 text-left text-xs font-normal leading-relaxed text-white opacity-0 shadow-xl transition group-hover/info:visible group-hover/info:opacity-100 group-focus-within/info:visible group-focus-within/info:opacity-100">{help}</span>
    </span>
  </span>;
}

function MonthlyProjectionForm({ workspace, competence, entryType }: { workspace: FinanceWorkspace; competence: string; entryType: "income" | "expense" }) {
  const isIncome = entryType === "income";
  const categories = workspace.categories
    .filter((category) => category.category_type === entryType)
    .map((category) => ({ id: category.id, label: category.name }));
  const classificationCategories = workspace.categories.map((category) => ({ id: category.id, label: category.name }));
  const defaultResponsiblePersonId = workspace.people.find((person) =>
    `${person.first_name} ${person.last_name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR") === "augusto seixas"
  )?.id ?? "";

  return <DuplicateAmountForm action={createMonthlyProjection} amountField="expected_amount" className="grid gap-3 sm:grid-cols-2">
    <input type="hidden" name="entry_type" value={entryType}/>
    <input type="hidden" name="competence" value={competence.slice(0, 7)}/>
    <input type="hidden" name="months_ahead" value="12"/>
    <input name="description" required placeholder={isIncome ? "Ex.: Aposentadoria, aluguel, comissão" : "Ex.: Luz, condomínio, academia, IPTU"} className={`${field} sm:col-span-2`}/>
    <input name="expected_amount" required inputMode="decimal" placeholder="Valor mensal" className={field}/>
    <select name="category_id" className={field}><Options placeholder="Categoria (opcional)" rows={categories}/></select>
    <select name="classification_category_id" className={field} aria-label="Tipo"><Options placeholder="Tipo (opcional)" rows={classificationCategories}/></select>
    <select name="account_id" className={field}><Options placeholder="Conta (opcional)" rows={workspace.accounts.map((account) => ({ id: account.id, label: account.institution }))}/></select>
    <select name="property_id" className={field}><Options placeholder={isIncome ? "Imóvel do aluguel (opcional)" : "Imóvel relacionado (opcional)"} rows={workspace.properties.map((property) => ({ id: property.id, label: property.title }))}/></select>
    <select name="responsible_person_id" defaultValue={defaultResponsiblePersonId} className={field} aria-label="Pessoa relacionada"><Options placeholder="Pessoa relacionada (opcional)" rows={workspace.people.map((person) => ({ id: person.id, label: `${person.first_name} ${person.last_name}` }))}/></select>
    <p className="text-xs text-slate-500 sm:col-span-2">O valor entra em {monthLabel(competence)} e é provisionado automaticamente nos 12 meses seguintes. Os meses futuros podem ser ajustados depois.</p>
    <div className="sm:col-span-2"><SaveButton label={isIncome ? "Adicionar receita mensal" : "Adicionar despesa mensal"}/></div>
  </DuplicateAmountForm>;
}

function MonthlyEntryList({ title, entries, workspace, recurrenceRanges, competence, kind, orderMode, incomeOrder, expenseOrder, canEdit, canAdmin }: { title: string; entries: FinancialEntryRow[]; workspace: FinanceWorkspace; recurrenceRanges: Map<string, { start: string; end: string }>; competence: string; kind: "income" | "expense"; orderMode: MonthlyOrder; incomeOrder: MonthlyOrder; expenseOrder: MonthlyOrder; canEdit: boolean; canAdmin: boolean }) {
  const categoryName = (entry: FinancialEntryRow) => workspace.categories.find((item) => item.id === entry.category_id)?.name ?? "Sem categoria";
  const classificationName = (entry: FinancialEntryRow) => workspace.categories.find((item) => item.id === entry.classification_category_id)?.name;
  const alphabetical = sortEntriesAlphabetically(entries);
  const orderedEntries = kind === "expense" ? placeCardCategoriesLast(alphabetical, categoryName) : alphabetical;
  const categoryGroups = new Map<string, FinancialEntryRow[]>();
  for (const entry of orderedEntries) {
    const name = categoryName(entry);
    categoryGroups.set(name, [...(categoryGroups.get(name) ?? []), entry]);
  }
  const alphabeticGroups = Array.from(categoryGroups).sort(([left], [right]) => left.localeCompare(right, "pt-BR", { sensitivity: "base" }));
  const groups = orderMode === "category"
    ? kind === "expense" ? placeCardCategoriesLast(alphabeticGroups, ([name]) => name) : alphabeticGroups
    : [["", orderedEntries] as [string, FinancialEntryRow[]]];
  const orderHref = (mode: MonthlyOrder) => {
    const params = new URLSearchParams({ view: "overview", competence: competence.slice(0, 7), income_order: incomeOrder, expense_order: expenseOrder });
    params.set(kind === "income" ? "income_order" : "expense_order", mode);
    return `/financas?${params.toString()}`;
  };
  const settledLabel = kind === "income" ? "RECEBIDO" : "PAGO";
  const pendingLabel = kind === "income" ? "A RECEBER" : "A PAGAR";
  const settledTotal = settledEntriesTotal(entries);
  const pendingTotal = pendingEntriesTotal(entries);
  const monthYear = (value: string) => `${value.slice(5, 7)}/${value.slice(0, 4)}`;
  return <section className={panel}>
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-900">{title}</h2><span className="text-sm font-semibold text-slate-700">{currency.format(entries.reduce((sum, entry) => sum + monthlyEntryAmount(entry), 0))}</span></div>
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span className="font-medium text-slate-500">Ordenar:</span><Link href={orderHref("alpha")} className={`rounded-full border px-3 py-1.5 font-semibold ${orderMode === "alpha" ? "border-sky-600 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-600"}`}>Alfabético</Link><Link href={orderHref("category")} className={`rounded-full border px-3 py-1.5 font-semibold ${orderMode === "category" ? "border-sky-600 bg-sky-50 text-sky-700" : "border-slate-200 text-slate-600"}`}>Por categoria</Link></div>
    {entries.length ? <div className="mt-4 space-y-4">{groups.map(([groupName, groupEntries]) => {
      const groupTotal = currency.format(groupEntries.reduce((sum, entry) => sum + monthlyEntryAmount(entry), 0));
      const cardId = groupEntries.find((entry) => entry.card_id)?.card_id ?? null;
      const individualCardEntries = cardId ? groupEntries.filter((entry) => entry.card_id === cardId && entry.entry_type === "expense" && !entry.source_key?.startsWith("card-balance:")) : [];
      const cardPaid = individualCardEntries.length > 0 && individualCardEntries.every((entry) => entry.actual_amount !== null);
      const displayedEntries = kind === "expense" && orderMode === "category" && isCardCategoryName(groupName) ? sortCardEntries(groupEntries) : groupEntries;
      const entryRows = <div className="divide-y divide-slate-100">{displayedEntries.map((entry) => {
      const isSettled = entry.actual_amount !== null;
      const installmentLabel = installmentProgressLabel(entry);
      const recurrenceRange = entry.recurrence_id ? recurrenceRanges.get(entry.recurrence_id) : undefined;
      const editParams = new URLSearchParams({ view: "movements", competence: entry.competence.slice(0, 7), q: entry.description, return_view: "overview", return_competence: competence.slice(0, 7), income_order: incomeOrder, expense_order: expenseOrder });
      return <article key={entry.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="truncate font-medium text-slate-900">{entry.description}</p><p className="text-xs text-slate-500">{categoryName(entry)}{classificationName(entry) ? ` · Tipo: ${classificationName(entry)}` : ""} · {isSettled ? "realizado" : "provisionado"}{entry.source_key?.startsWith("card-balance:") ? " · cartão consolidado" : ""}</p></div>
        <div className="shrink-0"><div className="flex flex-wrap items-center gap-3">{canEdit && <form action={toggleEntrySettlement}><input type="hidden" name="id" value={entry.id}/><input type="hidden" name="settled" value={String(!isSettled)}/><input type="hidden" name="competence" value={competence.slice(0, 7)}/><input type="hidden" name="income_order" value={incomeOrder}/><input type="hidden" name="expense_order" value={expenseOrder}/><button type="submit" aria-pressed={isSettled} title={`${settledLabel}: ${isSettled ? "ON" : "OFF"}`} className={`rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition ${isSettled ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>{settledLabel} · {isSettled ? "ON" : "OFF"}</button></form>}<span className="flex flex-col items-end"><span className="font-semibold tabular-nums">{currency.format(monthlyEntryAmount(entry))}</span>{installmentLabel && <strong className="text-xs font-bold text-slate-700">{installmentLabel}</strong>}</span><Link href={`/financas?${editParams.toString()}`} className="text-xs font-semibold text-sky-700 underline">Editar</Link>{canAdmin && <ArchiveForm id={entry.id} entity="entry" label="Arquivar" returnView="overview" returnCompetence={competence} incomeOrder={incomeOrder} expenseOrder={expenseOrder}/>}</div>{recurrenceRange && <p className="mt-1 text-right text-[11px] font-medium text-sky-700">Recorrente de: {monthYear(recurrenceRange.start)} a {monthYear(recurrenceRange.end)}</p>}</div>
      </article>;
      })}</div>;

      if (kind === "expense" && orderMode === "category" && groupName) {
        return <details key={groupName} open={!isCardCategoryName(groupName)} className="group overflow-hidden rounded-xl border border-slate-100">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-slate-50 px-3 py-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">{groupName}</h3>
            <span className="flex shrink-0 items-center gap-3">
              <span className="text-xs font-semibold text-slate-500">{groupTotal}</span>
              {canEdit && cardId && individualCardEntries.length > 0 && <form action={toggleCardSettlement}><input type="hidden" name="card_id" value={cardId}/><input type="hidden" name="competence" value={competence.slice(0, 7)}/><input type="hidden" name="settled" value={String(!cardPaid)}/><input type="hidden" name="income_order" value={incomeOrder}/><input type="hidden" name="expense_order" value={expenseOrder}/><button type="submit" aria-pressed={cardPaid} title={`Marcar todas as despesas do cartão como ${cardPaid ? "não pagas" : "pagas"}`} className={`rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition ${cardPaid ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}>PAGO · {cardPaid ? "ON" : "OFF"}</button></form>}
              <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-white text-sm font-bold text-sky-700 shadow-sm">
                <span className="group-open:hidden">+</span>
                <span className="hidden group-open:inline">V</span>
              </span>
            </span>
          </summary>
          <div className="px-3">{entryRows}</div>
        </details>;
      }

      return <div key={groupName || "all"}>{groupName && <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">{groupName}</h3><span className="text-xs font-semibold text-slate-500">{groupTotal}</span></div>}{entryRows}</div>;
    })}</div> : <Empty>Nenhum valor cadastrado neste mês.</Empty>}
    <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><span className="text-xs font-bold uppercase tracking-wider text-emerald-700">TOTAL {settledLabel}</span><strong className="mt-2 block text-xl tabular-nums text-slate-900">{currency.format(settledTotal)}</strong></div><div className="rounded-2xl border border-red-200 bg-red-50 p-4"><span className="text-xs font-bold uppercase tracking-wider text-red-700">TOTAL {pendingLabel}</span><strong className="mt-2 block text-xl tabular-nums text-slate-900">{currency.format(pendingTotal)}</strong></div></div>
  </section>;
}

export function DashboardView({ workspace, competence, incomeOrder, expenseOrder, canEdit, canAdmin }: { workspace: FinanceWorkspace; competence: string; incomeOrder: MonthlyOrder; expenseOrder: MonthlyOrder } & DashboardAccess) {
  const metrics = calculateDashboard(workspace, competence);
  const monthEntries = cashflowEntriesForMonth(workspace.entries, competence);
  const incomeEntries = monthEntries.filter((entry) => ["income", "investment_yield"].includes(entry.entry_type));
  const expenseEntries = monthEntries.filter((entry) => ["expense", "reversal"].includes(entry.entry_type));
  const primaryItems: PrimaryMetricItem[] = [
    { label: "Receitas do mês", amount: metrics.monthlyIncome, tone: "emerald" },
    { label: "Despesas do mês", amount: metrics.monthlyExpense, tone: "amber" },
    { label: "Resultado do mês", amount: metrics.monthlyResult, tone: metrics.monthlyResult >= 0 ? "sky" : "red", help: "Receitas do mês menos despesas do mês. Usa o valor realizado quando informado e o valor previsto para o que ainda está pendente. Não inclui o saldo anterior das contas." },
    { label: "Investimentos", amount: metrics.investments, tone: "slate" },
  ];
  const secondaryItems: MetricItem[] = [
    { label: "Recebido", amount: metrics.actualIncome }, { label: "Pago", amount: metrics.actualExpense },
    { label: "Saldo em contas", amount: metrics.available },
    { label: "Saldo projetado", amount: metrics.projected, help: "No mês atual: saldo atual das contas mais valores ainda a receber, menos valores ainda a pagar. Nos meses seguintes: saldo projetado do mês anterior mais receitas, menos despesas do mês." },
  ];
  const tones = { slate: "from-slate-900 to-slate-700", emerald: "from-emerald-700 to-emerald-500", amber: "from-amber-600 to-orange-500", red: "from-rose-700 to-red-500", sky: "from-sky-700 to-cyan-500" };
  const months = buildTimeline(workspace.entries, competence);
  const recurrenceRanges = recurrenceRangesFromEntries(workspace.entries);
  const scale = Math.max(...months.map((item) => Math.max(item.income, item.expense)), 1);

  return <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{primaryItems.map(({ label, amount, tone, help }) => <article key={label} className={`rounded-2xl bg-gradient-to-br ${tones[tone]} p-5 text-white shadow-sm`}><p className="text-xs font-semibold uppercase tracking-wider text-white/70">{help ? <MetricInfo label={label} help={help} light/> : label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{currency.format(amount)}</p></article>)}</section>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{secondaryItems.map(({ label, amount, help }) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{help ? <MetricInfo label={label} help={help}/> : label}</p><p className={`mt-2 text-lg font-semibold tabular-nums ${amount < 0 ? "text-red-600" : "text-slate-900"}`}>{currency.format(amount)}</p></article>)}</section>

    {canEdit && <details className="group"><summary className="mb-4 flex cursor-pointer list-none items-center justify-between rounded-2xl border border-sky-200 bg-white px-4 py-3 font-semibold text-slate-900 shadow-sm"><span>Adicionar receitas e despesas mensais</span><span className="rounded-full bg-sky-100 px-3 py-1 text-xs text-sky-700"><span className="group-open:hidden">Exibir os 2 quadros</span><span className="hidden group-open:inline">Recolher os 2 quadros</span></span></summary><section className="grid gap-5 lg:grid-cols-2"><div className={panel}><div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Entradas</p><h2 className="text-lg font-semibold text-slate-900">Nova receita mensal</h2></div><MonthlyProjectionForm workspace={workspace} competence={competence} entryType="income"/></div><div className={panel}><div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Saídas</p><h2 className="text-lg font-semibold text-slate-900">Nova despesa mensal</h2></div><MonthlyProjectionForm workspace={workspace} competence={competence} entryType="expense"/></div></section></details>}

    <section className="grid gap-5 lg:grid-cols-2"><MonthlyEntryList title="Receitas consideradas no mês" entries={incomeEntries} workspace={workspace} recurrenceRanges={recurrenceRanges} competence={competence} kind="income" orderMode={incomeOrder} incomeOrder={incomeOrder} expenseOrder={expenseOrder} canEdit={canEdit} canAdmin={canAdmin}/><MonthlyEntryList title="Despesas consideradas no mês" entries={expenseEntries} workspace={workspace} recurrenceRanges={recurrenceRanges} competence={competence} kind="expense" orderMode={expenseOrder} incomeOrder={incomeOrder} expenseOrder={expenseOrder} canEdit={canEdit} canAdmin={canAdmin}/></section>

    <section className={panel}><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-semibold text-slate-900">Linha do tempo · 24 meses</h2><p className="text-sm text-slate-500">Receitas menos despesas, incluindo as provisões mínimas futuras.</p></div><p className="text-xs text-slate-500">Cartões detalhados não são somados quando existe saldo consolidado no mês.</p></div>{months.length ? <div className="mt-5 flex gap-3 overflow-x-auto pb-3">{months.map((month) => <Link key={month.competence} href={`/financas?view=overview&competence=${month.competence.slice(0, 7)}`} className={`min-w-28 rounded-xl border p-3 ${month.competence === competence ? "border-sky-500 bg-sky-50" : "border-slate-200"}`}><p className="text-xs font-semibold uppercase text-slate-500">{monthLabel(month.competence)}</p><div className="mt-3 flex h-20 items-end gap-1"><span className="w-1/2 rounded-t bg-emerald-400" style={{ height: `${Math.max(3, month.income / scale * 100)}%` }}/><span className="w-1/2 rounded-t bg-rose-400" style={{ height: `${Math.max(3, month.expense / scale * 100)}%` }}/></div><p className={`mt-2 text-xs font-semibold ${month.result >= 0 ? "text-emerald-700" : "text-red-600"}`}>{currency.format(month.result)}</p></Link>)}</div> : <Empty>Não há lançamentos para projetar.</Empty>}</section>
  </div>;
}

export function AlertsView({ workspace, competence }: { workspace: FinanceWorkspace; competence: string }) {
  const metrics = calculateDashboard(workspace, competence);
  return <section className={panel}><h2 className="font-semibold">Alertas financeiros</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{metrics.overdue > 0 && <article className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="font-semibold text-red-800">{metrics.overdue} lançamento(s) vencido(s)</p><Link href="/financas?view=movements&status=overdue" className="text-sm text-red-700 underline">Revisar</Link></article>}{workspace.alerts.map((alert) => <article key={alert.id} className="rounded-xl border p-4"><p className="font-semibold">{alert.name}</p><p className="text-sm text-slate-500">{alert.rule_type} · {alert.active ? "ativo" : "pausado"}</p></article>)}{!metrics.overdue && !workspace.alerts.length && <Empty>Nenhum alerta ativo.</Empty>}</div></section>;
}
