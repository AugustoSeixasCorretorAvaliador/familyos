import Link from "next/link";
import { createMonthlyProjection } from "@/app/financas/actions";
import { buildTimeline, calculateDashboard, cashflowEntriesForMonth, monthlyEntryAmount } from "@/lib/finance/services";
import type { FinanceWorkspace, FinancialEntryRow } from "@/lib/finance/types";
import { ArchiveForm, currency, Empty, field, monthLabel, Options, panel, SaveButton } from "@/app/financas/views/shared";

type DashboardAccess = { canEdit: boolean; canAdmin: boolean };

function MonthlyProjectionForm({ workspace, competence, entryType }: { workspace: FinanceWorkspace; competence: string; entryType: "income" | "expense" }) {
  const isIncome = entryType === "income";
  const categories = workspace.categories
    .filter((category) => category.category_type === entryType)
    .map((category) => ({ id: category.id, label: category.name }));

  return <form action={createMonthlyProjection} className="grid gap-3 sm:grid-cols-2">
    <input type="hidden" name="entry_type" value={entryType}/>
    <input type="hidden" name="competence" value={competence.slice(0, 7)}/>
    <input type="hidden" name="months_ahead" value="12"/>
    <input name="description" required placeholder={isIncome ? "Ex.: Aposentadoria, aluguel, comissão" : "Ex.: Luz, condomínio, academia, IPTU"} className={`${field} sm:col-span-2`}/>
    <input name="expected_amount" required inputMode="decimal" placeholder="Valor mensal" className={field}/>
    <select name="category_id" className={field}><Options placeholder="Categoria (opcional)" rows={categories}/></select>
    <select name="account_id" className={field}><Options placeholder="Conta (opcional)" rows={workspace.accounts.map((account) => ({ id: account.id, label: account.institution }))}/></select>
    <select name="property_id" className={field}><Options placeholder={isIncome ? "Imóvel do aluguel (opcional)" : "Imóvel relacionado (opcional)"} rows={workspace.properties.map((property) => ({ id: property.id, label: property.title }))}/></select>
    <p className="text-xs text-slate-500 sm:col-span-2">O valor entra em {monthLabel(competence)} e é provisionado automaticamente nos 12 meses seguintes. Os meses futuros podem ser ajustados depois.</p>
    <div className="sm:col-span-2"><SaveButton label={isIncome ? "Adicionar receita mensal" : "Adicionar despesa mensal"}/></div>
  </form>;
}

