import "server-only";

export { commitFinanceImportArchive, previewFinanceImportArchive } from "@/lib/finance/import-service";
export type { FinanceImportCommitResult, FinanceImportPreview, ImportPreviewCount } from "@/lib/finance/import-service";

import { createClient } from "@/lib/supabase/server";
import { decodeEntryCursor, encodeEntryCursor } from "@/lib/finance/pagination";
import type { DashboardMetrics, FinanceFilters, FinanceWorkspace, FinancialEntryPage, FinancialEntryRow } from "@/lib/finance/types";

const ACTIVE = { deleted_at: null } as const;

function throwIfError(error: { code?: string; message: string } | null, scope: string) {
  if (error) {
    console.error("[familyos_finance_query_error]", JSON.stringify({ scope, code: error.code ?? null }));
    throw new Error(`finance_query_${scope}`);
  }
}

export function currentCompetence(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function getFinanceWorkspace(familyId: string, includeEntries = true): Promise<FinanceWorkspace> {
  const db = createClient();
  const entriesPromise = includeEntries ? getAllFinancialEntries(familyId) : Promise.resolve([]);
  const results = await Promise.all([
    db.from("accounts").select("*").eq("family_id", familyId).match(ACTIVE).order("institution"),
    db.from("financial_categories").select("*").eq("family_id", familyId).match(ACTIVE).order("name"),
    db.from("credit_cards").select("*").eq("family_id", familyId).match(ACTIVE).order("name"),
    db.from("recurrences").select("*").eq("family_id", familyId).match(ACTIVE).order("created_at", { ascending: false }),
    db.from("installment_purchases").select("*").eq("family_id", familyId).match(ACTIVE).order("created_at", { ascending: false }),
    db.from("card_invoices").select("*").eq("family_id", familyId).match(ACTIVE).order("competence", { ascending: false }),
    db.from("properties").select("*").eq("family_id", familyId).match(ACTIVE).order("title"),
    db.from("property_units").select("*").eq("family_id", familyId).match(ACTIVE).order("name"),
    db.from("lease_contracts").select("*").eq("family_id", familyId).match(ACTIVE).order("start_date", { ascending: false }),
    db.from("lease_owner_shares").select("*").eq("family_id", familyId).match(ACTIVE).order("valid_from", { ascending: false }),
    db.from("investment_assets").select("*").eq("family_id", familyId).match(ACTIVE).order("name"),
    db.from("investment_positions").select("*").eq("family_id", familyId).order("position_date", { ascending: false }),
    db.from("financial_alert_rules").select("*").eq("family_id", familyId).match(ACTIVE).order("name"),
    db.from("financial_entry_history").select("*").eq("family_id", familyId).order("changed_at", { ascending: false }).limit(500),
    db.from("people").select("id,first_name,last_name").eq("family_id", familyId).is("deleted_at", null).order("first_name"),
  ]);
  const scopes = ["accounts", "categories", "cards", "recurrences", "installments", "invoices", "properties", "units", "leases", "shares", "assets", "positions", "alerts", "history", "people"];
  results.forEach((result, index) => throwIfError(result.error, scopes[index]));
  const [accounts, categories, cards, recurrences, installments, invoices, properties, units, leases, shares, assets, positions, alerts, history, people] = results;
  const entries = await entriesPromise;
  return {
    accounts: accounts.data ?? [], categories: categories.data ?? [], cards: cards.data ?? [], entries,
    recurrences: recurrences.data ?? [], installments: installments.data ?? [], invoices: invoices.data ?? [], properties: properties.data ?? [],
    units: units.data ?? [], leases: leases.data ?? [], shares: shares.data ?? [], assets: assets.data ?? [], positions: positions.data ?? [],
    alerts: alerts.data ?? [], history: history.data ?? [], people: people.data ?? [],
  };
}

async function getAllFinancialEntries(familyId: string) {
  const entries: FinancialEntryRow[] = [];
  let cursor: string | null = null;
  do {
    const page: FinancialEntryPage = await getFinancialEntryPage(familyId, {}, cursor, 500);
    entries.push(...page.entries);
    cursor = page.nextCursor;
  } while (cursor);
  return entries;
}

export async function getFinancialEntryPage(
  familyId: string,
  filters: FinanceFilters,
  encodedCursor?: string | null,
  pageSize = 25
): Promise<FinancialEntryPage> {
  const db = createClient();
  const cursor = decodeEntryCursor(encodedCursor);
  const safePageSize = Math.min(Math.max(pageSize, 10), 500);
  let query = db.from("financial_entries").select("*").eq("family_id", familyId).is("deleted_at", null)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(safePageSize + 1);
  if (cursor) query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  if (filters.competence) query = query.eq("competence", filters.competence);
  if (filters.periodStart) query = query.gte("competence", filters.periodStart);
  if (filters.periodEnd) query = query.lte("competence", filters.periodEnd);
  if (filters.accountId) query = query.eq("account_id", filters.accountId);
  if (filters.cardId) query = query.eq("card_id", filters.cardId);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.propertyId) query = query.eq("property_id", filters.propertyId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.entryType) query = query.eq("entry_type", filters.entryType);
  if (filters.personId) query = query.or(`responsible_person_id.eq.${filters.personId},economic_owner_person_id.eq.${filters.personId}`);
  if (filters.realization === "actual") query = query.not("actual_amount", "is", null);
  if (filters.realization === "expected") query = query.is("actual_amount", null);
  if (filters.query) query = query.ilike("description", `%${filters.query.replace(/[%_,()]/g, " ").trim().slice(0, 80)}%`);
  const { data, error } = await query;
  throwIfError(error, "entries_page");
  const rows = data ?? [];
  const hasMore = rows.length > safePageSize;
  const pageRows = hasMore ? rows.slice(0, safePageSize) : rows;
  const last = pageRows.at(-1);
  return { entries: pageRows, hasMore, nextCursor: hasMore && last ? encodeEntryCursor({ createdAt: last.created_at, id: last.id }) : null };
}

