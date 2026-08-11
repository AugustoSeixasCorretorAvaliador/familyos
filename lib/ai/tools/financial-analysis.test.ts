import { describe, expect, it } from "vitest";
import type {
  Account,
  Category,
  FinancialEntryRow,
  InvestmentAsset,
  InvestmentPosition,
  LeaseContract,
} from "@/lib/finance/types";
import {
  buildFinancialExecutiveOverview,
  summarizeInvestmentPortfolio,
  summarizeRentAdjustments,
} from "@/lib/ai/tools/financial-analysis";

function entry(overrides: Partial<FinancialEntryRow> = {}) {
  return {
    id: crypto.randomUUID(),
    family_id: "family-1",
    competence: "2026-08-01",
    description: "Lançamento",
    entry_type: "expense",
    cash_direction: "outflow",
    expected_amount: 0,
    actual_amount: null,
    status: "planned",
    category_id: null,
    card_id: null,
    source_key: null,
    recurrence_id: null,
    purchase_kind: null,
    due_date: null,
    deleted_at: null,
    ...overrides,
  } as FinancialEntryRow;
}

const account = {
  id: "account-1",
  family_id: "family-1",
  institution: "Cofre",
  account_type: "Cofre",
  opening_balance: 860,
  opening_balance_date: "2026-08-01",
  deleted_at: null,
} as Account;

const category = {
  id: "category-1",
  family_id: "family-1",
  name: "Moradia",
} as Category;

describe("financial executive analysis", () => {
  it("separa fluxo financeiro de transferências e inclui o saldo inicial", () => {
    const overview = buildFinancialExecutiveOverview({
      accounts: [account],
      categories: [category],
      competence: "2026-08-01",
      today: "2026-08-11",
      entries: [
        entry({ entry_type: "income", cash_direction: "inflow", expected_amount: 1000, actual_amount: 1000 }),
        entry({ category_id: category.id, expected_amount: 400, actual_amount: 400 }),
        entry({ entry_type: "transfer", cash_direction: "outflow", expected_amount: 500, actual_amount: 500 }),
        entry({ entry_type: "transfer", cash_direction: "inflow", expected_amount: 500, actual_amount: 500 }),
      ],
    });

    expect(overview.current.effectiveIncome).toBe(1000);
    expect(overview.current.effectiveExpense).toBe(400);
    expect(overview.current.effectiveResult).toBe(600);
    expect(overview.liquidity.availableBalance).toBe(1460);
  });

  it("não duplica os detalhes do cartão quando existe fatura consolidada", () => {
    const overview = buildFinancialExecutiveOverview({
      accounts: [account],
      categories: [category],
      competence: "2026-08-01",
      today: "2026-08-11",
      entries: [
        entry({ card_id: "card-1", category_id: category.id, expected_amount: 600 }),
        entry({ card_id: "card-1", category_id: category.id, expected_amount: 900, source_key: "card-balance:card-1:2026-08-01" }),
      ],
    });

    expect(overview.current.effectiveExpense).toBe(900);
  });
});

describe("investment executive analysis", () => {
  it("usa somente a posição mais recente de cada ativo", () => {
    const asset = {
      id: "asset-1",
      family_id: "family-1",
      name: "Investimento",
      institution: "Banco",
      asset_type: "renda_fixa",
      active: true,
      deleted_at: null,
    } as InvestmentAsset;
    const positions = [
      { id: "position-new", asset_id: asset.id, position_date: "2026-08-01", market_value: 1200, cost_amount: 1000 },
      { id: "position-old", asset_id: asset.id, position_date: "2026-07-01", market_value: 1100, cost_amount: 1000 },
    ] as InvestmentPosition[];

    const summary = summarizeInvestmentPortfolio([asset], positions);

    expect(summary.totalMarketValue).toBe(1200);
    expect(summary.totalGainAmount).toBe(200);
    expect(summary.items[0].gainPercent).toBe(20);
  });

  it("mantém investimentos em moedas diferentes separados", () => {
    const assets = [
      {
        id: "asset-brl",
        family_id: "family-1",
        name: "Brasil",
        institution: "Banco",
        asset_type: "renda_fixa",
        currency: "BRL",
        active: true,
        deleted_at: null,
      },
      {
        id: "asset-usd",
        family_id: "family-1",
        name: "Exterior",
        institution: "Corretora",
        asset_type: "acoes",
        currency: "USD",
        active: true,
        deleted_at: null,
      },
    ] as InvestmentAsset[];
    const positions = [
      { id: "position-brl", asset_id: "asset-brl", position_date: "2026-08-01", market_value: 1000, cost_amount: 900 },
      { id: "position-usd", asset_id: "asset-usd", position_date: "2026-08-01", market_value: 200, cost_amount: 150 },
    ] as InvestmentPosition[];

    const summary = summarizeInvestmentPortfolio(assets, positions);

    expect(summary.totalMarketValueBRL).toBe(1000);
    expect(summary.totalsByCurrency).toEqual([
      expect.objectContaining({ currency: "BRL", marketValue: 1000 }),
      expect.objectContaining({ currency: "USD", marketValue: 200 }),
    ]);
    expect(summary.warnings.join(" ")).toContain("não foram convertidos");
  });
});

describe("rent adjustment analysis", () => {
  it("sinaliza contratos ativos sem próxima data de reajuste", () => {
    const lease = {
      id: "lease-1",
      family_id: "family-1",
      property_id: "property-1",
      status: "active",
      base_rent: 2000,
      charges_amount: 0,
      adjustment_index: "IPCA",
      adjustment_frequency_months: 12,
      next_adjustment_date: null,
      end_date: null,
      deleted_at: null,
    } as LeaseContract;

    const summary = summarizeRentAdjustments(
      [lease],
      new Map([["property-1", "Apartamento"]]),
      "2026-08-11"
    );

    expect(summary.activeContractCount).toBe(1);
    expect(summary.missingAdjustmentDateCount).toBe(1);
    expect(summary.warnings).toHaveLength(1);
  });

  it("calcula vacância somente a partir de contratos marcados como vagos", () => {
    const leases = [
      {
        id: "lease-active",
        family_id: "family-1",
        property_id: "property-1",
        status: "active",
        base_rent: 2000,
        charges_amount: 0,
        adjustment_index: "IPCA",
        adjustment_frequency_months: 12,
        next_adjustment_date: "2027-01-01",
        end_date: null,
        deleted_at: null,
      },
      {
        id: "lease-vacant",
        family_id: "family-1",
        property_id: "property-2",
        status: "vacant",
        base_rent: 1000,
        charges_amount: 0,
        adjustment_index: null,
        adjustment_frequency_months: null,
        next_adjustment_date: null,
        end_date: null,
        deleted_at: null,
      },
    ] as LeaseContract[];

    const summary = summarizeRentAdjustments(leases, new Map(), "2026-08-11");

    expect(summary.activeContractCount).toBe(1);
    expect(summary.vacantContractCount).toBe(1);
    expect(summary.contractedMonthlyRent).toBe(2000);
    expect(summary.vacancyMonthlyPotential).toBe(1000);
    expect(summary.averageVacantRent).toBe(1000);
    expect(summary.estimatedVacancyRatePercent).toBe(33.3);
  });
});
