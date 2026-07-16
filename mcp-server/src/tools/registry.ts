import { z } from "zod";
import type { AuthContext } from "../models/context";
import { DashboardService } from "../services/dashboard.service";
import { PeopleService } from "../services/people.service";
import { DocumentsService } from "../services/documents.service";
import { HealthService } from "../services/health.service";
import { PropertyService } from "../services/property.service";
import { FinanceService } from "../services/finance.service";
import { AgendaService } from "../services/agenda.service";
import { TimelineService } from "../services/timeline.service";
import { AlertsService } from "../services/alerts.service";
import { TaskService } from "../services/task.service";
import { LegalService } from "../services/legal.service";
import { KnowledgeGraphService } from "../services/knowledge-graph.service";
import { FamilyService } from "../services/family.service";
import { ExecutiveAIService } from "../services/executive-ai.service";
import {
  CompleteTaskSchema,
  AuditListSchema,
  CalendarDeleteSchema,
  CalendarEventSchema,
  CalendarListSchema,
  CalendarUpdateSchema,
  ConfirmDocumentSchema,
  CreateCaseSchema,
  CreateExamSchema,
  CreateFinancialEntrySchema,
  CreatePersonSchema,
  CreatePropertySchema,
  CreateTaskSchema,
  DaysSchema,
  IdSchema,
  OCRJobSchema,
  MarkAlertReadSchema,
  PaginationSchema,
  ProcessDocumentSchema,
  RejectDocumentSchema,
  TimelineCreateSchema,
  UpdateExamSchema,
  UpdatePersonSchema,
  UpdatePropertySchema,
  UploadDocumentSchema,
} from "./schemas";
import { AuditService } from "../services/audit-service";

