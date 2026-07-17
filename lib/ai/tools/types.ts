import type { SupabaseClient } from "@supabase/supabase-js";

export const EXECUTIVE_TOOL_NAMES = [
  "get_dashboard",
  "list_open_tasks",
  "list_expiring_documents",
  "list_due_exams",
  "list_active_cases",
  "get_recent_timeline",
  "list_next_calendar_events",
] as const;

export type ExecutiveToolName = (typeof EXECUTIVE_TOOL_NAMES)[number];

export type ExecutiveToolContext = {
  supabase: SupabaseClient;
  userId: string;
  familyId: string;
  now: Date;
};

export type ExecutiveToolResult = {
  available: boolean;
  asOf: string;
  data?: unknown;
  reason?: string;
};
