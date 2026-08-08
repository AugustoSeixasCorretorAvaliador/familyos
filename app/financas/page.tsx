import { redirect } from "next/navigation";
import { MainNav } from "@/app/components/main-nav";
import { FinanceNav } from "@/app/financas/finance-nav";
import { AccountsView, CardsView, CategoriesView } from "@/app/financas/views/catalogs";
import { AlertsView, DashboardView } from "@/app/financas/views/dashboard";
import { InvoicesView, InstallmentsView } from "@/app/financas/views/billing";
import { InvestmentsView, PropertiesView } from "@/app/financas/views/assets";
import { MovementsView } from "@/app/financas/views/movements";
import { RecurrencesView } from "@/app/financas/views/recurrences";
import { getActionErrorMessage } from "@/lib/action-feedback";
import { canAdminFamily, canEditFamily, getFamilyContext } from "@/lib/family/context";
import { currentCompetence, getFinanceWorkspace, getFinancialEntryPage } from "@/lib/finance/services";
import type { FinanceFilters, FinanceView } from "@/lib/finance/types";

type SearchParams = Record<string, string | string[] | undefined>;
type PageProps = { searchParams: SearchParams };

function valueOf(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function validView(value?: string): FinanceView {
  const views: FinanceView[] = ["overview", "movements", "accounts", "cards", "invoices", "installments", "recurrences", "properties", "investments", "categories", "alerts"];
  return views.includes(value as FinanceView) ? value as FinanceView : "overview";
}

function validMonthlyOrder(value?: string): "alpha" | "category" {
  return value === "alpha" ? "alpha" : "category";
}

export default async function FinancasPage({ searchParams }: PageProps) {
  const context = await getFamilyContext();
  if (!context.user) redirect("/login");
  if (!context.family) redirect("/dashboard?setup=required");

  const view = validView(valueOf(searchParams, "view"));
  const competence = valueOf(searchParams, "competence")
    ? `${valueOf(searchParams, "competence")!.slice(0, 7)}-01`
    : currentCompetence();
  const filters: FinanceFilters = {
    competence,
    accountId: valueOf(searchParams, "account"),
    cardId: valueOf(searchParams, "card"),
    categoryId: valueOf(searchParams, "category"),
    personId: valueOf(searchParams, "person"),
    propertyId: valueOf(searchParams, "property"),
    status: valueOf(searchParams, "status"),
    entryType: valueOf(searchParams, "type"),
    realization: valueOf(searchParams, "realization") as FinanceFilters["realization"],
    query: valueOf(searchParams, "q"),
  };
  const [workspace, movementPage] = await Promise.all([
    getFinanceWorkspace(context.family.id, view !== "movements"),
    view === "movements"
      ? getFinancialEntryPage(context.family.id, filters, valueOf(searchParams, "cursor"), 25)
      : Promise.resolve({ entries: [], hasMore: false, nextCursor: null }),
  ]);
  const canEdit = canEditFamily(context);
  const canAdmin = canAdminFamily(context);
  const incomeOrder = validMonthlyOrder(valueOf(searchParams, "income_order"));
  const expenseOrder = validMonthlyOrder(valueOf(searchParams, "expense_order"));
  const success = valueOf(searchParams, "success");
  const error = valueOf(searchParams, "error");

  return <main className="min-h-screen bg-slate-50 p-3 sm:p-5 lg:p-8"><div className="mx-auto max-w-7xl space-y-5">
    <header className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="bg-gradient-to-r from-slate-950 via-slate-900 to-sky-900 p-5 text-white sm:p-7"><MainNav current="financas"/><div className="mt-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-sky-300">HERO.FamilyOS · Controle familiar</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Finanças e patrimônio</h1><p className="mt-1 text-sm text-slate-300">{context.family.name} · previsto e realizado em ledger único</p></div><form className="flex flex-col gap-2 min-[420px]:flex-row"><input type="hidden" name="view" value={view}/><input type="month" name="competence" defaultValue={competence.slice(0, 7)} aria-label="Competência" className="rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white [color-scheme:dark]"/><button className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900">Aplicar</button></form></div></div><div className="p-4"><FinanceNav current={view}/></div></header>
    {(success || error) && <div role="status" aria-live="polite" className={`rounded-2xl border p-4 ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error ? getActionErrorMessage(error, valueOf(searchParams, "request_id")) : "Operação concluída com sucesso."}</div>}
    {view === "overview" && <DashboardView workspace={workspace} competence={competence} incomeOrder={incomeOrder} expenseOrder={expenseOrder} canEdit={canEdit} canAdmin={canAdmin}/>}
    {view === "movements" && <MovementsView workspace={workspace} page={movementPage} filters={filters} params={searchParams} canEdit={canEdit} canAdmin={canAdmin}/>}
    {view === "accounts" && <AccountsView workspace={workspace} canEdit={canEdit} canAdmin={canAdmin}/>}
    {view === "cards" && <CardsView workspace={workspace} competence={competence} canEdit={canEdit} canAdmin={canAdmin}/>}
    {view === "invoices" && <InvoicesView workspace={workspace} canEdit={canEdit}/>}
    {view === "installments" && <InstallmentsView workspace={workspace} canEdit={canEdit}/>}
    {view === "recurrences" && <RecurrencesView workspace={workspace} canEdit={canEdit}/>}
    {view === "properties" && <PropertiesView workspace={workspace} canEdit={canEdit} canAdmin={canAdmin}/>}
    {view === "investments" && <InvestmentsView workspace={workspace} canEdit={canEdit} canAdmin={canAdmin}/>}
    {view === "categories" && <CategoriesView workspace={workspace} canEdit={canEdit} canAdmin={canAdmin}/>}
    {view === "alerts" && <AlertsView workspace={workspace} competence={competence}/>}
  </div></main>;
}
