import type { SupabaseClient } from "@supabase/supabase-js";

export const EXECUTIVE_TOOL_NAMES = [
  "get_dashboard",
  "list_open_tasks",
  "list_expiring_documents",
  "list_due_exams",
  "list_active_cases",
  "get_recent_timeline",
  "list_next_calendar_events",
  "list_people",
  "list_properties",
  "get_property_portfolio_summary",
  "list_documents",
  "get_document_expirations",
  "list_financial_accounts",
  "get_financial_summary",
  "get_financial_overview",
  "get_investment_summary",
  "get_rent_adjustment_alerts",
  "get_net_worth_summary",
  "get_daily_integrated_snapshot",
  "list_health_records",
  "get_health_alerts",
  "list_calendar_events",
  "list_tasks",
  "list_legal_processes",
  "get_pending_items",
  "get_family_timeline",
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
