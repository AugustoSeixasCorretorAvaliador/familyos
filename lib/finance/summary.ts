import type { CardInvoice, FinancialEntryRow } from "@/lib/finance/types";

export function monthlyEntryAmount(entry: FinancialEntryRow) {
  const amount = entry.actual_amount ?? entry.expected_amount;
  return entry.entry_type === "reversal" ? -amount : amount;
}

export function settledEntriesTotal(entries: FinancialEntryRow[]) {
  return entries.reduce((sum, entry) => {
    const amount = entry.actual_amount ?? 0;
    return sum + (entry.entry_type === "reversal" ? -amount : amount);
  }, 0);
}

export function expectedEntriesTotal(entries: FinancialEntryRow[]) {
  return entries.reduce((sum, entry) => sum + (entry.entry_type === "reversal" ? -entry.expected_amount : entry.expected_amount), 0);
}

export function pendingEntriesTotal(entries: FinancialEntryRow[]) {
  return expectedEntriesTotal(entries) - settledEntriesTotal(entries);
}

export function sortEntriesAlphabetically(entries: FinancialEntryRow[]) {
  return [...entries].sort((left, right) => left.description.localeCompare(right.description, "pt-BR", { sensitivity: "base" }));
}

export function installmentProgressLabel(entry: FinancialEntryRow) {
  if (!entry.installment_number || !entry.installment_count) return null;
  const current = String(entry.installment_number).padStart(2, "0");
  const total = String(entry.installment_count).padStart(2, "0");
  return `PARC: ${current}/${total}`;
}

function cardEntryKind(entry: FinancialEntryRow) {
  if (entry.recurrence_id || entry.purchase_kind === "recurring" || entry.origin === "recurrence") return 0;
  if (entry.installment_purchase_id || entry.purchase_kind === "installment" || entry.origin === "installment") return 1;
  return 2;
}

function pendingInstallments(entry: FinancialEntryRow) {
  if (entry.installment_count === null || entry.installment_number === null) return 0;
  return Math.max(0, entry.installment_count - entry.installment_number);
}

export function sortCardEntries(entries: FinancialEntryRow[]) {
  return [...entries].sort((left, right) => {
    const kindDifference = cardEntryKind(left) - cardEntryKind(right);
    if (kindDifference) return kindDifference;

    if (cardEntryKind(left) === 1) {
      const pendingDifference = pendingInstallments(right) - pendingInstallments(left);
      if (pendingDifference) return pendingDifference;
    }

    return left.description.localeCompare(right.description, "pt-BR", { sensitivity: "base" });
  });
}

export function isCardCategoryName(name: string) {
  const normalized = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  return normalized.includes("cartao") || normalized.includes("cartoes");
}

export function placeCardCategoriesLast<T>(items: T[], categoryName: (item: T) => string) {
  return [...items].sort((left, right) => Number(isCardCategoryName(categoryName(left))) - Number(isCardCategoryName(categoryName(right))));
}

function isConsolidatedCardBalance(entry: FinancialEntryRow) {
  return Boolean(entry.source_key?.startsWith("card-balance:"));
}

export function effectiveCashflowEntries(entries: FinancialEntryRow[]) {
  const activeEntries = entries.filter((entry) => !entry.deleted_at && !["cancelled", "reversed"].includes(entry.status));
  const consolidatedCards = new Set(
    activeEntries
      .filter((entry) => entry.card_id && entry.entry_type === "expense" && isConsolidatedCardBalance(entry))
      .map((entry) => `${entry.competence}:${entry.card_id}`)
  );

  return activeEntries.filter((entry) => {
    if (!entry.card_id || !["expense", "reversal"].includes(entry.entry_type) || isConsolidatedCardBalance(entry)) return true;
    return !consolidatedCards.has(`${entry.competence}:${entry.card_id}`);
  });
}

export function cashflowEntriesForMonth(entries: FinancialEntryRow[], competence: string) {
  return effectiveCashflowEntries(entries).filter((entry) => entry.competence === competence);
}

export function cashflowEntriesForBalance(entries: FinancialEntryRow[], competence: string, openingBalanceDate: string | null) {
  const openingCompetence = openingBalanceDate ? `${openingBalanceDate.slice(0, 7)}-01` : null;
  const effectiveEntries = effectiveCashflowEntries(entries);
  const paidCardMonths = new Set(effectiveEntries
    .filter((entry) => entry.card_id && entry.actual_amount !== null && entry.source_key?.startsWith("invoice-payment:"))
    .map((entry) => `${entry.competence}:${entry.card_id}`));

  return effectiveEntries.filter((entry) => {
    if (entry.competence > competence || (openingCompetence && entry.competence < openingCompetence)) return false;
    const paidByInvoice = entry.card_id
      && ["expense", "reversal"].includes(entry.entry_type)
      && paidCardMonths.has(`${entry.competence}:${entry.card_id}`);
    return !paidByInvoice;
  });
}

