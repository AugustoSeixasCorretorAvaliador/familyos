import { describe, expect, it } from "vitest";
import { cashflowEntriesForBalance, effectiveCashflowEntries, isCardCategoryName, monthlyEntryAmount, placeCardCategoriesLast, settledEntriesTotal, sortEntriesAlphabetically } from "@/lib/finance/summary";
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

  it("deduz estornos dos totais previstos e realizados", () => {
    const reversal = entry({ entry_type: "reversal", expected_amount: 98, actual_amount: null });
    const settledReversal = entry({ entry_type: "reversal", expected_amount: 98, actual_amount: 98 });

    expect(monthlyEntryAmount(reversal)).toBe(-98);
    expect(settledEntriesTotal([entry({ actual_amount: 200 }), settledReversal])).toBe(102);
  });

  it("não duplica despesas detalhadas quando existe saldo consolidado do cartão", () => {
    const detailed = entry({ id: "detail", card_id: "card-1", expected_amount: 40 });
    const reversal = entry({ id: "reversal", card_id: "card-1", entry_type: "reversal", expected_amount: 10 });
    const consolidated = entry({ id: "balance", card_id: "card-1", expected_amount: 500, source_key: "card-balance:card-1:2026-08-01" });
    const otherMonth = entry({ id: "september", competence: "2026-09-01", card_id: "card-1", expected_amount: 60 });

    expect(effectiveCashflowEntries([detailed, reversal, consolidated, otherMonth]).map((item) => item.id)).toEqual(["balance", "september"]);
  });

  it("ignora registros arquivados e cancelados", () => {
    expect(effectiveCashflowEntries([
      entry({ id: "active" }),
      entry({ id: "cancelled", status: "cancelled" }),
      entry({ id: "archived", deleted_at: "2026-08-07T00:00:00Z" }),
    ]).map((item) => item.id)).toEqual(["active"]);
  });

  it("inicia o saldo no marco configurado e o transporta para os meses seguintes", () => {
    const rows = [
      entry({ id: "before-start", competence: "2026-06-01", actual_amount: 500 }),
      entry({ id: "august", competence: "2026-08-01", actual_amount: 200 }),
      entry({ id: "september", competence: "2026-09-01", actual_amount: 100 }),
      entry({ id: "future", competence: "2026-10-01", actual_amount: 50 }),
    ];

    expect(cashflowEntriesForBalance(rows, "2026-08-01", "2026-08-01").map((item) => item.id)).toEqual(["august"]);
    expect(cashflowEntriesForBalance(rows, "2026-09-01", "2026-08-01").map((item) => item.id)).toEqual(["august", "september"]);
  });

  it("soma somente lançamentos marcados como recebidos ou pagos", () => {
    expect(settledEntriesTotal([
      entry({ actual_amount: 80 }),
      entry({ actual_amount: null, expected_amount: 120 }),
      entry({ actual_amount: 0 }),
    ])).toBe(80);
  });

  it("ordena descrições alfabeticamente sem diferenciar acentos e caixa", () => {
    const rows = [entry({ id: "z", description: "Zeladoria" }), entry({ id: "a", description: "Água" }), entry({ id: "c", description: "condomínio" })];
    expect(sortEntriesAlphabetically(rows).map((item) => item.id)).toEqual(["a", "c", "z"]);
  });

  it("reconhece categorias de cartão com singular, plural e acentos", () => {
    expect(isCardCategoryName("Cartão de crédito")).toBe(true);
    expect(isCardCategoryName("Cartões de crédito")).toBe(true);
    expect(isCardCategoryName("Moradia")).toBe(false);
  });

  it("mantém categorias de cartões depois das demais despesas", () => {
    const rows = ["Cartões de crédito", "Moradia", "Saúde", "Cartão adicional"];
    expect(placeCardCategoriesLast(rows, (name) => name)).toEqual(["Moradia", "Saúde", "Cartões de crédito", "Cartão adicional"]);
  });
});
