export type EntryType =
  | "income"
  | "expense"
  | "transfer"
  | "investment_application"
  | "investment_redemption"
  | "investment_yield"
  | "adjustment"
  | "reversal";

export type EntryStatus =
  | "planned"
  | "confirmed"
  | "payable"
  | "paid"
  | "receivable"
  | "received"
  | "partially_paid"
  | "partially_received"
  | "overdue"
  | "cancelled"
  | "reversed"
  | "pending_confirmation";

export type CashDirection = "inflow" | "outflow" | "none";

export type FinancialEntry = {
  id: string;
  familyId: string;
  competence: string;
  dueDate?: string | null;
  entryType: EntryType;
  status: EntryStatus;
  expectedCents: number;
  actualCents?: number | null;
  cashDirection: CashDirection;
  deleted?: boolean;
};

export type MonthlySummary = {
  expectedIncomeCents: number;
  actualIncomeCents: number;
  expectedExpenseCents: number;
  actualExpenseCents: number;
  operatingExpectedCents: number;
  operatingActualCents: number;
  cashInCents: number;
  cashOutCents: number;
  projectedBalanceCents: number;
  closingBalanceCents: number;
};

const inactiveStatuses = new Set<EntryStatus>(["cancelled", "reversed"]);

function assertIntegerCents(value: number, label: string) {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer amount in cents`);
  }
}

function isActive(entry: FinancialEntry) {
  return !entry.deleted && !inactiveStatuses.has(entry.status);
}

function realized(entry: FinancialEntry) {
  return entry.actualCents ?? 0;
}

function isOperatingIncome(type: EntryType) {
  return type === "income" || type === "investment_yield";
}

export function differenceCents(expectedCents: number, actualCents: number | null) {
  assertIntegerCents(expectedCents, "expectedCents");
  if (actualCents === null) return null;
  assertIntegerCents(actualCents, "actualCents");
  return actualCents - expectedCents;
}

export function summarizeMonth(
  entries: FinancialEntry[],
  competence: string,
  openingBalanceCents = 0
): MonthlySummary {
  assertIntegerCents(openingBalanceCents, "openingBalanceCents");
  const monthEntries = entries.filter(
    (entry) => entry.competence === competence && isActive(entry)
  );

  let expectedIncomeCents = 0;
  let actualIncomeCents = 0;
  let expectedExpenseCents = 0;
  let actualExpenseCents = 0;
  let cashInCents = 0;
  let cashOutCents = 0;

  for (const entry of monthEntries) {
    assertIntegerCents(entry.expectedCents, "expectedCents");
    if (entry.actualCents !== null && entry.actualCents !== undefined) {
      assertIntegerCents(entry.actualCents, "actualCents");
    }

    if (isOperatingIncome(entry.entryType)) {
      expectedIncomeCents += entry.expectedCents;
      actualIncomeCents += realized(entry);
    } else if (entry.entryType === "expense") {
      expectedExpenseCents += entry.expectedCents;
      actualExpenseCents += realized(entry);
    } else if (entry.entryType === "reversal") {
      expectedExpenseCents -= entry.expectedCents;
      actualExpenseCents -= realized(entry);
    }

    if (entry.cashDirection === "inflow") {
      cashInCents += realized(entry);
    } else if (entry.cashDirection === "outflow") {
      cashOutCents += realized(entry);
    }
  }

  const pendingIncome = expectedIncomeCents - actualIncomeCents;
  const pendingExpense = expectedExpenseCents - actualExpenseCents;
  const closingBalanceCents = openingBalanceCents + cashInCents - cashOutCents;

  return {
    expectedIncomeCents,
    actualIncomeCents,
    expectedExpenseCents,
    actualExpenseCents,
    operatingExpectedCents: expectedIncomeCents - expectedExpenseCents,
    operatingActualCents: actualIncomeCents - actualExpenseCents,
    cashInCents,
    cashOutCents,
    projectedBalanceCents: closingBalanceCents + pendingIncome - pendingExpense,
    closingBalanceCents,
  };
}

export function carryBalance(previousClosingBalanceCents: number) {
  assertIntegerCents(previousClosingBalanceCents, "previousClosingBalanceCents");
  return previousClosingBalanceCents;
}

export function splitInstallments(totalCents: number, count: number) {
  assertIntegerCents(totalCents, "totalCents");
  if (totalCents < 0 || !Number.isSafeInteger(count) || count < 1) {
    throw new Error("invalid installment purchase");
  }
  const base = Math.floor(totalCents / count);
  return Array.from({ length: count }, (_, index) =>
    index === count - 1 ? totalCents - base * (count - 1) : base
  );
}

function addMonths(isoDate: string, months: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const safeDay = Math.min(day, lastDay);
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(safeDay).padStart(2, "0")}`;
}

function addMonthsWithDay(isoDate: string, months: number, dayOfMonth?: number | null) {
  if (!dayOfMonth || months === 0) return addMonths(isoDate, months);
  const [year, month] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(dayOfMonth, lastDay)).padStart(2, "0")}`;
}

export function generateMonthlyOccurrences(input: {
  recurrenceId: string;
  startDate: string;
  count: number;
  endDate?: string | null;
  intervalMonths?: number;
  dayOfMonth?: number | null;
}) {
  if (!Number.isSafeInteger(input.count) || input.count < 0) {
    throw new Error("invalid recurrence count");
  }
  const intervalMonths = input.intervalMonths ?? 1;
  if (!Number.isSafeInteger(intervalMonths) || intervalMonths < 1) {
    throw new Error("invalid recurrence interval");
  }
  return Array.from({ length: input.count }, (_, index) => {
    const date = addMonthsWithDay(input.startDate, index * intervalMonths, input.dayOfMonth);
    return { date, sourceKey: `recurrence:${input.recurrenceId}:${date}` };
  }).filter((occurrence) => !input.endDate || occurrence.date <= input.endDate);
}

export function invoiceTotalCents(entries: FinancialEntry[]) {
  return entries.filter(isActive).reduce((total, entry) => {
    if (entry.entryType === "expense") return total + entry.expectedCents;
    if (entry.entryType === "reversal") return total - entry.expectedCents;
    return total;
  }, 0);
}

export function allocateByPercentage(
  totalCents: number,
  shares: Array<{ personId: string; basisPoints: number }>
) {
  assertIntegerCents(totalCents, "totalCents");
  const totalBasisPoints = shares.reduce((sum, share) => sum + share.basisPoints, 0);
  if (totalBasisPoints !== 10_000 || shares.some((share) => share.basisPoints < 0)) {
    throw new Error("shares must total 100 percent");
  }

  let allocated = 0;
  return shares.map((share, index) => {
    const cents =
      index === shares.length - 1
        ? totalCents - allocated
        : Math.floor((totalCents * share.basisPoints) / 10_000);
    allocated += cents;
    return { personId: share.personId, cents };
  });
}

export function filterFamily(entries: FinancialEntry[], familyId: string) {
  return entries.filter((entry) => entry.familyId === familyId);
}

export function filterCompetence(entries: FinancialEntry[], competence: string) {
  return entries.filter((entry) => entry.competence === competence);
}

export function isOverdue(entry: FinancialEntry, today: string) {
  if (!entry.dueDate || !isActive(entry)) return false;
  if (["paid", "received"].includes(entry.status)) return false;
  return entry.dueDate < today;
}
