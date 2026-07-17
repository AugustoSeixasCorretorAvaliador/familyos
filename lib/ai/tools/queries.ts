import type { PostgrestError } from "@supabase/supabase-js";
import { getGoogleCalendarUpcomingEvents } from "@/lib/calendar/status";
import { redactSensitiveText, toDateOnly } from "@/lib/ai/tools/privacy";
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
