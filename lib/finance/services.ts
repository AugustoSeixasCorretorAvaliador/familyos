import "server-only";

export { commitFinanceImportArchive, previewFinanceImportArchive } from "@/lib/finance/import-service";
export type { FinanceImportCommitResult, FinanceImportPreview, ImportPreviewCount } from "@/lib/finance/import-service";

import { createClient } from "@/lib/supabase/server";
import { collectCursorPages, decodeEntryCursor, encodeEntryCursor } from "@/lib/finance/pagination";
import { addCompetenceMonths, monthlyOccurrenceDates, recurrenceOccurrenceId } from "@/lib/finance/recurrence";
import { cashflowEntriesForBalance, effectiveCashflowEntries, monthlyEntryAmount, projectedBalance, projectedBalanceFromStart } from "@/lib/finance/summary";
import type { DashboardMetrics, FinanceFilters, FinanceWorkspace, FinancialEntryInsert, FinancialEntryPage, FinancialEntryRow } from "@/lib/finance/types";

export { cashflowEntriesForMonth, monthlyEntryAmount } from "@/lib/finance/summary";

//const ACTIVE = { deleted_at: null } as const;

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
    db.from("accounts").select("*").eq("family_id", familyId).is("deleted_at", null).order("institution"),
    db.from("financial_categories").select("*").eq("family_id", familyId).is("deleted_at", null).order("name"),
    db.from("credit_cards").select("*").eq("family_id", familyId).is("deleted_at", null).order("name"),
    db.from("recurrences").select("*").eq("family_id", familyId).is("deleted_at", null).order("created_at", { ascending: false }),
    db.from("installment_purchases").select("*").eq("family_id", familyId).is("deleted_at", null).order("created_at", { ascending: false }),
    db.from("card_invoices").select("*").eq("family_id", familyId).is("deleted_at", null).order("competence", { ascending: false }),
    db.from("properties").select("*").eq("family_id", familyId).is("deleted_at", null).order("title"),
    db.from("property_units").select("*").eq("family_id", familyId).is("deleted_at", null).order("name"),
    db.from("lease_contracts").select("*").eq("family_id", familyId).is("deleted_at", null).order("start_date", { ascending: false }),
    db.from("lease_owner_shares").select("*").eq("family_id", familyId).is("deleted_at", null).order("valid_from", { ascending: false }),
    db.from("investment_assets").select("*").eq("family_id", familyId).is("deleted_at", null).order("name"),
    db.from("investment_positions").select("*").eq("family_id", familyId).order("position_date", { ascending: false }),
    db.from("financial_alert_rules").select("*").eq("family_id", familyId).is("deleted_at", null).order("name"),
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

