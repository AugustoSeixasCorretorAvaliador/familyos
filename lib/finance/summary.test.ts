import { describe, expect, it } from "vitest";
import { effectiveCashflowEntries, monthlyEntryAmount } from "@/lib/finance/summary";
import type { FinancialEntryRow } from "@/lib/finance/types";

function entry(overrides: Partial<FinancialEntryRow> = {}) {
  return {
    id: crypto.randomUUID(),
    competence: "2026-08-01",
    entry_type: "expense",
    expected_amount: 100,
    actual_amount: null,
    status: "payable",
    deleted_at: null,
    card_id: null,
    source_key: null,
    ...overrides,
  } as FinancialEntryRow;
}

describe("resumo financeiro mensal", () => {
  it("usa o realizado quando informado e o previsto como valor mínimo", () => {
    expect(monthlyEntryAmount(entry({ expected_amount: 100, actual_amount: null }))).toBe(100);
    expect(monthlyEntryAmount(entry({ expected_amount: 100, actual_amount: 87.5 }))).toBe(87.5);
  });

  it("não duplica despesas detalhadas quando existe saldo consolidado do cartão", () => {
    const detailed = entry({ id: "detail", card_id: "card-1", expected_amount: 40 });
    const consolidated = entry({ id: "balance", card_id: "card-1", expected_amount: 500, source_key: "card-balance:card-1:2026-08-01" });
    const otherMonth = entry({ id: "september", competence: "2026-09-01", card_id: "card-1", expected_amount: 60 });

    expect(effectiveCashflowEntries([detailed, consolidated, otherMonth]).map((item) => item.id)).toEqual(["balance", "september"]);
  });

  it("ignora registros arquivados e cancelados", () => {
    expect(effectiveCashflowEntries([
      entry({ id: "active" }),
      entry({ id: "cancelled", status: "cancelled" }),
      entry({ id: "archived", deleted_at: "2026-08-07T00:00:00Z" }),
    ]).map((item) => item.id)).toEqual(["active"]);
  });
});
