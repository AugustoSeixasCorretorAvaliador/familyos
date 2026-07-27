import Link from "next/link";
import { buildTimeline, calculateDashboard } from "@/lib/finance/services";
import type { FinanceWorkspace } from "@/lib/finance/types";
import { currency, Empty, monthLabel, panel } from "@/app/financas/views/shared";

export function DashboardView({ workspace, competence }: { workspace: FinanceWorkspace; competence: string }) {
  const metrics = calculateDashboard(workspace, competence);
  const items = [
    ["Saldo disponível", metrics.available, "sky"], ["Saldo projetado", metrics.projected, metrics.projected >= 0 ? "emerald" : "red"],
    ["Receitas realizadas", metrics.actualIncome, "emerald"], ["Despesas realizadas", metrics.actualExpense, "amber"],
    ["Resultado mensal", metrics.monthlyResult, metrics.monthlyResult >= 0 ? "emerald" : "red"], ["Faturas abertas", metrics.invoices, "slate"],
    ["Compromissos futuros", metrics.futureCommitments, "amber"], ["Patrimônio financeiro", metrics.investments, "sky"],
    ["Receita de aluguéis", metrics.rentalIncome, "emerald"], ["Despesas de imóveis", metrics.propertyExpenses, "amber"],
    ["Resultado imobiliário", metrics.propertyNet, metrics.propertyNet >= 0 ? "emerald" : "red"],
  ] as const;
  const tones = { slate: "from-slate-900 to-slate-700", emerald: "from-emerald-700 to-emerald-500", amber: "from-amber-600 to-orange-500", red: "from-rose-700 to-red-500", sky: "from-sky-700 to-cyan-500" };
  const months = buildTimeline(workspace.entries, competence);
  const scale = Math.max(...months.map((item) => Math.max(item.income, item.expense)), 1);
  return <div className="space-y-5"><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items.map(([label, amount, tone]) => <article key={label} className={`rounded-2xl bg-gradient-to-br ${tones[tone]} p-5 text-white shadow-sm`}><p className="text-xs font-semibold uppercase tracking-wider text-white/70">{label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{currency.format(amount)}</p></article>)}<article className={`rounded-2xl bg-gradient-to-br ${metrics.overdue ? tones.red : tones.slate} p-5 text-white shadow-sm`}><p className="text-xs font-semibold uppercase tracking-wider text-white/70">Vencimentos</p><p className="mt-2 text-xl font-semibold">{metrics.dueSoon} próximos · {metrics.overdue} vencidos</p></article></section><section className={panel}><h2 className="font-semibold text-slate-900">Linha do tempo · 24 meses</h2><p className="text-sm text-slate-500">Projeção contínua sobre o ledger único.</p>{months.length ? <div className="mt-5 flex gap-3 overflow-x-auto pb-3">{months.map((month) => <Link key={month.competence} href={`/financas?view=overview&competence=${month.competence.slice(0, 7)}`} className={`min-w-28 rounded-xl border p-3 ${month.competence === competence ? "border-sky-500 bg-sky-50" : "border-slate-200"}`}><p className="text-xs font-semibold uppercase text-slate-500">{monthLabel(month.competence)}</p><div className="mt-3 flex h-20 items-end gap-1"><span className="w-1/2 rounded-t bg-emerald-400" style={{ height: `${Math.max(3, month.income / scale * 100)}%` }}/><span className="w-1/2 rounded-t bg-rose-400" style={{ height: `${Math.max(3, month.expense / scale * 100)}%` }}/></div><p className={`mt-2 text-xs font-semibold ${month.result >= 0 ? "text-emerald-700" : "text-red-600"}`}>{currency.format(month.result)}</p></Link>)}</div> : <Empty>Não há lançamentos para projetar.</Empty>}</section></div>;
}

export function AlertsView({ workspace, competence }: { workspace: FinanceWorkspace; competence: string }) {
  const metrics = calculateDashboard(workspace, competence);
  return <section className={panel}><h2 className="font-semibold">Alertas financeiros</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{metrics.overdue > 0 && <article className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="font-semibold text-red-800">{metrics.overdue} lançamento(s) vencido(s)</p><Link href="/financas?view=movements&status=overdue" className="text-sm text-red-700 underline">Revisar</Link></article>}{workspace.alerts.map((alert) => <article key={alert.id} className="rounded-xl border p-4"><p className="font-semibold">{alert.name}</p><p className="text-sm text-slate-500">{alert.rule_type} · {alert.active ? "ativo" : "pausado"}</p></article>)}{!metrics.overdue && !workspace.alerts.length && <Empty>Nenhum alerta ativo.</Empty>}</div></section>;
}