export async function ensureFinanceRecurrences(familyId: string, userId: string, selectedCompetence: string) {
  const db = createClient();
  const throughCompetence = addCompetenceMonths(selectedCompetence, 12);
  const { data: recurrences, error: recurrenceError } = await db.from("recurrences")
    .select("*")
    .eq("family_id", familyId)
    .eq("active", true)
    .eq("frequency", "monthly")
    .is("deleted_at", null)
    .lte("start_date", throughCompetence);
  throwIfError(recurrenceError, "ensure_recurrences");

  const valid = (recurrences ?? []).filter((rule) => rule.entry_type && rule.expected_amount !== null);
  if (!valid.length) return;

  const recurrenceIds = valid.map((rule) => rule.id);
  const earliestStart = valid.map((rule) => rule.start_date).sort()[0];
  const existing = await collectCursorPages(async (after, limit) => {
    let query = db.from("financial_entries")
      .select("id,recurrence_id,competence")
      .eq("family_id", familyId)
      .in("recurrence_id", recurrenceIds)
      .gte("competence", `${earliestStart.slice(0, 7)}-01`)
      .order("id")
      .limit(limit);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    throwIfError(error, "ensure_recurrence_entries");
    return data ?? [];
  }, (entry) => entry.id);
  // Ocorrências arquivadas também ocupam a competência: recriá-las desfaria
  // silenciosamente uma decisão explícita do usuário.
  const existingMonths = new Set((existing ?? []).map((entry) => `${entry.recurrence_id}:${entry.competence}`));
  const latestCompetence = new Map<string, string>();
  for (const entry of existing ?? []) {
    if (entry.recurrence_id && entry.competence > (latestCompetence.get(entry.recurrence_id) ?? "")) {
      latestCompetence.set(entry.recurrence_id, entry.competence);
    }
  }

  const rows: FinancialEntryInsert[] = [];
  for (const recurrence of valid) {
    const extras = typeof recurrence.rule === "object" && recurrence.rule && !Array.isArray(recurrence.rule)
      ? recurrence.rule as Record<string, unknown>
      : {};
    const dates = monthlyOccurrenceDates({
      startDate: recurrence.start_date,
      endDate: recurrence.end_date,
      intervalMonths: recurrence.interval_value,
      dayOfMonth: recurrence.day_of_month,
    }, throughCompetence);

    for (const date of dates) {
      const competence = `${date.slice(0, 7)}-01`;
      if (existingMonths.has(`${recurrence.id}:${competence}`)) continue;
      const isIncome = ["income", "investment_redemption", "investment_yield"].includes(recurrence.entry_type!);
      rows.push({
        id: recurrenceOccurrenceId(familyId, recurrence.id, date),
        family_id: familyId,
        created_by: userId,
        description: recurrence.description ?? "Lançamento recorrente",
        competence,
        entry_type: recurrence.entry_type!,
        cash_direction: isIncome ? "inflow" : "outflow",
        expected_amount: recurrence.expected_amount!,
        actual_amount: null,
        expected_date: date,
        due_date: date,
        effective_date: null,
        status: isIncome ? "receivable" : "payable",
        category_id: recurrence.category_id,
        classification_category_id: typeof extras.classification_category_id === "string" ? extras.classification_category_id : null,
        account_id: recurrence.account_id,
        card_id: recurrence.card_id,
        responsible_person_id: recurrence.responsible_person_id,
        property_id: typeof extras.property_id === "string" ? extras.property_id : null,
        property_unit_id: typeof extras.property_unit_id === "string" ? extras.property_unit_id : null,
        lease_contract_id: typeof extras.lease_contract_id === "string" ? extras.lease_contract_id : null,
        investment_asset_id: typeof extras.investment_asset_id === "string" ? extras.investment_asset_id : null,
        notes: typeof extras.notes === "string" ? extras.notes : null,
        origin: "recurrence",
        purchase_kind: "recurring",
        recurrence_id: recurrence.id,
        source_key: `recurrence:${recurrence.id}:${date}`,
        metadata: { recurrence_materialized: true },
      });
    }
  }

  if (rows.length) {
    // O source_key usa índice único parcial (somente registros ativos), que não
    // pode ser inferido pelo on_conflict do PostgREST. O id determinístico torna
    // a inserção concorrente e idempotente pela chave primária sem reativar
    // ocorrências que tenham sido excluídas logicamente.
    const { error } = await db.from("financial_entries").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    throwIfError(error, "materialize_recurrences");
  }

  const recurrenceUpdates = valid.flatMap((recurrence) => {
    const materializedThrough = latestCompetence.get(recurrence.id) && latestCompetence.get(recurrence.id)! > throughCompetence
      ? latestCompetence.get(recurrence.id)!
      : throughCompetence;
    const nextCompetence = addCompetenceMonths(materializedThrough, 1);
    const nextOccurrence = monthlyOccurrenceDates({
      startDate: recurrence.start_date,
      endDate: recurrence.end_date,
      intervalMonths: recurrence.interval_value,
      dayOfMonth: recurrence.day_of_month,
    }, nextCompetence).find((date) => date.slice(0, 7) > materializedThrough.slice(0, 7)) ?? null;
    return recurrence.next_occurrence === nextOccurrence ? [] : [{ id: recurrence.id, nextOccurrence }];
  });

  const updates = await Promise.all(recurrenceUpdates.map(({ id, nextOccurrence }) =>
    db.from("recurrences").update({
      next_occurrence: nextOccurrence,
      updated_by: userId,
    }).eq("id", id).eq("family_id", familyId).is("deleted_at", null)
  ));
  updates.forEach((result) => throwIfError(result.error, "advance_recurrence"));
}