function MonthlyEntryList({ title, entries, workspace, canAdmin }: { title: string; entries: FinancialEntryRow[]; workspace: FinanceWorkspace; canAdmin: boolean }) {
  return <section className={panel}>
    <div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-slate-900">{title}</h2><span className="text-sm font-semibold text-slate-700">{currency.format(entries.reduce((sum, entry) => sum + monthlyEntryAmount(entry), 0))}</span></div>
    {entries.length ? <div className="mt-4 divide-y divide-slate-100">{entries.map((entry) => {
      const category = workspace.categories.find((item) => item.id === entry.category_id)?.name;
      return <article key={entry.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="truncate font-medium text-slate-900">{entry.description}</p><p className="text-xs text-slate-500">{category ?? "Sem categoria"} · {entry.actual_amount === null ? "provisionado" : "realizado"}{entry.source_key?.startsWith("card-balance:") ? " · cartão consolidado" : ""}</p></div>
        <div className="flex shrink-0 items-center gap-3"><span className="font-semibold tabular-nums">{currency.format(monthlyEntryAmount(entry))}</span><Link href={`/financas?view=movements&competence=${entry.competence.slice(0, 7)}&q=${encodeURIComponent(entry.description)}`} className="text-xs font-semibold text-sky-700 underline">Editar</Link>{canAdmin && <ArchiveForm id={entry.id} entity="entry" label="Arquivar"/>}</div>
      </article>;
    })}</div> : <Empty>Nenhum valor cadastrado neste mês.</Empty>}
  </section>;
}

export function DashboardView({ workspace, competence, canEdit, canAdmin }: { workspace: FinanceWorkspace; competence: string } & DashboardAccess) {
  const metrics = calculateDashboard(workspace, competence);
  const monthEntries = cashflowEntriesForMonth(workspace.entries, competence);
  const incomeEntries = monthEntries.filter((entry) => ["income", "investment_yield"].includes(entry.entry_type));
  const expenseEntries = monthEntries.filter((entry) => entry.entry_type === "expense");
  const primaryItems = [
    ["Receitas do mês", metrics.monthlyIncome, "emerald"],
    ["Despesas do mês", metrics.monthlyExpense, "amber"],
    ["Saldo do mês", metrics.monthlyResult, metrics.monthlyResult >= 0 ? "sky" : "red"],
    ["Investimentos", metrics.investments, "slate"],
  ] as const;
  const secondaryItems = [
    ["Recebido", metrics.actualIncome], ["Pago", metrics.actualExpense],
    ["Saldo em contas", metrics.available], ["Saldo projetado", metrics.projected],
  ] as const;
  const tones = { slate: "from-slate-900 to-slate-700", emerald: "from-emerald-700 to-emerald-500", amber: "from-amber-600 to-orange-500", red: "from-rose-700 to-red-500", sky: "from-sky-700 to-cyan-500" };
  const months = buildTimeline(workspace.entries, competence);
  const scale = Math.max(...months.map((item) => Math.max(item.income, item.expense)), 1);

  return <div className="space-y-5">
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{primaryItems.map(([label, amount, tone]) => <article key={label} className={`rounded-2xl bg-gradient-to-br ${tones[tone]} p-5 text-white shadow-sm`}><p className="text-xs font-semibold uppercase tracking-wider text-white/70">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{currency.format(amount)}</p></article>)}</section>
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{secondaryItems.map(([label, amount]) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 text-lg font-semibold tabular-nums ${amount < 0 ? "text-red-600" : "text-slate-900"}`}>{currency.format(amount)}</p></article>)}</section>

    {canEdit && <section className="grid gap-5 lg:grid-cols-2"><div className={panel}><div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Entradas</p><h2 className="text-lg font-semibold text-slate-900">Nova receita mensal</h2></div><MonthlyProjectionForm workspace={workspace} competence={competence} entryType="income"/></div><div className={panel}><div className="mb-4"><p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Saídas</p><h2 className="text-lg font-semibold text-slate-900">Nova despesa mensal</h2></div><MonthlyProjectionForm workspace={workspace} competence={competence} entryType="expense"/></div></section>}

    <section className="grid gap-5 lg:grid-cols-2"><MonthlyEntryList title="Receitas consideradas no mês" entries={incomeEntries} workspace={workspace} canAdmin={canAdmin}/><MonthlyEntryList title="Despesas consideradas no mês" entries={expenseEntries} workspace={workspace} canAdmin={canAdmin}/></section>

    <section className={panel}><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="font-semibold text-slate-900">Linha do tempo · 24 meses</h2><p className="text-sm text-slate-500">Receitas menos despesas, incluindo as provisões mínimas futuras.</p></div><p className="text-xs text-slate-500">Cartões detalhados não são somados quando existe saldo consolidado no mês.</p></div>{months.length ? <div className="mt-5 flex gap-3 overflow-x-auto pb-3">{months.map((month) => <Link key={month.competence} href={`/financas?view=overview&competence=${month.competence.slice(0, 7)}`} className={`min-w-28 rounded-xl border p-3 ${month.competence === competence ? "border-sky-500 bg-sky-50" : "border-slate-200"}`}><p className="text-xs font-semibold uppercase text-slate-500">{monthLabel(month.competence)}</p><div className="mt-3 flex h-20 items-end gap-1"><span className="w-1/2 rounded-t bg-emerald-400" style={{ height: `${Math.max(3, month.income / scale * 100)}%` }}/><span className="w-1/2 rounded-t bg-rose-400" style={{ height: `${Math.max(3, month.expense / scale * 100)}%` }}/></div><p className={`mt-2 text-xs font-semibold ${month.result >= 0 ? "text-emerald-700" : "text-red-600"}`}>{currency.format(month.result)}</p></Link>)}</div> : <Empty>Não há lançamentos para projetar.</Empty>}</section>
  </div>;
}

export function AlertsView({ workspace, competence }: { workspace: FinanceWorkspace; competence: string }) {
  const metrics = calculateDashboard(workspace, competence);
  return <section className={panel}><h2 className="font-semibold">Alertas financeiros</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{metrics.overdue > 0 && <article className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="font-semibold text-red-800">{metrics.overdue} lançamento(s) vencido(s)</p><Link href="/financas?view=movements&status=overdue" className="text-sm text-red-700 underline">Revisar</Link></article>}{workspace.alerts.map((alert) => <article key={alert.id} className="rounded-xl border p-4"><p className="font-semibold">{alert.name}</p><p className="text-sm text-slate-500">{alert.rule_type} · {alert.active ? "ativo" : "pausado"}</p></article>)}{!metrics.overdue && !workspace.alerts.length && <Empty>Nenhum alerta ativo.</Empty>}</div></section>;
}
