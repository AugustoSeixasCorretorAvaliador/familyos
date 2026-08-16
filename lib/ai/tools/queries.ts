import type { PostgrestError } from "@supabase/supabase-js";
import { getGoogleCalendarUpcomingEvents } from "@/lib/calendar/status";
import { redactSensitiveText, toDateOnly } from "@/lib/ai/tools/privacy";
import {
  addCompetenceMonths,
  buildFinancialExecutiveOverview,
  competenceFromDate,
  summarizeInvestmentPortfolio,
  summarizeRentAdjustments,
} from "@/lib/ai/tools/financial-analysis";
import {
  buildPropertyExecutiveRecord,
  summarizePropertyPortfolio,
  type PropertyExecutiveRecord,
} from "@/lib/ai/tools/properties";
import type {
  Account,
  Category,
  FinancialEntryRow,
  InvestmentAsset,
  InvestmentPosition,
  LeaseContract,
} from "@/lib/finance/types";
import type {
  ExecutiveToolContext,
  ExecutiveToolResult,
} from "@/lib/ai/tools/types";

function result(context: ExecutiveToolContext, data: unknown): ExecutiveToolResult {
  return { available: true, asOf: context.now.toISOString(), data };
}

function unavailable(context: ExecutiveToolContext, reason: string): ExecutiveToolResult {
  return { available: false, asOf: context.now.toISOString(), reason };
}

function isMissingRelation(error: PostgrestError | null) {
  return Boolean(
    error &&
      (error.code === "42P01" ||
        error.code === "PGRST205" ||
        error.message.toLowerCase().includes("could not find the table"))
  );
}

function assertQuery(error: PostgrestError | null, resource: string) {
  if (error) {
    throw new Error(`Falha ao consultar ${resource}`);
  }
}

function finiteNumber(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function personFromRelation(value: unknown) {
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== "object") {
    return { firstName: null, lastName: null };
  }
  const person = relation as Record<string, unknown>;
  return {
    firstName: person.first_name,
    lastName: person.last_name,
  };
}

async function loadPropertyPortfolio(
  context: ExecutiveToolContext
): Promise<PropertyExecutiveRecord[]> {
  const query = await context.supabase
    .from("properties")
    .select(
      "id, title, address, city, state, metadata, outstanding_debt, valuation_date, valuation_source, property_owners(person_id, ownership_percentage, people(first_name, last_name))"
    )
    .eq("family_id", context.familyId)
    .is("deleted_at", null)
    .order("title", { ascending: true })
    .limit(50);

  assertQuery(query.error, "imóveis");

  return ((query.data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const ownerRows = Array.isArray(row.property_owners)
      ? (row.property_owners as Array<Record<string, unknown>>)
      : [];
    return buildPropertyExecutiveRecord({
      id: String(row.id),
      title: row.title,
      address: row.address,
      city: row.city,
      state: row.state,
      status: null,
      metadata:
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null,
      outstandingDebt: row.outstanding_debt,
      valuationDate: row.valuation_date,
      valuationSource: row.valuation_source,
      owners: ownerRows.map((owner) => {
        const person = personFromRelation(owner.people);
        return {
          personId: String(owner.person_id),
          firstName: person.firstName,
          lastName: person.lastName,
          ownershipPercentage: owner.ownership_percentage,
        };
      }),
    });
  });
}

export async function listPeople(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const query = await context.supabase
    .from("people")
    .select("first_name, last_name, family_role, status")
    .eq("family_id", context.familyId)
    .is("deleted_at", null)
    .order("first_name", { ascending: true })
    .limit(30);

  assertQuery(query.error, "pessoas");
  const items = ((query.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    name: redactSensitiveText(
      `${String(row.first_name ?? "")} ${String(row.last_name ?? "")}`.trim()
    ),
    familyRole: redactSensitiveText(row.family_role, 80),
    status: redactSensitiveText(row.status, 80),
  }));
  return result(context, { count: items.length, items });
}

export async function listProperties(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const items = await loadPropertyPortfolio(context);
  return result(context, { count: items.length, items });
}

export async function getPropertyPortfolioSummary(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const properties = await loadPropertyPortfolio(context);
  return result(context, summarizePropertyPortfolio(properties));
}