export function calculateDashboard(workspace: FinanceWorkspace, competence: string, today = new Date().toISOString().slice(0, 10)): DashboardMetrics {
  const activeEntries = effectiveCashflowEntries(workspace.entries);
  const month = activeEntries.filter((entry) => entry.competence === competence);
  const openingBalanceDate = workspace.accounts
    .map((account) => account.opening_balance_date)
    .filter((date): date is string => Boolean(date))
    .sort()[0] ?? null;
  const balanceEntries = cashflowEntriesForBalance(workspace.entries, competence, openingBalanceDate);
  const isIncome = (entry: FinancialEntryRow) => ["income", "investment_yield"].includes(entry.entry_type);
  const isExpense = (entry: FinancialEntryRow) => ["expense", "reversal"].includes(entry.entry_type);
  const expectedExpenseAmount = (entry: FinancialEntryRow) => entry.entry_type === "reversal" ? -entry.expected_amount : entry.expected_amount;
  const actualExpenseAmount = (entry: FinancialEntryRow) => entry.entry_type === "reversal" ? -(entry.actual_amount ?? 0) : (entry.actual_amount ?? 0);
  const cashIn = balanceEntries.filter((entry) => entry.cash_direction === "inflow").reduce((sum, entry) => sum + (entry.actual_amount ?? 0), 0);
  const cashOut = balanceEntries.filter((entry) => entry.cash_direction === "outflow").reduce((sum, entry) => sum + (entry.actual_amount ?? 0), 0);
  const opening = workspace.accounts
    .filter((account) => !account.opening_balance_date || account.opening_balance_date <= competence)
    .reduce((sum, account) => sum + account.opening_balance, 0);
  const expectedIncome = month.filter(isIncome).reduce((sum, entry) => sum + entry.expected_amount, 0);
  const actualIncome = month.filter(isIncome).reduce((sum, entry) => sum + (entry.actual_amount ?? 0), 0);
  const expectedExpense = month.filter(isExpense).reduce((sum, entry) => sum + expectedExpenseAmount(entry), 0);
  const actualExpense = month.filter(isExpense).reduce((sum, entry) => sum + actualExpenseAmount(entry), 0);
  const monthlyIncome = month.filter(isIncome).reduce((sum, entry) => sum + monthlyEntryAmount(entry), 0);
  const monthlyExpense = month.filter(isExpense).reduce((sum, entry) => sum + monthlyEntryAmount(entry), 0);
  const available = opening + cashIn - cashOut;
  const selectedProjected = projectedBalance(opening, balanceEntries, month);
  const projectionStart = openingBalanceDate ? `${openingBalanceDate.slice(0, 7)}-01` : `${today.slice(0, 7)}-01`;
  let projected = projectedBalanceFromStart(competence, projectionStart, selectedProjected);
  if (competence > projectionStart) {
    const baseMonth = activeEntries.filter((entry) => entry.competence === projectionStart);
    const baseBalanceEntries = cashflowEntriesForBalance(workspace.entries, projectionStart, openingBalanceDate);
    const baseOpening = workspace.accounts
      .filter((account) => !account.opening_balance_date || account.opening_balance_date <= projectionStart)
      .reduce((sum, account) => sum + account.opening_balance, 0);
    const baseProjected = projectedBalance(baseOpening, baseBalanceEntries, baseMonth);
    const subsequentEntries = activeEntries.filter((entry) => entry.competence > projectionStart && entry.competence <= competence);
    projected = projectedBalanceFromStart(competence, projectionStart, selectedProjected, baseProjected, subsequentEntries);
  }
  const activePositions = new Map<string, number>();
  const activeAssetIds = new Set(workspace.assets.map((asset) => asset.id));
  for (const position of workspace.positions) if (activeAssetIds.has(position.asset_id) && !activePositions.has(position.asset_id)) activePositions.set(position.asset_id, position.market_value);
  const rentalIncome = month.filter((entry) => entry.entry_type === "income" && (entry.property_id || entry.lease_contract_id)).reduce((sum, entry) => sum + monthlyEntryAmount(entry), 0);
  const propertyExpenses = month.filter((entry) => entry.entry_type === "expense" && entry.property_id).reduce((sum, entry) => sum + monthlyEntryAmount(entry), 0);
  return {
    monthlyIncome, monthlyExpense,
    available, projected, expectedIncome, actualIncome, expectedExpense, actualExpense,
    monthlyResult: monthlyIncome - monthlyExpense,
    dueSoon: activeEntries.filter((entry) => entry.due_date && entry.due_date >= today && entry.due_date <= addDays(today, 7) && entry.actual_amount === null).length,
    overdue: activeEntries.filter((entry) => entry.due_date && entry.due_date < today && entry.actual_amount === null).length,
    invoices: workspace.invoices.filter((invoice) => invoice.competence === competence && !["paid", "cancelled"].includes(invoice.status)).reduce((sum, invoice) => sum + (invoice.closed_amount ?? invoice.expected_amount), 0),
    cardLimit: workspace.cards.reduce((sum, card) => sum + (card.credit_limit ?? 0), 0),
    cardUsed: month.filter((entry) => entry.card_id && isExpense(entry)).reduce((sum, entry) => sum + expectedExpenseAmount(entry), 0),
    futureCommitments: activeEntries.filter((entry) => entry.competence > competence && isExpense(entry)).reduce((sum, entry) => sum + expectedExpenseAmount(entry), 0),
    investments: Array.from(activePositions.values()).reduce((sum, value) => sum + value, 0),
    rentalIncome, propertyExpenses, propertyNet: rentalIncome - propertyExpenses,
  };
}

