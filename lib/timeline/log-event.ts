import { createClient } from "@/lib/supabase/server";

type LogTimelineEventInput = {
  familyId: string;
  eventType: string;
  affectedEntityType: string;
  affectedEntityId?: string | null;
  responsiblePersonId?: string | null;
  priority?: "low" | "medium" | "high" | "critical";
  source?: string;
  newState?: Record<string, unknown> | null;
  previousState?: Record<string, unknown> | null;
};

export async function logTimelineEvent(input: LogTimelineEventInput) {
  try {
    const supabase = createClient();
    const { error } = await supabase.from("events").insert({
      family_id: input.familyId,
      event_type: input.eventType,
      source: input.source ?? "app",
      affected_entity_type: input.affectedEntityType,
      affected_entity_id: input.affectedEntityId ?? null,
      responsible_person_id: input.responsiblePersonId ?? null,
      priority: input.priority ?? "medium",
      automation_status: "partially_automated",
      new_state: input.newState ?? null,
      previous_state: input.previousState ?? null,
      occurred_at: new Date().toISOString(),
    });
    if (error) throw error;
  } catch (error) {
    // Timeline logging should not block primary CRUD actions.
    console.error(
      "[familyos_timeline_error]",
      JSON.stringify({
        family_id: input.familyId,
        event_type: input.eventType,
        affected_entity_type: input.affectedEntityType,
        affected_entity_id: input.affectedEntityId ?? null,
        error_message: error instanceof Error ? error.message : String(error),
      })
    );
  }
}
