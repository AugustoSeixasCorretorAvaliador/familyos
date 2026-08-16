import { describe, expect, it } from "vitest";
import { accountBalanceAtCompetence, accumulateProjectedBalance, cashflowEntriesForBalance, cashProjectedBalanceFromStart, effectiveCashflowEntries, expectedEntriesTotal, installmentProgressLabel, invoiceDisplayAmount, invoiceEntriesForCard, invoiceExpectedAmount, isCardCategoryName, isCardSettlementEntry, managedCardInvoice, monthlyEntryAmount, operatingProjectedBalanceFromStart, pendingEntriesTotal, placeCardCategoriesLast, projectedBalance, projectedBalanceFromStart, settledEntriesTotal, sortCardEntries, sortEntriesAlphabetically } from "@/lib/finance/summary";
import type { CardInvoice, FinancialEntryRow } from "@/lib/finance/types";

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

  it("inclui despesas e estornos na baixa conjunta do cartão", () => {
    expect(isCardSettlementEntry(entry({ entry_type: "expense" }))).toBe(true);
    expect(isCardSettlementEntry(entry({ entry_type: "reversal" }))).toBe(true);
    expect(isCardSettlementEntry(entry({ entry_type: "transfer" }))).toBe(false);
  });

  it("delega a baixa à fatura formal ativa da mesma competência", () => {
    const open = { id: "open", card_id: "card-1", competence: "2026-08-01", status: "closed", deleted_at: null } as CardInvoice;
    const cancelled = { id: "cancelled", card_id: "card-1", competence: "2026-08-01", status: "cancelled", deleted_at: null } as CardInvoice;
    const archived = { id: "archived", card_id: "card-1", competence: "2026-08-01", status: "closed", deleted_at: "2026-08-02T00:00:00Z" } as CardInvoice;

    expect(managedCardInvoice([cancelled, archived, open], "card-1", "2026-08-01")?.id).toBe("open");
    expect(managedCardInvoice([cancelled, archived], "card-1", "2026-08-01")).toBeUndefined();
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

  it("substitui compras do cartão pela saída única do pagamento da fatura no saldo", () => {
    const rows = [
      entry({ id: "purchase-a", card_id: "card-1", expected_amount: 54, actual_amount: 54, cash_direction: "outflow" }),
      entry({ id: "purchase-b", card_id: "card-1", expected_amount: 430.68, actual_amount: 430.68, cash_direction: "none" }),
      entry({ id: "payment", card_id: "card-1", entry_type: "transfer", expected_amount: 484.68, actual_amount: 484.68, cash_direction: "outflow", source_key: "invoice-payment:invoice-1" }),
    ];

    expect(cashflowEntriesForBalance(rows.slice(0, 2), "2026-08-01", "2026-08-01").map((item) => item.id)).toEqual(["purchase-a", "purchase-b"]);
    expect(cashflowEntriesForBalance(rows, "2026-08-01", "2026-08-01").map((item) => item.id)).toEqual(["payment"]);
  });

  it("calcula e exibe a fatura pelos lançamentos atuais e pelo valor efetivamente pago", () => {
    const rows = [
      entry({ id: "annual-fee", card_id: "card-1", expected_amount: 54 }),
      entry({ id: "insurance-a", card_id: "card-1", expected_amount: 162.36 }),
      entry({ id: "insurance-b", card_id: "card-1", expected_amount: 268.32 }),
      entry({ id: "other-card", card_id: "card-2", expected_amount: 100 }),
    ];
    const invoice = { status: "paid", expected_amount: 609.65, closed_amount: 609.65, paid_amount: 484.68 } as CardInvoice;
    const invoiceEntries = invoiceEntriesForCard(rows, "card-1", "2026-08-01");

    expect(invoiceExpectedAmount(invoiceEntries, invoice.expected_amount)).toBe(484.68);
    expect(invoiceDisplayAmount(invoice, 484.68)).toBe(484.68);
  });

  it("acumula o saldo projetado dos meses anteriores", () => {
    const rows = [
      entry({ id: "august", competence: "2026-08-01", expected_amount: 1000 }),
      ...Array.from({ length: 10 }, (_, index) => entry({
        id: `income-${index}`,
        competence: new Date(Date.UTC(2026, 9 + index, 1)).toISOString().slice(0, 10),
        entry_type: "income",
        cash_direction: "inflow",
        expected_amount: 4000,
      })),
    ];

    expect(accumulateProjectedBalance(-1000, rows.slice(1))).toBe(39000);
  });

  it("combina caixa realizado e somente a diferença ainda projetada", () => {
    const rows = [
      entry({ entry_type: "income", cash_direction: "inflow", expected_amount: 100, actual_amount: 80 }),
      entry({ entry_type: "expense", cash_direction: "outflow", expected_amount: 50, actual_amount: 50 }),
      entry({ entry_type: "transfer", cash_direction: "inflow", expected_amount: 25, actual_amount: 25 }),
      entry({ entry_type: "transfer", cash_direction: "outflow", expected_amount: 25, actual_amount: 25 }),
    ];

    expect(projectedBalance(1000, rows, rows)).toBe(1050);
  });

  it("preserva a largada sem incorporar pendências de meses anteriores", () => {
    const historicalPending = entry({ competence: "2026-07-01", expected_amount: 500, cash_direction: "outflow" });
    const august = entry({ competence: "2026-08-01", expected_amount: 1000, cash_direction: "outflow" });

    expect(projectedBalance(0, [historicalPending, august], [august])).toBe(-1000);
  });

  it("zera julho, preserva agosto e acumula somente os meses posteriores", () => {
    const octoberToJuly = Array.from({ length: 10 }, (_, index) => entry({
      competence: new Date(Date.UTC(2026, 9 + index, 1)).toISOString().slice(0, 10),
      entry_type: "income",
      cash_direction: "inflow",
      expected_amount: 4000,
    }));

    expect(projectedBalanceFromStart("2026-07-01", "2026-08-01", 999)).toBe(0);
    expect(projectedBalanceFromStart("2026-08-01", "2026-08-01", -1000)).toBe(-1000);
    expect(projectedBalanceFromStart("2027-07-01", "2026-08-01", 999, -1000, octoberToJuly)).toBe(39000);
  });

  it("ancora o mês atual no saldo das contas e transporta o projetado aos meses seguintes", () => {
    const rows = [
      entry({ id: "received", entry_type: "income", cash_direction: "inflow", expected_amount: 31656.87, actual_amount: 31656.87 }),
      entry({ id: "receivable", entry_type: "income", cash_direction: "inflow", expected_amount: 6400 }),
      entry({ id: "paid", entry_type: "expense", cash_direction: "outflow", expected_amount: 24964.2, actual_amount: 24964.2 }),
      entry({ id: "payable", entry_type: "expense", cash_direction: "outflow", expected_amount: 12057.29 }),
      entry({ id: "september-income", competence: "2026-09-01", entry_type: "income", cash_direction: "inflow", expected_amount: 4000 }),
      entry({ id: "september-expense", competence: "2026-09-01", entry_type: "expense", cash_direction: "outflow", expected_amount: 3000 }),
    ];

    expect(cashProjectedBalanceFromStart("2026-08-01", "2026-08-01", 8275.45, rows)).toBeCloseTo(2618.16);
    expect(cashProjectedBalanceFromStart("2026-09-01", "2026-08-01", 8275.45, rows)).toBeCloseTo(3618.16);
  });

  it("projeta o resultado operacional desde o marco zero sem carregar saldos ou ajustes", () => {
    const rows = [
      entry({ id: "income", entry_type: "income", expected_amount: 28056.87, cash_direction: "inflow" }),
      entry({ id: "expense", entry_type: "expense", expected_amount: 30162.99, cash_direction: "outflow" }),
      entry({ id: "adjustment", entry_type: "adjustment", expected_amount: 560.96, actual_amount: 560.96, cash_direction: "outflow" }),
      entry({ id: "transfer-in", entry_type: "transfer", expected_amount: 100, actual_amount: 100, cash_direction: "inflow" }),
      entry({ id: "transfer-out", entry_type: "transfer", expected_amount: 100, actual_amount: 100, cash_direction: "outflow" }),
    ];

    expect(operatingProjectedBalanceFromStart("2026-07-01", "2026-08-01", rows)).toBe(0);
    expect(operatingProjectedBalanceFromStart("2026-08-01", "2026-08-01", rows)).toBeCloseTo(-2106.12);
  });

  it("aplica ajuste negativo somente ao saldo disponível", () => {
    const adjustment = entry({
      entry_type: "adjustment",
      expected_amount: 560.96,
      actual_amount: 560.96,
      cash_direction: "outflow",
    });

    expect(projectedBalance(4208.96, [adjustment], [])).toBeCloseTo(3648);
  });

  it("exibe saldo por conta e preserva o total nas transferências", () => {
    const transferOut = entry({ id: "transfer-out", entry_type: "transfer", account_id: "bradesco", actual_amount: 560, cash_direction: "outflow" });
    const transferIn = entry({ id: "transfer-in", entry_type: "transfer", account_id: "destino", actual_amount: 560, cash_direction: "inflow" });
    const bradesco = { id: "bradesco", opening_balance: 1000, opening_balance_date: "2026-08-01" };
    const destino = { id: "destino", opening_balance: 0, opening_balance_date: "2026-08-01" };

    const bradescoBalance = accountBalanceAtCompetence(bradesco, [transferOut, transferIn], "2026-08-01");
    const destinoBalance = accountBalanceAtCompetence(destino, [transferOut, transferIn], "2026-08-01");
    expect(bradescoBalance).toBe(440);
    expect(destinoBalance).toBe(560);
    expect(bradescoBalance + destinoBalance).toBe(1000);
  });

  it("soma somente lançamentos marcados como recebidos ou pagos", () => {
    expect(settledEntriesTotal([
      entry({ actual_amount: 80 }),
      entry({ actual_amount: null, expected_amount: 120 }),
      entry({ actual_amount: 0 }),
    ])).toBe(80);
  });

  it("calcula o total esperado e a diferença ainda pendente", () => {
    const rows = [
      entry({ expected_amount: 100, actual_amount: 100 }),
      entry({ expected_amount: 120, actual_amount: null }),
      entry({ entry_type: "reversal", expected_amount: 20, actual_amount: null }),
    ];
    expect(expectedEntriesTotal(rows)).toBe(200);
    expect(pendingEntriesTotal(rows)).toBe(100);
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

  it("ordena o cartão por recorrentes, parcelas pendentes e avulsos", () => {
    const rows = [
      entry({ id: "single-z", description: "Zeladoria avulsa", purchase_kind: "one_off" }),
      entry({ id: "installment-12", description: "Última compra", purchase_kind: "installment", installment_number: 12, installment_count: 12 }),
      entry({ id: "recurring-z", description: "Seguro mensal", purchase_kind: "recurring" }),
      entry({ id: "installment-9", description: "Óculos", purchase_kind: "installment", installment_number: 9, installment_count: 10 }),
      entry({ id: "installment-1", description: "Notebook", purchase_kind: "installment", installment_number: 1, installment_count: 24 }),
      entry({ id: "recurring-a", description: "Anuidade", recurrence_id: "recurrence-1" }),
      entry({ id: "installment-7", description: "Celular", installment_purchase_id: "purchase-1", installment_number: 7, installment_count: 8 }),
      entry({ id: "single-a", description: "Abastecimento", purchase_kind: "one_off" }),
    ];

    expect(sortCardEntries(rows).map((item) => item.id)).toEqual([
      "recurring-a",
      "recurring-z",
      "installment-1",
      "installment-7",
      "installment-9",
      "installment-12",
      "single-a",
      "single-z",
    ]);
  });

  it("formata o progresso dos parcelamentos com dois dígitos", () => {
    expect(installmentProgressLabel(entry({ installment_number: 4, installment_count: 12 }))).toBe("PARC: 04/12");
    expect(installmentProgressLabel(entry({ installment_number: 12, installment_count: 12 }))).toBe("PARC: 12/12");
    expect(installmentProgressLabel(entry({ installment_number: null, installment_count: null }))).toBeNull();
  });
});
