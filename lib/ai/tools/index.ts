import type { Tool } from "openai/resources/responses/responses";
import {
  getDashboard,
  getRecentTimeline,
  listActiveCases,
  listDueExams,
  listExpiringDocuments,
  listNextCalendarEvents,
  listOpenTasks,
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