export type ToolDefinition<TSchema extends z.AnyZodObject = z.AnyZodObject> = {
  name: string;
  description: string;
  schema: TSchema;
  run: (auth: AuthContext, input: z.infer<TSchema>) => Promise<unknown>;
};

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "get_dashboard",
    description: "Resumo executivo dos modulos da familia",
    schema: z.object({}),
    run: async (auth) => new DashboardService(auth).getDashboard(),
  },
  {
    name: "list_people",
    description: "Lista pessoas da familia",
    schema: z.object({}),
    run: async (auth) => new PeopleService(auth).listPeople(),
  },
  {
    name: "get_person",
    description: "Detalhes de pessoa",
    schema: IdSchema,
    run: async (auth, input) => new PeopleService(auth).getPerson(input.id),
  },
  {
    name: "create_person",
    description: "Cria pessoa",
    schema: CreatePersonSchema,
    run: async (auth, input) => new PeopleService(auth).createPerson(input),
  },
  {
    name: "update_person",
    description: "Atualiza pessoa",
    schema: UpdatePersonSchema,
    run: async (auth, input) => new PeopleService(auth).updatePerson(input.id, input.input),
  },
  {
    name: "delete_person",
    description: "Remove pessoa (soft delete)",
    schema: IdSchema,
    run: async (auth, input) => new PeopleService(auth).deletePerson(input.id),
  },
  {
    name: "list_documents",
    description: "Lista documentos",
    schema: z.object({}),
    run: async (auth) => new DocumentsService(auth).listDocuments(),
  },
  {
    name: "get_document",
    description: "Detalhes do documento",
    schema: IdSchema,
    run: async (auth, input) => new DocumentsService(auth).getDocument(input.id),
  },
  {
    name: "list_expiring_documents",
    description: "Documentos que vencem em N dias",
    schema: DaysSchema,
    run: async (auth, input) => new DocumentsService(auth).listExpiringDocuments(input.days),
  },
  {
    name: "upload_document",
    description: "Upload de documento em bucket privado family-documents",
    schema: UploadDocumentSchema,
    run: async (auth, input) => new DocumentsService(auth).uploadDocument(input as z.infer<typeof UploadDocumentSchema>),
  },
  {
    name: "process_document",
    description: "Processamento OCR/IA de documento",
    schema: ProcessDocumentSchema,
    run: async (auth, input) => new DocumentsService(auth).processDocument(input as z.infer<typeof ProcessDocumentSchema>),
  },
  {
    name: "reprocess_document",
    description: "Reprocessamento OCR/IA de documento",
    schema: ProcessDocumentSchema,
    run: async (auth, input) => new DocumentsService(auth).processDocument({ ...(input as z.infer<typeof ProcessDocumentSchema>), reprocess: true }),
  },
  {
    name: "get_ocr_job",
    description: "Consulta status de job OCR",
    schema: OCRJobSchema,
    run: async (auth, input) => new DocumentsService(auth).getOcrJob(input.jobId),
  },
  {
    name: "confirm_document",
    description: "Confirmacao humana de documento",
    schema: ConfirmDocumentSchema,
    run: async (auth, input) => new DocumentsService(auth).confirmDocument(input as z.infer<typeof ConfirmDocumentSchema>),
  },
  {
    name: "reject_document",
    description: "Rejeicao humana de documento",
    schema: RejectDocumentSchema,
    run: async (auth, input) => new DocumentsService(auth).rejectDocument(input as z.infer<typeof RejectDocumentSchema>),
  },
  {
    name: "list_audit_logs",
    description: "Lista auditoria MCP da familia",
    schema: AuditListSchema,
    run: async (auth, input) => new AuditService().listAuditLogs(auth, input),
  },
  {
    name: "get_audit_log",
    description: "Detalhe de auditoria MCP",
    schema: IdSchema,
    run: async (auth, input) => new AuditService().getAuditLog(auth, input.id),
  },
  {
    name: "list_doctors",
    description: "Lista medicos",
    schema: z.object({}),
    run: async (auth) => new HealthService(auth).listDoctors(),
  },
  {
    name: "list_medications",
    description: "Lista medicamentos",
    schema: z.object({}),
    run: async (auth) => new HealthService(auth).listMedications(),
  },
  {
    name: "list_health_exams",
    description: "Lista exames",
    schema: z.object({}),
    run: async (auth) => new HealthService(auth).listHealthExams(),
  },
  {
    name: "list_due_exams",
    description: "Lista exames vencidos/a vencer",
    schema: z.object({}),
    run: async (auth) => new HealthService(auth).listDueExams(),
  },
  {
    name: "create_exam",
    description: "Cria exame",
    schema: CreateExamSchema,
    run: async (auth, input) => new HealthService(auth).createExam(input.input),
  },
  {
    name: "update_exam",
    description: "Atualiza exame",
    schema: UpdateExamSchema,
    run: async (auth, input) => new HealthService(auth).updateExam(input.id, input.input),
  },
  {
    name: "list_properties",
    description: "Lista patrimonio",
    schema: z.object({}),
    run: async (auth) => new PropertyService(auth).listProperties(),
  },
  {
    name: "get_property",
    description: "Detalhes do bem",
    schema: IdSchema,
    run: async (auth, input) => new PropertyService(auth).getProperty(input.id),
  },
  {
    name: "create_property",
    description: "Cria bem",
    schema: CreatePropertySchema,
    run: async (auth, input) => new PropertyService(auth).createProperty(input.input),
  },
  {
    name: "update_property",
    description: "Atualiza bem",
    schema: UpdatePropertySchema,
    run: async (auth, input) => new PropertyService(auth).updateProperty(input.id, input.input),
  },
  {
    name: "list_accounts",
    description: "Lista contas financeiras",
    schema: z.object({}),
    run: async (auth) => new FinanceService(auth).listAccounts(),
  },
  {
    name: "list_financial_entries",
    description: "Lista lancamentos financeiros",
    schema: PaginationSchema,
    run: async (auth, input) => new FinanceService(auth).listFinancialEntries(input.limit),
  },
  {
    name: "list_open_debts",
    description: "Lista dividas em aberto",
    schema: z.object({}),
    run: async (auth) => new FinanceService(auth).listOpenDebts(),
  },
  {
    name: "create_financial_entry",
    description: "Cria lancamento financeiro",
    schema: CreateFinancialEntrySchema,
    run: async (auth, input) => new FinanceService(auth).createFinancialEntry(input.input),
  },
  {
    name: "list_events",
    description: "Lista eventos da agenda interna",
    schema: PaginationSchema,
    run: async (auth, input) => new AgendaService(auth).listEvents(input.limit),
  },
  {
    name: "calendar_status",
    description: "Status da integracao Google Calendar",
    schema: z.object({}),
    run: async (auth) => new AgendaService(auth).calendarStatus(),
  },
  {
    name: "list_google_upcoming_events",
    description: "Proximos eventos do Google Calendar",
    schema: CalendarListSchema,
    run: async (auth, input) => new AgendaService(auth).listGoogleUpcomingEvents(input),
  },
  {
    name: "list_next_events",
    description: "Proximos eventos do Google Calendar",
    schema: CalendarListSchema,
    run: async (auth, input) => new AgendaService(auth).listGoogleUpcomingEvents(input),
  },
  {
    name: "create_calendar_event",
    description: "Cria evento no Google Calendar",
    schema: CalendarEventSchema,
    run: async (auth, input) => new AgendaService(auth).createCalendarEvent(input as z.infer<typeof CalendarEventSchema>),
  },
  {
    name: "update_calendar_event",
    description: "Atualiza evento no Google Calendar",
    schema: CalendarUpdateSchema,
    run: async (auth, input) => new AgendaService(auth).updateCalendarEvent(input as z.infer<typeof CalendarUpdateSchema>),
  },
  {
    name: "delete_calendar_event",
    description: "Exclui evento no Google Calendar",
    schema: CalendarDeleteSchema,
    run: async (auth, input) => new AgendaService(auth).deleteCalendarEvent(input as z.infer<typeof CalendarDeleteSchema>),
  },
  {
    name: "list_timeline",
    description: "Lista timeline",
    schema: PaginationSchema,
    run: async (auth, input) => new TimelineService(auth).listTimeline(input.limit),
  },
  {
    name: "create_timeline_event",
    description: "Cria evento na timeline",
    schema: TimelineCreateSchema,
    run: async (auth, input) => new TimelineService(auth).createTimelineEvent(input.input),
  },
  {
    name: "list_alerts",
    description: "Lista alertas",
    schema: PaginationSchema,
    run: async (auth, input) => new AlertsService(auth).listAlerts(input.limit),
  },
  {
    name: "mark_alert_as_read",
    description: "Marca alerta como lido",
    schema: MarkAlertReadSchema,
    run: async (auth, input) => new AlertsService(auth).markAlertAsRead(input.id),
  },
  {
    name: "list_tasks",
    description: "Lista tarefas",
    schema: z.object({}),
    run: async (auth) => new TaskService(auth).listTasks(),
  },
  {
    name: "create_task",
    description: "Cria tarefa",
    schema: CreateTaskSchema,
    run: async (auth, input) => new TaskService(auth).createTask(input),
  },
  {
    name: "complete_task",
    description: "Conclui tarefa",
    schema: CompleteTaskSchema,
    run: async (auth, input) => new TaskService(auth).completeTask(input.id),
  },
  {
    name: "list_cases",
    description: "Lista processos juridicos",
    schema: z.object({}),
    run: async (auth) => new LegalService(auth).listCases(),
  },
  {
    name: "create_case",
    description: "Cria processo juridico",
    schema: CreateCaseSchema,
    run: async (auth, input) => new LegalService(auth).createCase(input.input),
  },
  {
    name: "add_case_document",
    description: "Anexa documento ao processo (stub)",
    schema: z.object({}),
    run: async (auth) => new LegalService(auth).addCaseDocument(),
  },
  {
    name: "build_knowledge_graph",
    description: "Monta grafo de conhecimento familiar",
    schema: z.object({}),
    run: async (auth) => new KnowledgeGraphService(auth).buildKnowledgeGraph(),
  },
  {
    name: "get_family_context",
    description: "Contexto completo da familia e membros",
    schema: z.object({}),
    run: async (auth) => new FamilyService(auth).getFamilyContext(),
  },
  {
    name: "get_executive_summary",
    description: "Resumo executivo por IA",
    schema: z.object({}),
    run: async (auth) => new ExecutiveAIService(auth).summary(),
  },
  {
    name: "get_ai_recommendations",
    description: "Recomendacoes executivas por IA",
    schema: z.object({}),
    run: async (auth) => new ExecutiveAIService(auth).recommendations(),
  },
];
