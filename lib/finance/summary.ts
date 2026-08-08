import type { FinancialEntryRow } from "@/lib/finance/types";

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

export function sortEntriesAlphabetically(entries: FinancialEntryRow[]) {
  return [...entries].sort((left, right) => left.description.localeCompare(right.description, "pt-BR", { sensitivity: "base" }));
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
  return effectiveCashflowEntries(entries).filter((entry) =>
    entry.competence <= competence && (!openingCompetence || entry.competence >= openingCompetence)
  );
}
