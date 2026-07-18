import type { PostgrestError } from "@supabase/supabase-js";
import { getGoogleCalendarUpcomingEvents } from "@/lib/calendar/status";
import { redactSensitiveText, toDateOnly } from "@/lib/ai/tools/privacy";
import {
  buildPropertyExecutiveRecord,
  summarizePropertyPortfolio,
  type PropertyExecutiveRecord,
} from "@/lib/ai/tools/properties";
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
      "id, title, address, city, state, metadata, property_owners(person_id, ownership_percentage, people(first_name, last_name))"
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
    .select("institution, account_type, metadata")
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
      currency: "BRL",
      balance: finiteNumber(metadata.saldo_atual),
      balanceUpdatedAt: metadata.data_atualizacao ?? null,
    };
  });
  return result(context, { count: items.length, items });
}

export async function getFinancialSummary(
  context: ExecutiveToolContext
): Promise<ExecutiveToolResult> {
  const accounts = await listFinancialAccounts(context);
  if (!accounts.available || !accounts.data || typeof accounts.data !== "object") {
    return accounts;
  }
  const items = (accounts.data as { items?: Array<{ balance: number | null }> }).items ?? [];
  const known = items
    .map((item) => item.balance)
    .filter((value): value is number => value !== null);
  const withoutBalance = items.length - known.length;
  return result(context, {
    accountCount: items.length,
    accountsWithBalance: known.length,
    accountsWithoutBalance: withoutBalance,
    totalKnownBalance:
      known.length > 0
        ? Number(known.reduce((sum, value) => sum + value, 0).toFixed(2))
        : null,
    currency: "BRL",
    warnings:
      withoutBalance > 0
        ? [`${withoutBalance} conta(s) sem saldo informado; o total é parcial.`]
        : [],
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
  const [people, properties, documents, alerts, tasks, expiring, exams, cases] =
    await Promise.all([
      countFamilyRows(context, "people"),
      countFamilyRows(context, "properties"),
      countFamilyRows(context, "documents"),
      countFamilyRows(context, "alerts"),
      listOpenTasks(context),
      listExpiringDocuments(context),
      listDueExams(context),
      listActiveCases(context),
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
    },
  });
}

export const getDocumentExpirations = listExpiringDocuments;
export const getHealthAlerts = listDueExams;
export const listCalendarEvents = listNextCalendarEvents;
export const listTasks = listOpenTasks;
export const listLegalProcesses = listActiveCases;
export const getFamilyTimeline = getRecentTimeline;