export async function getConsolidatedFinancialSummary(familyId: string, competence: string) {
  const db = createClient();
  const [entriesResult, assetsResult, positionsResult] = await Promise.all([
    db.from("financial_entries").select("*").eq("family_id", familyId).eq("competence", competence).is("deleted_at", null),
    db.from("investment_assets").select("id").eq("family_id", familyId).eq("active", true).is("deleted_at", null),
    db.from("investment_positions").select("asset_id,market_value,position_date,created_at").eq("family_id", familyId)
      .order("position_date", { ascending: false }).order("created_at", { ascending: false }),
  ]);
  throwIfError(entriesResult.error, "consolidated_entries");
  throwIfError(assetsResult.error, "consolidated_assets");
  throwIfError(positionsResult.error, "consolidated_positions");

  const month = effectiveCashflowEntries(entriesResult.data ?? []);
  const income = month
    .filter((entry) => ["income", "investment_yield"].includes(entry.entry_type))
    .reduce((sum, entry) => sum + monthlyEntryAmount(entry), 0);
  const expense = month
    .filter((entry) => ["expense", "reversal"].includes(entry.entry_type))
    .reduce((sum, entry) => sum + monthlyEntryAmount(entry), 0);
  const activeAssetIds = new Set((assetsResult.data ?? []).map((asset) => asset.id));
  const latestPositions = new Map<string, { value: number; date: string }>();
  for (const position of positionsResult.data ?? []) {
    if (activeAssetIds.has(position.asset_id) && !latestPositions.has(position.asset_id)) {
      latestPositions.set(position.asset_id, { value: position.market_value, date: position.position_date });
    }
  }
  const investments = Array.from(latestPositions.values()).reduce((sum, position) => sum + position.value, 0);
  const entryUpdates = month.map((entry) => entry.updated_at);
  const positionUpdates = Array.from(latestPositions.values()).map((position) => position.date);

  return {
    monthlyResult: income - expense,
    investments,
    consolidatedBalance: income - expense + investments,
    updatedAt: [...entryUpdates, ...positionUpdates].filter(Boolean).sort().at(-1) ?? null,
  };
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function buildTimeline(entries: FinancialEntryRow[], centerCompetence: string, months = 24) {
  const activeEntries = effectiveCashflowEntries(entries);
  const center = new Date(`${centerCompetence}T00:00:00Z`);
  return Array.from({ length: months }, (_, index) => {
    const offset = index - Math.floor(months / 3);
    const date = new Date(Date.UTC(center.getUTCFullYear(), center.getUTCMonth() + offset, 1));
    const competence = date.toISOString().slice(0, 10);
    const selected = activeEntries.filter((entry) => entry.competence === competence);
    const income = selected.filter((entry) => ["income", "investment_yield"].includes(entry.entry_type)).reduce((sum, entry) => sum + monthlyEntryAmount(entry), 0);
    const expense = selected.filter((entry) => ["expense", "reversal"].includes(entry.entry_type)).reduce((sum, entry) => sum + monthlyEntryAmount(entry), 0);
    return { competence, income, expense, result: income - expense };
  });
}
