import type { Tool } from "openai/resources/responses/responses";
import {
  getDocumentExpirations,
  getDashboard,
  getFamilyTimeline,
  getFinancialSummary,
  getFinancialOverview,
  getHealthAlerts,
  getInvestmentSummary,
  getDailyIntegratedSnapshot,
  getNetWorthSummary,
  getPendingItems,
  getPropertyPortfolioSummary,
  getRentAdjustmentAlerts,
  getRecentTimeline,
  listActiveCases,
  listCalendarEvents,
  listDocuments,
  listDueExams,
  listExpiringDocuments,
  listFinancialAccounts,
  listHealthRecords,
  listLegalProcesses,
  listNextCalendarEvents,
  listOpenTasks,
  listPeople,
  listProperties,
  listTasks,
} from "@/lib/ai/tools/queries";
import {
  EXECUTIVE_TOOL_NAMES,
  type ExecutiveToolContext,
  type ExecutiveToolName,
  type ExecutiveToolResult,
} from "@/lib/ai/tools/types";

const noParameters = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
};

function tool(name: ExecutiveToolName, description: string): Tool {
  return {
    type: "function",
    name,
    description,
    strict: true,
    parameters: noParameters,
  };
}

export const executiveToolDefinitions: Tool[] = [
  tool("get_dashboard", "Retorna um resumo compacto dos principais indicadores da família."),
  tool("list_open_tasks", "Lista tarefas abertas, prioridades e vencimentos da família."),
  tool(
    "list_expiring_documents",
    "Lista documentos vencidos recentemente ou com vencimento nos próximos 90 dias, sem números ou arquivos."
  ),
  tool("list_due_exams", "Lista exames pendentes, atrasados ou próximos do vencimento, sem laudos ou notas médicas."),
  tool("list_active_cases", "Lista processos ativos em formato resumido, sem número do processo ou notas sensíveis."),
  tool("get_recent_timeline", "Lista os eventos recentes da timeline sem estados brutos ou anexos."),
  tool("list_next_calendar_events", "Lista os próximos eventos autorizados do Google Calendar, sem links privados."),
  tool("list_people", "Lista os familiares cadastrados, seus papéis e status, sem documentos, contatos ou identificadores."),
  tool("list_properties", "Lista cada imóvel com endereço, proprietários, percentuais, valor integral, valor proporcional, dívida cadastrada, patrimônio líquido, aluguel e avisos de dados ausentes."),
  tool("get_property_portfolio_summary", "Calcula de forma determinística os totais conhecidos da carteira imobiliária e sinaliza quando os totais são parciais."),
  tool("list_documents", "Lista documentos da família com tipo, datas e status de processamento, sem números, arquivos ou caminhos privados."),
  tool("get_document_expirations", "Lista documentos vencidos ou a vencer nos próximos 90 dias."),
  tool("list_financial_accounts", "Lista instituições, tipos de conta e saldos conhecidos, sem agência, conta ou identificadores."),
  tool("get_financial_summary", "Calcula o total conhecido dos saldos e informa contas sem valor cadastrado."),
  tool("get_financial_overview", "Retorna análise determinística do mês atual, comparação mensal, série de 13 meses, liquidez, obrigações e variações de despesas por categoria."),
  tool("get_investment_summary", "Resume as posições mais recentes dos investimentos, valores de mercado, custos e ganhos conhecidos."),
  tool("get_rent_adjustment_alerts", "Lista contratos ativos, reajustes vencidos ou próximos, contratos a vencer e dados de reajuste ausentes."),
  tool("get_net_worth_summary", "Consolida saldo disponível, investimentos e patrimônio imobiliário líquido conhecido, sinalizando totais parciais."),
  tool("get_daily_integrated_snapshot", "Produz o RX financeiro e patrimonial do dia dentro do mês atual: entradas, saídas, sobra realizada e provisionada, contas e investimentos por moeda, patrimônio, locação, moradia e vacância."),
  tool("list_health_records", "Lista exames, categorias, datas e status sem laudos, notas clínicas ou diagnósticos."),
  tool("get_health_alerts", "Lista exames pendentes, atrasados ou próximos do vencimento."),
  tool("list_calendar_events", "Lista os próximos eventos autorizados do Google Calendar, sem links privados."),
  tool("list_tasks", "Lista tarefas abertas com prioridade, status e vencimento."),
  tool("list_legal_processes", "Lista processos ativos de forma resumida, sem números processuais ou notas sensíveis."),
  tool("get_pending_items", "Reúne tarefas, documentos, exames e processos que exigem atenção."),
  tool("get_family_timeline", "Lista eventos recentes da família sem estados brutos, anexos ou identificadores."),
];

const handlers: Record<
  ExecutiveToolName,
  (context: ExecutiveToolContext) => Promise<ExecutiveToolResult>
> = {
  get_dashboard: getDashboard,
  list_open_tasks: listOpenTasks,
  list_expiring_documents: listExpiringDocuments,
  list_due_exams: listDueExams,
  list_active_cases: listActiveCases,
  get_recent_timeline: getRecentTimeline,
  list_next_calendar_events: listNextCalendarEvents,
  list_people: listPeople,
  list_properties: listProperties,
  get_property_portfolio_summary: getPropertyPortfolioSummary,
  list_documents: listDocuments,
  get_document_expirations: getDocumentExpirations,
  list_financial_accounts: listFinancialAccounts,
  get_financial_summary: getFinancialSummary,
  get_financial_overview: getFinancialOverview,
  get_investment_summary: getInvestmentSummary,
  get_rent_adjustment_alerts: getRentAdjustmentAlerts,
  get_net_worth_summary: getNetWorthSummary,
  get_daily_integrated_snapshot: getDailyIntegratedSnapshot,
  list_health_records: listHealthRecords,
  get_health_alerts: getHealthAlerts,
  list_calendar_events: listCalendarEvents,
  list_tasks: listTasks,
  list_legal_processes: listLegalProcesses,
  get_pending_items: getPendingItems,
  get_family_timeline: getFamilyTimeline,
};

export function isExecutiveToolName(value: string): value is ExecutiveToolName {
  return (EXECUTIVE_TOOL_NAMES as readonly string[]).includes(value);
}

export async function executeExecutiveTool(
  name: string,
  context: ExecutiveToolContext
) {
  if (!isExecutiveToolName(name)) {
    return {
      available: false,
      asOf: context.now.toISOString(),
      reason: "Ferramenta desconhecida.",
    } satisfies ExecutiveToolResult;
  }

  try {
    return await handlers[name](context);
  } catch {
    return {
      available: false,
      asOf: context.now.toISOString(),
      reason: "A fonte de dados não pode ser consultada neste momento.",
    } satisfies ExecutiveToolResult;
  }
}

export type { ExecutiveToolContext, ExecutiveToolName } from "@/lib/ai/tools/types";
