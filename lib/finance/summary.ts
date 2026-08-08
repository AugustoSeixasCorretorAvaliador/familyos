import type { FinancialEntryRow } from "@/lib/finance/types";

export function monthlyEntryAmount(entry: FinancialEntryRow) {
  return entry.actual_amount ?? entry.expected_amount;
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
    if (!entry.card_id || entry.entry_type !== "expense" || isConsolidatedCardBalance(entry)) return true;
    return !consolidatedCards.has(`${entry.competence}:${entry.card_id}`);
  });
}

export function cashflowEntriesForMonth(entries: FinancialEntryRow[], competence: string) {
  return effectiveCashflowEntries(entries).filter((entry) => entry.competence === competence);
}
