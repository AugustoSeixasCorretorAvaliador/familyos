import type {
  Account,
  Category,
  FinancialEntryRow,
  InvestmentAsset,
  InvestmentPosition,
  LeaseContract,
} from "@/lib/finance/types";
import {
  cashflowEntriesForBalance,
  effectiveCashflowEntries,
  monthlyEntryAmount,
} from "@/lib/finance/summary";

function money(value: number) {
  return Number(value.toFixed(2));
}

function numeric(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function percentage(current: number, previous: number) {
  if (previous === 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export function competenceFromDate(now: Date) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

export function addCompetenceMonths(competence: string, months: number) {
  const date = new Date(`${competence.slice(0, 7)}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 7) + "-01";
}

function addDays(dateOnly: string, days: number) {
  const date = new Date(`${dateOnly}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthMetrics(entries: FinancialEntryRow[], competence: string) {
  const month = entries.filter((entry) => entry.competence === competence);
  const income = month.filter((entry) =>
    ["income", "investment_yield"].includes(entry.entry_type)
  );
  const expense = month.filter((entry) =>
    ["expense", "reversal"].includes(entry.entry_type)
  );
  const signedExpectedExpense = (entry: FinancialEntryRow) =>
    entry.entry_type === "reversal" ? -entry.expected_amount : entry.expected_amount;
  const signedActualExpense = (entry: FinancialEntryRow) =>
    entry.entry_type === "reversal" ? -(entry.actual_amount ?? 0) : entry.actual_amount ?? 0;
  const effectiveIncome = income.reduce((sum, entry) => sum + monthlyEntryAmount(entry), 0);
  const effectiveExpense = expense.reduce((sum, entry) => sum + monthlyEntryAmount(entry), 0);

  return {
    competence,
    expectedIncome: money(income.reduce((sum, entry) => sum + entry.expected_amount, 0)),
    actualIncome: money(income.reduce((sum, entry) => sum + (entry.actual_amount ?? 0), 0)),
    expectedExpense: money(expense.reduce((sum, entry) => sum + signedExpectedExpense(entry), 0)),
    actualExpense: money(expense.reduce((sum, entry) => sum + signedActualExpense(entry), 0)),
    effectiveIncome: money(effectiveIncome),
    effectiveExpense: money(effectiveExpense),
    effectiveResult: money(effectiveIncome - effectiveExpense),
    entryCount: month.length,
    realizedEntryCount: month.filter((entry) => entry.actual_amount !== null).length,
  };
}

function categoryExpenseMap(
  entries: FinancialEntryRow[],
  competence: string,
  categoryNames: Map<string, string>
) {
  const totals = new Map<string, number>();
  for (const entry of entries) {
    if (entry.competence !== competence || !["expense", "reversal"].includes(entry.entry_type)) continue;
    const name = (entry.category_id && categoryNames.get(entry.category_id)) || "Sem categoria";
    const amount = entry.entry_type === "reversal" ? -monthlyEntryAmount(entry) : monthlyEntryAmount(entry);
    totals.set(name, (totals.get(name) ?? 0) + amount);
  }
  return totals;
}

export function buildFinancialExecutiveOverview(input: {
  entries: FinancialEntryRow[];
  accounts: Account[];
  categories: Category[];
  competence: string;
  today: string;
}) {
  const brlAccounts = input.accounts.filter(
    (account) => (account.currency?.trim() || "BRL") === "BRL"
  );
  const brlAccountIds = new Set(brlAccounts.map((account) => account.id));
  const activeEntries = effectiveCashflowEntries(input.entries).filter(
    (entry) => !entry.account_id || brlAccountIds.has(entry.account_id)
  );
  const monthSeries = Array.from({ length: 13 }, (_, index) =>
    monthMetrics(activeEntries, addCompetenceMonths(input.competence, index - 6))
  );
  const current = monthSeries[6];
  const previous = monthSeries[5];
  const openingBalanceDate = brlAccounts
    .map((account) => account.opening_balance_date)
    .filter((date): date is string => Boolean(date))
    .sort()[0] ?? null;
  const balanceEntries = cashflowEntriesForBalance(
    activeEntries,
    input.competence,
    openingBalanceDate
  );
  const openingBalance = brlAccounts
    .filter((account) => !account.opening_balance_date || account.opening_balance_date <= input.competence)
    .reduce((sum, account) => sum + account.opening_balance, 0);
  const cashIn = balanceEntries
    .filter((entry) => entry.cash_direction === "inflow")
    .reduce((sum, entry) => sum + (entry.actual_amount ?? 0), 0);
  const cashOut = balanceEntries
    .filter((entry) => entry.cash_direction === "outflow")
    .reduce((sum, entry) => sum + (entry.actual_amount ?? 0), 0);
  const categoryNames = new Map(input.categories.map((category) => [category.id, category.name]));
  const currentCategories = categoryExpenseMap(activeEntries, input.competence, categoryNames);
  const previousCategories = categoryExpenseMap(
    activeEntries,
    addCompetenceMonths(input.competence, -1),
    categoryNames
  );
  const categoryChanges = Array.from(
    new Set([
      ...Array.from(currentCategories.keys()),
      ...Array.from(previousCategories.keys()),
    ])
  )
    .map((name) => {
      const currentAmount = currentCategories.get(name) ?? 0;
      const previousAmount = previousCategories.get(name) ?? 0;
      return {
        category: name,
        currentAmount: money(currentAmount),
        previousAmount: money(previousAmount),
        changeAmount: money(currentAmount - previousAmount),
        changePercent: percentage(currentAmount, previousAmount),
      };
    })
    .sort((left, right) => right.changeAmount - left.changeAmount)
    .slice(0, 8);
  const topCurrentExpenses = Array.from(currentCategories.entries())
    .map(([category, amount]) => ({ category, amount: money(amount) }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 8);
  const unsettled = activeEntries.filter((entry) => entry.actual_amount === null);
  const dueNext7 = addDays(input.today, 7);
  const dueNext30 = addDays(input.today, 30);
  const futureMonths = monthSeries.slice(7);
  const warnings: string[] = [];
  if (input.accounts.length === 0) warnings.push("Nenhuma conta financeira ativa foi encontrada.");
  if (brlAccounts.length < input.accounts.length) {
    warnings.push(
      "Contas e movimentos vinculados a moedas diferentes de BRL foram mantidos fora do fluxo consolidado em reais."
    );
  }
  if (current.entryCount > 0 && current.realizedEntryCount === 0) {
    warnings.push("A competência atual não possui lançamentos realizados; os valores são planejados.");
  }
  const statedBalances = new Map<string, number>();
  for (const account of input.accounts) {
    const metadata = account.metadata && typeof account.metadata === "object" && !Array.isArray(account.metadata)
      ? account.metadata as Record<string, unknown>
      : {};
    const balance = numeric(metadata.saldo_atual) ?? account.opening_balance;
    const currency = account.currency?.trim() || "BRL";
    statedBalances.set(currency, (statedBalances.get(currency) ?? 0) + balance);
  }
  const pendingIncome = Math.max(0, current.expectedIncome - current.actualIncome);
  const pendingExpense = Math.max(0, current.expectedExpense - current.actualExpense);
  const availableBalance = money(openingBalance + cashIn - cashOut);

  return {
    currency: "BRL" as const,
    current,
    comparisonWithPreviousMonth: {
      incomeChangeAmount: money(current.effectiveIncome - previous.effectiveIncome),
      incomeChangePercent: percentage(current.effectiveIncome, previous.effectiveIncome),
      expenseChangeAmount: money(current.effectiveExpense - previous.effectiveExpense),
      expenseChangePercent: percentage(current.effectiveExpense, previous.effectiveExpense),
      resultChangeAmount: money(current.effectiveResult - previous.effectiveResult),
    },
    liquidity: {
      accountCount: input.accounts.length,
      openingBalance: money(openingBalance),
      realizedCashIn: money(cashIn),
      realizedCashOut: money(cashOut),
      realizedMonthResult: money(current.actualIncome - current.actualExpense),
      availableBalance,
      pendingIncomeThisMonth: money(pendingIncome),
      pendingExpenseThisMonth: money(pendingExpense),
      provisionedMonthEndBalance: money(availableBalance + pendingIncome - pendingExpense),
      statedBalancesByCurrency: Array.from(statedBalances.entries())
        .map(([currency, balance]) => ({ currency, balance: money(balance) }))
        .sort((left, right) => left.currency.localeCompare(right.currency)),
      asOfCompetence: input.competence,
      asOfDate: input.today,
    },
    obligations: {
      overdueCount: unsettled.filter((entry) => entry.due_date && entry.due_date < input.today).length,
      dueNext7DaysCount: unsettled.filter(
        (entry) => entry.due_date && entry.due_date >= input.today && entry.due_date <= dueNext7
      ).length,
      dueNext30DaysCount: unsettled.filter(
        (entry) => entry.due_date && entry.due_date >= input.today && entry.due_date <= dueNext30
      ).length,
      expectedExpensesNext6Months: money(
        futureMonths.reduce((sum, month) => sum + month.expectedExpense, 0)
      ),
      expectedIncomeNext6Months: money(
        futureMonths.reduce((sum, month) => sum + month.expectedIncome, 0)
      ),
    },
    topCurrentExpenses,
    largestExpenseChanges: categoryChanges,
    monthSeries,
    warnings,
  };
}

export function summarizeInvestmentPortfolio(
  assets: InvestmentAsset[],
  positions: InvestmentPosition[]
) {
  const latestByAsset = new Map<string, InvestmentPosition>();
  const activeAssetIds = new Set(assets.filter((asset) => asset.active && !asset.deleted_at).map((asset) => asset.id));
  for (const position of positions) {
    if (activeAssetIds.has(position.asset_id) && !latestByAsset.has(position.asset_id)) {
      latestByAsset.set(position.asset_id, position);
    }
  }
  const items = assets
    .filter((asset) => activeAssetIds.has(asset.id))
    .map((asset) => {
      const position = latestByAsset.get(asset.id);
      const marketValue = position?.market_value ?? null;
      const costAmount = position?.cost_amount ?? null;
      const gainAmount = marketValue !== null && costAmount !== null ? marketValue - costAmount : null;
      return {
        name: asset.name,
        institution: asset.institution,
        assetType: asset.asset_type,
        currency: asset.currency?.trim() || "BRL",
        positionDate: position?.position_date ?? null,
        marketValue,
        costAmount,
        gainAmount: gainAmount === null ? null : money(gainAmount),
        gainPercent:
          gainAmount === null || costAmount === null || costAmount === 0
            ? null
            : Number(((gainAmount / costAmount) * 100).toFixed(1)),
      };
    });
  const currencies = Array.from(new Set(items.map((item) => item.currency))).sort();
  const totalsByCurrency = currencies.map((currency) => {
    const currencyItems = items.filter((item) => item.currency === currency);
    const marketValues = currencyItems.flatMap((item) => item.marketValue === null ? [] : [item.marketValue]);
    const costs = currencyItems.flatMap((item) => item.costAmount === null ? [] : [item.costAmount]);
    const marketValue = money(marketValues.reduce((sum, value) => sum + value, 0));
    const costAmount = money(costs.reduce((sum, value) => sum + value, 0));
    return {
      currency,
      assetCount: currencyItems.length,
      marketValue: marketValues.length ? marketValue : null,
      costAmount: costs.length ? costAmount : null,
      gainAmount: marketValues.length && costs.length ? money(marketValue - costAmount) : null,
    };
  });
  const brl = totalsByCurrency.find((total) => total.currency === "BRL");

  return {
    assetCount: items.length,
    assetsWithPosition: items.filter((item) => item.marketValue !== null).length,
    totalsByCurrency,
    totalMarketValue: brl?.marketValue ?? null,
    totalMarketValueBRL: brl?.marketValue ?? null,
    totalCostAmount: brl?.costAmount ?? null,
    totalCostAmountBRL: brl?.costAmount ?? null,
    totalGainAmount: brl?.gainAmount ?? null,
    totalGainAmountBRL: brl?.gainAmount ?? null,
    items,
    warnings: [
      ...(items.filter((item) => item.marketValue === null).length
        ? ["Há investimentos ativos sem posição de mercado cadastrada; os totais são parciais."]
        : []),
      ...(currencies.some((currency) => currency !== "BRL")
        ? ["Valores em moedas diferentes são apresentados separadamente e não foram convertidos por falta de cotação cadastrada."]
        : []),
    ],
  };
}

export function summarizeRentAdjustments(
  leases: LeaseContract[],
  propertyNames: Map<string, string>,
  today: string
) {
  const relevant = leases.filter(
    (lease) => ["active", "vacant"].includes(lease.status) && !lease.deleted_at
  );
  const active = relevant.filter((lease) => lease.status === "active");
  const vacant = relevant.filter((lease) => lease.status === "vacant");
  const upcomingLimit = addDays(today, 180);
  const items = relevant
    .map((lease) => ({
      property: propertyNames.get(lease.property_id) ?? "Imóvel sem título",
      baseRent: lease.base_rent,
      chargesAmount: lease.charges_amount,
      adjustmentIndex: lease.adjustment_index,
      adjustmentFrequencyMonths: lease.adjustment_frequency_months,
      nextAdjustmentDate: lease.next_adjustment_date,
      endDate: lease.end_date,
      occupancyStatus: lease.status,
      adjustmentStatus: !lease.next_adjustment_date
        ? lease.status === "active"
          ? "data_ausente"
          : "nao_aplicavel_vago"
        : lease.next_adjustment_date < today
          ? "atrasado"
          : lease.next_adjustment_date <= upcomingLimit
            ? "proximos_180_dias"
            : "futuro",
    }))
    .sort((left, right) =>
      (left.nextAdjustmentDate ?? "9999-12-31").localeCompare(right.nextAdjustmentDate ?? "9999-12-31")
    );
  const missingAdjustmentDate = items.filter(
    (item) => item.nextAdjustmentDate === null && item.adjustmentStatus === "data_ausente"
  ).length;
  const contractedMonthlyRent = money(active.reduce((sum, lease) => sum + lease.base_rent, 0));
  const vacancyMonthlyPotential = money(vacant.reduce((sum, lease) => sum + lease.base_rent, 0));
  const potentialGrossRent = money(contractedMonthlyRent + vacancyMonthlyPotential);

  return {
    currency: "BRL" as const,
    activeContractCount: active.length,
    vacantContractCount: vacant.length,
    contractedMonthlyRent,
    vacancyMonthlyPotential,
    averageVacantRent: vacant.length ? money(vacancyMonthlyPotential / vacant.length) : null,
    potentialGrossRent,
    estimatedVacancyRatePercent:
      potentialGrossRent > 0 ? Number(((vacancyMonthlyPotential / potentialGrossRent) * 100).toFixed(1)) : null,
    overdueAdjustmentCount: items.filter((item) => item.adjustmentStatus === "atrasado").length,
    adjustmentsNext180DaysCount: items.filter(
      (item) => item.adjustmentStatus === "proximos_180_dias"
    ).length,
    missingAdjustmentDateCount: missingAdjustmentDate,
    contractsEndingNext180DaysCount: items.filter(
      (item) => item.endDate && item.endDate >= today && item.endDate <= upcomingLimit
    ).length,
    items,
    warnings: missingAdjustmentDate
      ? [`${missingAdjustmentDate} contrato(s) ativo(s) sem próxima data de reajuste; o alerta fica incompleto.`]
      : [],
  };
}
