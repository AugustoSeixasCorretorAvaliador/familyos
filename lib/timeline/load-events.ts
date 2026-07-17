import { normalizeDisplayName } from "@/lib/identity/display-name";
import { createClient } from "@/lib/supabase/server";
import {
  humanizeTimelineEvent,
  type TimelinePresentation,
} from "@/lib/timeline/presentation";

type RawEvent = {
  id: string;
  event_type: string;
  affected_entity_type: string;
  affected_entity_id: string | null;
  related_person_id: string | null;
  responsible_person_id: string | null;
  created_by: string | null;
  previous_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  priority: string;
  occurred_at: string;
};

type EntityReference = {
  name: string;
  href: string;
};

export type TimelineEntry = TimelinePresentation & {
  id: string;
  priority: string;
  occurredAt: string;
};

function uniqueIds(events: RawEvent[], entityType: string) {
  return Array.from(
    new Set(
      events
        .filter((event) => event.affected_entity_type === entityType)
        .map((event) => event.affected_entity_id)
        .filter((id): id is string => Boolean(id))
    )
  );
}

function fullName(firstName: string | null, lastName: string | null) {
  return normalizeDisplayName(`${firstName ?? ""} ${lastName ?? ""}`);
}

export async function loadTimelineEntries(input: {
  familyId: string;
  limit: number;
}): Promise<TimelineEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, event_type, affected_entity_type, affected_entity_id, related_person_id, responsible_person_id, created_by, previous_state, new_state, priority, occurred_at"
    )
    .eq("family_id", input.familyId)
    .order("occurred_at", { ascending: false })
    .limit(input.limit);

  if (error) {
    console.error(
      "[familyos_timeline_read_error]",
      JSON.stringify({ family_id: input.familyId, error_code: error.code })
    );
    return [];
  }

  const events = (data ?? []) as RawEvent[];
  if (events.length === 0) return [];

  const propertyIds = uniqueIds(events, "properties");
  const documentIds = uniqueIds(events, "documents");
  const taskIds = uniqueIds(events, "family_tasks");
  const legalCaseIds = uniqueIds(events, "legal_cases");
  const medicationIds = uniqueIds(events, "medications");
  const doctorIds = uniqueIds(events, "doctors");
  const examIds = uniqueIds(events, "health_exams");
  const accountIds = uniqueIds(events, "accounts");

  const emptyResult = Promise.resolve({ data: [], error: null });
  const [
    membersResult,
    peopleResult,
    propertiesResult,
    documentsResult,
    tasksResult,
    legalCasesResult,
    medicationsResult,
    doctorsResult,
    examsResult,
    accountsResult,
  ] = await Promise.all([
    supabase
      .from("family_members")
      .select("id, user_id, person_id")
      .eq("family_id", input.familyId)
      .eq("status", "active"),
    supabase
      .from("people")
      .select("id, first_name, last_name")
      .eq("family_id", input.familyId)
      .is("deleted_at", null),
    propertyIds.length
      ? supabase
          .from("properties")
          .select("id, title")
          .eq("family_id", input.familyId)
          .is("deleted_at", null)
          .in("id", propertyIds)
      : emptyResult,
    documentIds.length
      ? supabase
          .from("documents")
          .select("id, title, document_type")
          .eq("family_id", input.familyId)
          .is("deleted_at", null)
          .in("id", documentIds)
      : emptyResult,
    taskIds.length
      ? supabase
          .from("family_tasks")
          .select("id, title")
          .eq("family_id", input.familyId)
          .in("id", taskIds)
      : emptyResult,
    legalCaseIds.length
      ? supabase
          .from("legal_cases")
          .select("id, title")
          .eq("family_id", input.familyId)
          .in("id", legalCaseIds)
      : emptyResult,
    medicationIds.length
      ? supabase
          .from("medications")
          .select("id, medication_name")
          .eq("family_id", input.familyId)
          .in("id", medicationIds)
      : emptyResult,
    doctorIds.length
      ? supabase
          .from("doctors")
          .select("id, doctor_name")
          .eq("family_id", input.familyId)
          .in("id", doctorIds)
      : emptyResult,
    examIds.length
      ? supabase
          .from("health_exams")
          .select("id, exam_name")
          .eq("family_id", input.familyId)
          .in("id", examIds)
      : emptyResult,
    accountIds.length
      ? supabase
          .from("accounts")
          .select("id, institution")
          .eq("family_id", input.familyId)
          .is("deleted_at", null)
          .in("id", accountIds)
      : emptyResult,
  ]);

  const peopleById = new Map<string, string>();
  for (const person of peopleResult.data ?? []) {
    const name = fullName(person.first_name, person.last_name);
    if (name) peopleById.set(person.id, name);
  }

  const peopleByUserId = new Map<string, string>();
  const peopleByMembershipId = new Map<string, string>();
  for (const member of membersResult.data ?? []) {
    if (!member.person_id) continue;
    const name = peopleById.get(member.person_id);
    if (!name) continue;
    peopleByUserId.set(member.user_id, name);
    peopleByMembershipId.set(member.id, name);
  }

  const entityReferences = new Map<string, EntityReference>();
  const addReference = (
    entityType: string,
    id: string,
    name: string | null,
    href: string
  ) => {
    const normalizedName = normalizeDisplayName(name);
    if (normalizedName) {
      entityReferences.set(`${entityType}:${id}`, {
        name: normalizedName,
        href,
      });
    }
  };

  for (const row of propertiesResult.data ?? []) {
    addReference("properties", row.id, row.title, "/imoveis");
  }
  for (const row of documentsResult.data ?? []) {
    addReference(
      "documents",
      row.id,
      row.title || row.document_type,
      `/documentos/${row.id}/revisar`
    );
  }
  for (const row of tasksResult.data ?? []) {
    addReference("family_tasks", row.id, row.title, "/tarefas");
  }
  for (const row of legalCasesResult.data ?? []) {
    addReference("legal_cases", row.id, row.title, "/processos");
  }
  for (const row of medicationsResult.data ?? []) {
    addReference("medications", row.id, row.medication_name, "/saude");
  }
  for (const row of doctorsResult.data ?? []) {
    addReference("doctors", row.id, row.doctor_name, "/saude");
  }
  for (const row of examsResult.data ?? []) {
    addReference("health_exams", row.id, row.exam_name, "/saude");
  }
  for (const row of accountsResult.data ?? []) {
    addReference("accounts", row.id, row.institution, "/financas");
  }
  for (const [personId, name] of Array.from(peopleById.entries())) {
    addReference("people", personId, name, "/pessoas");
  }
  for (const [membershipId, name] of Array.from(
    peopleByMembershipId.entries()
  )) {
    addReference("family_members", membershipId, name, "/pessoas");
  }

  return events.map((event) => {
    const reference = event.affected_entity_id
      ? entityReferences.get(
          `${event.affected_entity_type}:${event.affected_entity_id}`
        )
      : null;
    const relatedPersonName = event.related_person_id
      ? peopleById.get(event.related_person_id)
      : null;
    const actorName =
      (event.responsible_person_id
        ? peopleById.get(event.responsible_person_id)
        : null) ??
      (event.created_by ? peopleByUserId.get(event.created_by) : null) ??
      null;
    const metadata = {
      ...(event.previous_state ?? {}),
      ...(event.new_state ?? {}),
    };
    const presentation = humanizeTimelineEvent({
      eventType: event.event_type,
      entityType: event.affected_entity_type,
      actorName,
      entityName: reference?.name ?? relatedPersonName ?? null,
      entityHref: reference?.href ?? null,
      canViewDetails: Boolean(reference || relatedPersonName),
      metadata,
    });

    return {
      id: event.id,
      priority: event.priority,
      occurredAt: event.occurred_at,
      ...presentation,
    };
  });
}