export function filterEntries(entries: FinancialEntryRow[], filters: FinanceFilters) {
  return entries.filter((entry) => {
    if (entry.deleted_at || ["cancelled", "reversed"].includes(entry.status)) return false;
    if (filters.competence && entry.competence !== filters.competence) return false;
    if (filters.periodStart && entry.competence < filters.periodStart) return false;
    if (filters.periodEnd && entry.competence > filters.periodEnd) return false;
    if (filters.accountId && entry.account_id !== filters.accountId) return false;
    if (filters.cardId && entry.card_id !== filters.cardId) return false;
    if (filters.categoryId && entry.category_id !== filters.categoryId) return false;
    if (filters.personId && entry.responsible_person_id !== filters.personId && entry.economic_owner_person_id !== filters.personId) return false;
    if (filters.propertyId && entry.property_id !== filters.propertyId) return false;
    if (filters.status && entry.status !== filters.status) return false;
    if (filters.entryType && entry.entry_type !== filters.entryType) return false;
    if (filters.realization === "actual" && entry.actual_amount === null) return false;
    if (filters.realization === "expected" && entry.actual_amount !== null) return false;
    if (filters.query && !entry.description.toLocaleLowerCase("pt-BR").includes(filters.query.toLocaleLowerCase("pt-BR"))) return false;
    return true;
  });
}