export function accountBalanceAtCompetence(account: { id: string; opening_balance: number; opening_balance_date: string | null }, entries: FinancialEntryRow[], competence: string) {
  const openingBalance = !account.opening_balance_date || account.opening_balance_date <= competence
    ? account.opening_balance
    : 0;
  return cashflowEntriesForBalance(entries, competence, account.opening_balance_date)
    .filter((entry) => entry.account_id === account.id)
    .reduce((balance, entry) => {
      const actualAmount = entry.actual_amount ?? 0;
      if (entry.cash_direction === "inflow") return balance + actualAmount;
      if (entry.cash_direction === "outflow") return balance - actualAmount;
      return balance;
    }, openingBalance);
}

export function invoiceEntriesForCard(entries: FinancialEntryRow[], cardId: string, competence: string) {
  return effectiveCashflowEntries(entries).filter((entry) =>
    entry.card_id === cardId
    && entry.competence === competence
    && ["expense", "reversal"].includes(entry.entry_type)
  );
}

export function invoiceExpectedAmount(entries: FinancialEntryRow[], fallback: number) {
  return entries.length ? Math.max(0, expectedEntriesTotal(entries)) : fallback;
}

export function invoiceDisplayAmount(invoice: CardInvoice, calculatedExpected: number) {
  if (invoice.status === "paid") return invoice.paid_amount ?? invoice.closed_amount ?? calculatedExpected;
  return invoice.closed_amount ?? calculatedExpected;
}

export function projectedBalance(openingBalance: number, cashEntries: FinancialEntryRow[], projectionEntries: FinancialEntryRow[]) {
  const available = cashEntries.reduce((balance, entry) => {
    const actualAmount = entry.actual_amount ?? 0;
    return balance + (entry.cash_direction === "inflow"
      ? actualAmount
      : entry.cash_direction === "outflow" ? -actualAmount : 0);
  }, openingBalance);

  return projectionEntries.reduce((balance, entry) => {
    const actualAmount = entry.actual_amount ?? 0;
    const pendingAmount = entry.expected_amount - actualAmount;
    const pendingProjection = ["income", "investment_yield"].includes(entry.entry_type)
      ? pendingAmount
      : entry.entry_type === "expense" ? -pendingAmount
        : entry.entry_type === "reversal" ? pendingAmount : 0;
    return balance + pendingProjection;
  }, available);
}

export function accumulateProjectedBalance(baseProjectedBalance: number, entries: FinancialEntryRow[]) {
  return entries.reduce((balance, entry) => {
    if (["income", "investment_yield"].includes(entry.entry_type)) return balance + monthlyEntryAmount(entry);
    if (["expense", "reversal"].includes(entry.entry_type)) return balance - monthlyEntryAmount(entry);
    return balance;
  }, baseProjectedBalance);
}

export function operatingProjectedBalanceFromStart(competence: string, projectionStart: string, entries: FinancialEntryRow[]) {
  if (competence < projectionStart) return 0;
  const operatingEntries = effectiveCashflowEntries(entries).filter((entry) =>
    entry.competence >= projectionStart && entry.competence <= competence
  );
  return accumulateProjectedBalance(0, operatingEntries);
}

export function projectedBalanceFromStart(competence: string, projectionStart: string, selectedProjectedBalance: number, baseProjectedBalance = selectedProjectedBalance, subsequentEntries: FinancialEntryRow[] = []) {
  if (competence < projectionStart) return 0;
  if (competence === projectionStart) return selectedProjectedBalance;
  return accumulateProjectedBalance(baseProjectedBalance, subsequentEntries);
}

export function cashProjectedBalanceFromStart(competence: string, projectionStart: string, availableBalance: number, entries: FinancialEntryRow[]) {
  if (competence < projectionStart) return 0;
  const projectionEntries = effectiveCashflowEntries(entries).filter((entry) =>
    entry.competence >= projectionStart && entry.competence <= competence
  );
  const startEntries = projectionEntries.filter((entry) => entry.competence === projectionStart);
  const startProjectedBalance = projectedBalance(availableBalance, [], startEntries);
  if (competence === projectionStart) return startProjectedBalance;
  return accumulateProjectedBalance(
    startProjectedBalance,
    projectionEntries.filter((entry) => entry.competence > projectionStart)
  );
}
