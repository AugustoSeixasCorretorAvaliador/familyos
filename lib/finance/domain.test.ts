import { describe, expect, it } from "vitest";
import {
  allocateByPercentage,
  carryBalance,
  differenceCents,
  filterCompetence,
  filterFamily,
  generateMonthlyOccurrences,
  invoiceTotalCents,
  isOverdue,
  splitInstallments,
  summarizeMonth,
  type FinancialEntry,
} from "@/lib/finance/domain";

const base: FinancialEntry = {
  id: "entry-1",
  familyId: "family-a",
  competence: "2026-08",
  dueDate: "2026-08-10",
  entryType: "expense",
  status: "payable",
  expectedCents: 10_000,
  actualCents: null,
  cashDirection: "outflow",
};

describe("finance domain", () => {
  it("preserva previsto e calcula a diferença para o realizado", () => {
    expect(differenceCents(520_000, 529_666)).toBe(9_666);
  });

  it("calcula saldo mensal por caixa", () => {
    const summary = summarizeMonth(
      [
        { ...base, entryType: "income", status: "received", actualCents: 200_000, cashDirection: "inflow" },
        { ...base, id: "expense", status: "paid", actualCents: 70_000 },
      ],
      "2026-08",
      50_000
    );
    expect(summary.closingBalanceCents).toBe(180_000);
  });

  it("transporta o saldo final sem criar lançamento duplicado", () => {
    expect(carryBalance(180_000)).toBe(180_000);
  });

  it("gera recorrências mensais com chave idempotente", () => {
    expect(generateMonthlyOccurrences({ recurrenceId: "r1", startDate: "2026-01-31", count: 3 })).toEqual([
      { date: "2026-01-31", sourceKey: "recurrence:r1:2026-01-31" },
      { date: "2026-02-28", sourceKey: "recurrence:r1:2026-02-28" },
      { date: "2026-03-31", sourceKey: "recurrence:r1:2026-03-31" },
    ]);
  });

  it("gera a quantidade solicitada de parcelas", () => {
    expect(splitInstallments(163_167, 3)).toEqual([54_389, 54_389, 54_389]);
  });

  it("corrige o arredondamento na última parcela", () => {
    expect(splitInstallments(10_000, 3)).toEqual([3_333, 3_333, 3_334]);
  });

  it("ignora parcela cancelada no resumo", () => {
    expect(summarizeMonth([{ ...base, status: "cancelled" }], "2026-08").expectedExpenseCents).toBe(0);
  });

  it("ignora soft delete sem apagar o histórico lógico", () => {
    expect(summarizeMonth([{ ...base, deleted: true }], "2026-08").expectedExpenseCents).toBe(0);
  });

  it("subtrai estorno da despesa", () => {
    const total = invoiceTotalCents([
      base,
      { ...base, id: "reversal", entryType: "reversal", expectedCents: 2_000, cashDirection: "inflow" },
    ]);
    expect(total).toBe(8_000);
  });

  it("estorno recebido recompõe o caixa", () => {
    const result = summarizeMonth([
      { ...base, id: "reversal", entryType: "reversal", status: "received", expectedCents: 2_000, actualCents: 2_000, cashDirection: "inflow" },
    ], "2026-08");
    expect(result.cashInCents).toBe(2_000);
    expect(result.actualExpenseCents).toBe(-2_000);
  });

  it("soma fatura sem incluir transferências", () => {
    expect(invoiceTotalCents([base, { ...base, id: "transfer", entryType: "transfer", expectedCents: 8_000 }])).toBe(10_000);
  });

  it("pagamento da fatura não duplica despesa", () => {
    const result = summarizeMonth([
      { ...base, status: "paid", actualCents: 10_000 },
      { ...base, id: "invoice-payment", entryType: "transfer", status: "paid", actualCents: 10_000 },
    ], "2026-08");
    expect(result.actualExpenseCents).toBe(10_000);
  });

  it("transferência não altera resultado operacional", () => {
    const result = summarizeMonth([{ ...base, entryType: "transfer", status: "paid", actualCents: 10_000 }], "2026-08");
    expect(result.operatingActualCents).toBe(0);
  });

  it("aplicação e resgate afetam caixa, mas não resultado", () => {
    const result = summarizeMonth([
      { ...base, entryType: "investment_application", status: "paid", actualCents: 20_000 },
      { ...base, id: "redemption", entryType: "investment_redemption", status: "received", actualCents: 8_000, cashDirection: "inflow" },
    ], "2026-08");
    expect(result.operatingActualCents).toBe(0);
    expect(result.closingBalanceCents).toBe(-12_000);
  });

  it("rateia entre proprietários preservando o total", () => {
    expect(allocateByPercentage(10_001, [
      { personId: "augusto", basisPoints: 5_000 },
      { personId: "maria", basisPoints: 5_000 },
    ])).toEqual([
      { personId: "augusto", cents: 5_000 },
      { personId: "maria", cents: 5_001 },
    ]);
  });

  it("isola lançamentos por família", () => {
    expect(filterFamily([base, { ...base, id: "b", familyId: "family-b" }], "family-a")).toHaveLength(1);
  });

  it("filtra por competência", () => {
    expect(filterCompetence([base, { ...base, id: "sep", competence: "2026-09" }], "2026-08")).toHaveLength(1);
  });

  it("identifica lançamento atrasado e não realizado", () => {
    expect(isOverdue(base, "2026-08-11")).toBe(true);
    expect(isOverdue({ ...base, status: "paid" }, "2026-08-11")).toBe(false);
  });
});