export function calculateDashboard(workspace: FinanceWorkspace, competence: string, today = new Date().toISOString().slice(0, 10)): DashboardMetrics {
  const activeEntries = workspace.entries.filter((entry) => !entry.deleted_at && !["cancelled", "reversed"].includes(entry.status));
  const month = activeEntries.filter((entry) => entry.competence === competence);
  const isIncome = (entry: FinancialEntryRow) => ["income", "investment_yield"].includes(entry.entry_type);
  const isExpense = (entry: FinancialEntryRow) => entry.entry_type === "expense";
  const cashIn = activeEntries.filter((entry) => entry.cash_direction === "inflow").reduce((sum, entry) => sum + (entry.actual_amount ?? 0), 0);
  const cashOut = activeEntries.filter((entry) => entry.cash_direction === "outflow").reduce((sum, entry) => sum + (entry.actual_amount ?? 0), 0);
  const opening = workspace.accounts.reduce((sum, account) => sum + account.opening_balance, 0);
  const expectedIncome = month.filter(isIncome).reduce((sum, entry) => sum + entry.expected_amount, 0);
  const actualIncome = month.filter(isIncome).reduce((sum, entry) => sum + (entry.actual_amount ?? 0), 0);
  const expectedExpense = month.filter(isExpense).reduce((sum, entry) => sum + entry.expected_amount, 0);
  const actualExpense = month.filter(isExpense).reduce((sum, entry) => sum + (entry.actual_amount ?? 0), 0);
  const available = opening + cashIn - cashOut;
  const projected = available + expectedIncome - actualIncome - (expectedExpense - actualExpense);
  const activePositions = new Map<string, number>();
  for (const position of workspace.positions) if (!activePositions.has(position.asset_id)) activePositions.set(position.asset_id, position.market_value);
  const rentalIncome = month.filter((entry) => entry.entry_type === "income" && entry.lease_contract_id).reduce((sum, entry) => sum + (entry.actual_amount ?? 0), 0);
  const propertyExpenses = month.filter((entry) => entry.entry_type === "expense" && entry.property_id).reduce((sum, entry) => sum + (entry.actual_amount ?? entry.expected_amount), 0);
  return {
    available, projected, expectedIncome, actualIncome, expectedExpense, actualExpense,
    monthlyResult: actualIncome - actualExpense,
    dueSoon: activeEntries.filter((entry) => entry.due_date && entry.due_date >= today && entry.due_date <= addDays(today, 7) && entry.actual_amount === null).length,
    overdue: activeEntries.filter((entry) => entry.due_date && entry.due_date < today && entry.actual_amount === null).length,
    invoices: workspace.invoices.filter((invoice) => invoice.competence === competence && !["paid", "cancelled"].includes(invoice.status)).reduce((sum, invoice) => sum + (invoice.closed_amount ?? invoice.expected_amount), 0),
    cardLimit: workspace.cards.reduce((sum, card) => sum + (card.credit_limit ?? 0), 0),
    cardUsed: month.filter((entry) => entry.card_id && isExpense(entry)).reduce((sum, entry) => sum + entry.expected_amount, 0),
    futureCommitments: activeEntries.filter((entry) => entry.competence > competence && isExpense(entry)).reduce((sum, entry) => sum + entry.expected_amount, 0),
    investments: Array.from(activePositions.values()).reduce((sum, value) => sum + value, 0),
    rentalIncome, propertyExpenses, propertyNet: rentalIncome - propertyExpenses,
  };
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function buildTimeline(entries: FinancialEntryRow[], centerCompetence: string, months = 24) {
  const center = new Date(`${centerCompetence}T00:00:00Z`);
  return Array.from({ length: months }, (_, index) => {
    const offset = index - Math.floor(months / 3);
    const date = new Date(Date.UTC(center.getUTCFullYear(), center.getUTCMonth() + offset, 1));
    const competence = date.toISOString().slice(0, 10);
    const selected = entries.filter((entry) => entry.competence === competence && !entry.deleted_at && !["cancelled", "reversed"].includes(entry.status));
    const income = selected.filter((entry) => ["income", "investment_yield"].includes(entry.entry_type)).reduce((sum, entry) => sum + entry.expected_amount, 0);
    const expense = selected.filter((entry) => entry.entry_type === "expense").reduce((sum, entry) => sum + entry.expected_amount, 0);
    return { competence, income, expense, result: income - expense };
  });
}