export async function listDocuments(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const query = await context.supabase
    .from("documents")
    .select("title, document_type, issue_date, expiration_date, processing_status")
    .eq("family_id", context.familyId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(30);

  assertQuery(query.error, "documentos");
  const items = ((query.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    title: redactSensitiveText(row.title),
    type: redactSensitiveText(row.document_type, 80),
    issueDate: row.issue_date,
    expirationDate: row.expiration_date,
    processingStatus: redactSensitiveText(row.processing_status, 80),
  }));
  return result(context, { count: items.length, items });
}

export async function listFinancialAccounts(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const query = await context.supabase
    .from("accounts")
    .select("institution, account_type, currency, opening_balance, opening_balance_date, metadata")
    .eq("family_id", context.familyId)
    .is("deleted_at", null)
    .order("institution", { ascending: true })
    .limit(30);

  assertQuery(query.error, "contas financeiras");
  const items = ((query.data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const metadata =
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    return {
      institution: redactSensitiveText(row.institution, 120),
      accountType: redactSensitiveText(row.account_type, 80),
      currency: redactSensitiveText(row.currency, 8) || "BRL",
      balance: finiteNumber(row.opening_balance),
      balanceBasis: "saldo_inicial; consulte o resumo financeiro para o saldo atual pelo razao",
      balanceUpdatedAt: row.opening_balance_date ?? null,
      legacySnapshot: metadata.legacy_balance_snapshot ?? null,
      openingBalance: finiteNumber(row.opening_balance),
      openingBalanceDate: row.opening_balance_date ?? null,
    };
  });
  return result(context, { count: items.length, items });
}

export async function getFinancialSummary(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const overview = await getFinancialOverview(context);
  if (!overview.available || !overview.data || typeof overview.data !== "object") return overview;
  const liquidity = (overview.data as { liquidity?: Record<string, unknown> }).liquidity ?? {};
  return result(context, {
    totalKnownBalance: liquidity.availableBalance ?? null,
    totalKnownBalanceBRL: liquidity.availableBalance ?? null,
    balanceBasis: "saldo_inicial_mais_razao_realizado",
    openingBalance: liquidity.openingBalance ?? null,
    realizedCashIn: liquidity.realizedCashIn ?? null,
    realizedCashOut: liquidity.realizedCashOut ?? null,
    asOfCompetence: liquidity.asOfCompetence ?? null,
    asOfDate: liquidity.asOfDate ?? null,
    warnings: (overview.data as { warnings?: string[] }).warnings ?? [],
  });
}

export async function getFinancialOverview(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const competence = competenceFromDate(context.now);
  const today = toDateOnly(context.now);
  const accountsQuery = await context.supabase
    .from("accounts")
    .select("*")
    .eq("family_id", context.familyId)
    .is("deleted_at", null)
    .order("institution", { ascending: true })
    .limit(50);
  assertQuery(accountsQuery.error, "contas financeiras executivas");
  const accounts = (accountsQuery.data ?? []) as Account[];
  const trendStart = addCompetenceMonths(competence, -6);
  const openingStart = accounts
    .map((account) => account.opening_balance_date)
    .filter((date): date is string => Boolean(date))
    .map((date) => `${date.slice(0, 7)}-01`)
    .sort()[0];
  const periodStart = openingStart && openingStart < trendStart ? openingStart : trendStart;
  const periodEnd = addCompetenceMonths(competence, 6);
  const [entriesQuery, categoriesQuery] = await Promise.all([
    context.supabase
      .from("financial_entries")
      .select("*")
      .eq("family_id", context.familyId)
      .gte("competence", periodStart)
      .lte("competence", periodEnd)
      .is("deleted_at", null)
      .order("competence", { ascending: true })
      .limit(1000),
    context.supabase
      .from("financial_categories")
      .select("*")
      .eq("family_id", context.familyId)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(300),
  ]);
  assertQuery(entriesQuery.error, "lançamentos financeiros executivos");
  assertQuery(categoriesQuery.error, "categorias financeiras executivas");

  return result(
    context,
    buildFinancialExecutiveOverview({
      entries: (entriesQuery.data ?? []) as FinancialEntryRow[],
      accounts,
      categories: (categoriesQuery.data ?? []) as Category[],
      competence,
      today,
    })
  );
}

export async function getInvestmentSummary(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const [assetsQuery, positionsQuery] = await Promise.all([
    context.supabase
      .from("investment_assets")
      .select("*")
      .eq("family_id", context.familyId)
      .eq("active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(100),
    context.supabase
      .from("investment_positions")
      .select("*")
      .eq("family_id", context.familyId)
      .order("position_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  assertQuery(assetsQuery.error, "investimentos");
  assertQuery(positionsQuery.error, "posições de investimentos");
  const summary = summarizeInvestmentPortfolio(
    (assetsQuery.data ?? []) as InvestmentAsset[],
    (positionsQuery.data ?? []) as InvestmentPosition[]
  );
  return result(context, {
    ...summary,
    items: summary.items.map((item) => ({
      ...item,
      name: redactSensitiveText(item.name, 120),
      institution: redactSensitiveText(item.institution, 120),
      assetType: redactSensitiveText(item.assetType, 80),
    })),
  });
}

export async function getRentAdjustmentAlerts(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const [leasesQuery, propertiesQuery] = await Promise.all([
    context.supabase
      .from("lease_contracts")
      .select("*")
      .eq("family_id", context.familyId)
      .is("deleted_at", null)
      .order("next_adjustment_date", { ascending: true, nullsFirst: false })
      .limit(100),
    context.supabase
      .from("properties")
      .select("id,title")
      .eq("family_id", context.familyId)
      .is("deleted_at", null)
      .order("title", { ascending: true })
      .limit(100),
  ]);
  assertQuery(leasesQuery.error, "contratos de locação");
  assertQuery(propertiesQuery.error, "imóveis dos contratos");
  const propertyNames = new Map(
    ((propertiesQuery.data ?? []) as Array<{ id: string; title: string }>).map((property) => [
      property.id,
      redactSensitiveText(property.title, 120) ?? "Imóvel sem título",
    ])
  );
  return result(
    context,
    summarizeRentAdjustments(
      (leasesQuery.data ?? []) as LeaseContract[],
      propertyNames,
      toDateOnly(context.now)
    )
  );
}

export async function getNetWorthSummary(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const [properties, finances, investments] = await Promise.all([
    loadPropertyPortfolio(context),
    getFinancialOverview(context),
    getInvestmentSummary(context),
  ]);
  const propertySummary = summarizePropertyPortfolio(properties);
  const financeData = finances.data as { liquidity?: { availableBalance?: number } } | undefined;
  const investmentData = investments.data as {
    totalMarketValueBRL?: number | null;
    warnings?: string[];
  } | undefined;
  const availableBalance = financeData?.liquidity?.availableBalance ?? null;
  const investmentValue = investmentData?.totalMarketValueBRL ?? null;
  const propertyEquity = propertySummary.totalNetFamilyEquity;
  const knownComponents = [availableBalance, investmentValue, propertyEquity].filter(
    (value): value is number => value !== null
  );
  const warnings = [
    ...propertySummary.warnings,
    ...(investmentData?.warnings ?? []),
  ];
  if (knownComponents.length < 3) {
    warnings.push("O patrimônio consolidado é parcial porque uma ou mais classes não possuem valor conhecido.");
  }

  return result(context, {
    currency: "BRL",
    availableBalance,
    investmentMarketValue: investmentValue,
    netFamilyPropertyEquity: propertyEquity,
    totalKnownNetWorth: knownComponents.length
      ? Number(knownComponents.reduce((sum, value) => sum + value, 0).toFixed(2))
      : null,
    warnings,
  });
}

export async function getDailyIntegratedSnapshot(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const [finances, investments, rents, properties] = await Promise.all([
    getFinancialOverview(context),
    getInvestmentSummary(context),
    getRentAdjustmentAlerts(context),
    loadPropertyPortfolio(context),
  ]);
  const financeData = finances.data as {
    current?: {
      expectedIncome?: number;
      expectedExpense?: number;
      effectiveIncome?: number;
      effectiveExpense?: number;
      effectiveResult?: number;
    };
    liquidity?: {
      realizedCashIn?: number;
      realizedCashOut?: number;
      realizedMonthResult?: number;
      availableBalance?: number;
      pendingIncomeThisMonth?: number;
      pendingExpenseThisMonth?: number;
      provisionedMonthEndBalance?: number;
      statedBalancesByCurrency?: Array<{ currency: string; balance: number }>;
      asOfCompetence?: string;
      asOfDate?: string;
    };
    warnings?: string[];
  } | undefined;
  const investmentData = investments.data as {
    totalMarketValueBRL?: number | null;
    totalsByCurrency?: Array<{
      currency: string;
      assetCount: number;
      marketValue: number | null;
      costAmount: number | null;
      gainAmount: number | null;
    }>;
    warnings?: string[];
  } | undefined;
  const rentData = rents.data as {
    activeContractCount?: number;
    vacantContractCount?: number;
    contractedMonthlyRent?: number;
    vacancyMonthlyPotential?: number;
    averageVacantRent?: number | null;
    potentialGrossRent?: number;
    estimatedVacancyRatePercent?: number | null;
    missingAdjustmentDateCount?: number;
    warnings?: string[];
  } | undefined;
  const propertyData = summarizePropertyPortfolio(properties);
  const availableBalance = financeData?.liquidity?.availableBalance ?? null;
  const investmentValueBRL = investmentData?.totalMarketValueBRL ?? null;
  const propertyEquityBRL = propertyData.totalNetFamilyEquity;
  const brlComponents = [availableBalance, investmentValueBRL, propertyEquityBRL].filter(
    (value): value is number => value !== null
  );
  const warnings = Array.from(
    new Set([
      ...(financeData?.warnings ?? []),
      ...(investmentData?.warnings ?? []),
      ...(rentData?.warnings ?? []),
      ...propertyData.warnings,
      "Imóvel com aluguel mensal positivo é classificado como locação; sem aluguel positivo, como moradia.",
      "Vacância só é reconhecida quando o contrato está marcado como vago; moradia não é tratada como vacância.",
    ])
  );
  if (brlComponents.length < 3) {
    warnings.push("O patrimônio consolidado em reais é parcial por falta de um ou mais componentes.");
  }

  return result(context, {
    snapshot: "rx_financeiro_patrimonial_do_dia",
    asOfDate: financeData?.liquidity?.asOfDate ?? toDateOnly(context.now),
    competence: financeData?.liquidity?.asOfCompetence ?? competenceFromDate(context.now),
    cashFlowBRL: {
      entered: financeData?.liquidity?.realizedCashIn ?? null,
      left: financeData?.liquidity?.realizedCashOut ?? null,
      realizedResult: financeData?.liquidity?.realizedMonthResult ?? null,
      effectiveIncome: financeData?.current?.effectiveIncome ?? null,
      effectiveExpense: financeData?.current?.effectiveExpense ?? null,
      effectiveResult: financeData?.current?.effectiveResult ?? null,
      expectedIncome: financeData?.current?.expectedIncome ?? null,
      expectedExpense: financeData?.current?.expectedExpense ?? null,
      availableBalance: financeData?.liquidity?.availableBalance ?? null,
      pendingIncome: financeData?.liquidity?.pendingIncomeThisMonth ?? null,
      pendingExpense: financeData?.liquidity?.pendingExpenseThisMonth ?? null,
      provisionedMonthEndBalance:
        financeData?.liquidity?.provisionedMonthEndBalance ?? null,
    },
    accountBalancesByCurrency: financeData?.liquidity?.statedBalancesByCurrency ?? [],
    investmentsByCurrency: investmentData?.totalsByCurrency ?? [],
    knownNetWorthBRL: {
      availableBalance,
      investmentMarketValue: investmentValueBRL,
      netFamilyPropertyEquity: propertyEquityBRL,
      total: brlComponents.length
        ? Number(brlComponents.reduce((sum, value) => sum + value, 0).toFixed(2))
        : null,
    },
    properties: {
      propertyCount: propertyData.propertyCount,
      rentalPropertyCount: propertyData.rentalPropertyCount,
      residencePropertyCount: propertyData.residencePropertyCount,
      grossEstimatedValue: propertyData.totalGrossEstimatedValue,
      familyProportionalValue: propertyData.totalFamilyProportionalValue,
      netFamilyEquity: propertyData.totalNetFamilyEquity,
      estimatedMonthlyRent: propertyData.totalEstimatedMonthlyRent,
    },
    rentAndVacancy: {
      activeContractCount: rentData?.activeContractCount ?? 0,
      vacantContractCount: rentData?.vacantContractCount ?? 0,
      contractedMonthlyRent: rentData?.contractedMonthlyRent ?? 0,
      vacancyMonthlyPotential: rentData?.vacancyMonthlyPotential ?? 0,
      averageVacantRent: rentData?.averageVacantRent ?? null,
      potentialGrossRent: rentData?.potentialGrossRent ?? 0,
      estimatedVacancyRatePercent: rentData?.estimatedVacancyRatePercent ?? null,
      missingAdjustmentDateCount: rentData?.missingAdjustmentDateCount ?? 0,
    },
    warnings,
  });
}

export async function listHealthRecords(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const query = await context.supabase
    .from("health_exams")
    .select("exam_name, category, due_date, status")
    .eq("family_id", context.familyId)
    .is("deleted_at", null)
    .order("due_date", { ascending: false, nullsFirst: false })
    .limit(30);

  if (isMissingRelation(query.error)) {
    return unavailable(context, "O módulo de exames ainda não está disponível no banco deste ambiente.");
  }
  assertQuery(query.error, "exames");
  const items = ((query.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    exam: redactSensitiveText(row.exam_name),
    category: redactSensitiveText(row.category, 80),
    dueDate: row.due_date,
    status: redactSensitiveText(row.status, 80),
  }));
  return result(context, { count: items.length, items });
}

export async function getPendingItems(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const [tasks, documents, exams, cases] = await Promise.all([
    listOpenTasks(context),
    listExpiringDocuments(context),
    listDueExams(context),
    listActiveCases(context),
  ]);
  return result(context, {
    tasks,
    documents,
    exams,
    legalCases: cases,
  });
}

export async function listOpenTasks(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const canonical = await context.supabase
    .from("family_tasks")
    .select("title, category, priority, status, due_date")
    .eq("family_id", context.familyId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(30);

  if (!canonical.error) {
    const rows = (canonical.data ?? []) as Array<Record<string, unknown>>;
    const data = rows
      .filter((row) => row.status !== "Concluida" && row.status !== "Cancelada")
      .slice(0, 15)
      .map((row) => ({
        title: redactSensitiveText(row.title),
        category: redactSensitiveText(row.category, 80),
        priority: row.priority,
        status: row.status,
        dueDate: row.due_date,
      }));

    return result(context, { source: "family_tasks", count: data.length, items: data });
  }

  if (!isMissingRelation(canonical.error)) {
    assertQuery(canonical.error, "tarefas");
  }

  const fallback = await context.supabase
    .from("tasks")
    .select("title, priority, status, due_date")
    .eq("family_id", context.familyId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(30);

  assertQuery(fallback.error, "tarefas");
  const rows = (fallback.data ?? []) as Array<Record<string, unknown>>;
  const data = rows
    .filter((row) => row.status !== "completed" && row.status !== "cancelled")
    .slice(0, 15)
    .map((row) => ({
      title: redactSensitiveText(row.title),
      priority: row.priority,
      status: row.status,
      dueDate: row.due_date,
    }));

  return result(context, { source: "tasks", count: data.length, items: data });
}

export async function listExpiringDocuments(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const lowerBound = new Date(context.now);
  lowerBound.setDate(lowerBound.getDate() - 365);
  const upperBound = new Date(context.now);
  upperBound.setDate(upperBound.getDate() + 90);

  const query = await context.supabase
    .from("documents")
    .select("title, document_type, expiration_date")
    .eq("family_id", context.familyId)
    .eq("status", "active")
    .gte("expiration_date", toDateOnly(lowerBound))
    .lte("expiration_date", toDateOnly(upperBound))
    .order("expiration_date", { ascending: true })
    .limit(20);

  assertQuery(query.error, "documentos");
  const today = toDateOnly(context.now);
  const items = ((query.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    title: redactSensitiveText(row.title),
    type: redactSensitiveText(row.document_type, 80),
    expirationDate: row.expiration_date,
    situation:
      typeof row.expiration_date === "string" && row.expiration_date < today
        ? "expired"
        : "expiring_soon",
  }));

  return result(context, { count: items.length, windowDays: 90, items });
}

export async function listDueExams(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const upperBound = new Date(context.now);
  upperBound.setDate(upperBound.getDate() + 30);

  const query = await context.supabase
    .from("health_exams")
    .select("exam_name, category, due_date, status")
    .eq("family_id", context.familyId)
    .lte("due_date", toDateOnly(upperBound))
    .order("due_date", { ascending: true })
    .limit(20);

  if (isMissingRelation(query.error)) {
    return unavailable(context, "O módulo de exames ainda não está disponível no banco deste ambiente.");
  }

  assertQuery(query.error, "exames");
  const items = ((query.data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => row.status !== "Realizado" && row.status !== "Resultado recebido")
    .map((row) => ({
      exam: redactSensitiveText(row.exam_name),
      category: redactSensitiveText(row.category, 80),
      dueDate: row.due_date,
      status: row.status,
    }));

  return result(context, { count: items.length, windowDays: 30, items });
}

export async function listActiveCases(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const query = await context.supabase
    .from("legal_cases")
    .select("title, case_type, status, last_update_date")
    .eq("family_id", context.familyId)
    .order("last_update_date", { ascending: false, nullsFirst: false })
    .limit(20);

  if (isMissingRelation(query.error)) {
    return unavailable(context, "O módulo de processos ainda não está disponível no banco deste ambiente.");
  }

  assertQuery(query.error, "processos");
  const items = ((query.data ?? []) as Array<Record<string, unknown>>)
    .filter((row) => row.status !== "Concluido" && row.status !== "Arquivado")
    .map((row) => ({
      title: redactSensitiveText(row.title),
      type: redactSensitiveText(row.case_type, 80),
      status: row.status,
      lastUpdateDate: row.last_update_date,
    }));

  return result(context, { count: items.length, items });
}

export async function getRecentTimeline(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const query = await context.supabase
    .from("events")
    .select("event_type, affected_entity_type, priority, occurred_at")
    .eq("family_id", context.familyId)
    .order("occurred_at", { ascending: false })
    .limit(12);

  assertQuery(query.error, "timeline");
  const items = ((query.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    eventType: redactSensitiveText(row.event_type, 100),
    entityType: redactSensitiveText(row.affected_entity_type, 80),
    priority: row.priority,
    occurredAt: row.occurred_at,
  }));

  return result(context, { count: items.length, items });
}

export async function listNextCalendarEvents(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const upcoming = await getGoogleCalendarUpcomingEvents(8);

  if (upcoming.error) {
    return unavailable(context, upcoming.error);
  }

  const items = upcoming.events.map((event) => ({
    summary: redactSensitiveText(event.summary),
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    calendar: redactSensitiveText(event.calendarSummary, 80),
  }));

  return result(context, { count: items.length, items });
}

async function countFamilyRows(context: ExecutiveToolContext, table: string) {
  const query = await context.supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("family_id", context.familyId);

  if (isMissingRelation(query.error)) return null;
  assertQuery(query.error, table);
  return query.count ?? 0;
}

export async function getDashboard(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const [people, properties, documents, alerts, tasks, expiring, exams, cases, finances] =
    await Promise.all([
      countFamilyRows(context, "people"),
      countFamilyRows(context, "properties"),
      countFamilyRows(context, "documents"),
      countFamilyRows(context, "alerts"),
      listOpenTasks(context),
      listExpiringDocuments(context),
      listDueExams(context),
      listActiveCases(context),
      getFinancialOverview(context),
    ]);

  const countFrom = (toolResult: ExecutiveToolResult) => {
    if (!toolResult.available || !toolResult.data || typeof toolResult.data !== "object") return null;
    const count = (toolResult.data as { count?: unknown }).count;
    return typeof count === "number" ? count : null;
  };

  return result(context, {
    totals: {
      people,
      properties,
      documents,
      alerts,
      openTasks: countFrom(tasks),
      expiringOrExpiredDocuments: countFrom(expiring),
      dueExams: countFrom(exams),
      activeCases: countFrom(cases),
    },
    moduleAvailability: {
      tasks: tasks.available,
      documents: expiring.available,
      exams: exams.available,
      cases: cases.available,
      finances: finances.available,
    },
    financialSnapshot: finances.available ? finances.data : null,
  });
}

export const getDocumentExpirations = listExpiringDocuments;
export const getHealthAlerts = listDueExams;
export const listCalendarEvents = listNextCalendarEvents;
export const listTasks = listOpenTasks;
export const listLegalProcesses = listActiveCases;
export const getFamilyTimeline = getRecentTimeline;
