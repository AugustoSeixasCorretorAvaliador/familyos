export type Capability =
  | "dashboard.read"
  | "people.read"
  | "people.write"
  | "documents.read"
  | "documents.write"
  | "documents.process"
  | "health.read"
  | "health.write"
  | "property.read"
  | "property.write"
  | "finance.read"
  | "finance.write"
  | "agenda.read"
  | "agenda.write"
  | "calendar.read"
  | "calendar.write"
  | "audit.read"
  | "admin"
  | "timeline.read"
  | "timeline.write"
  | "alerts.read"
  | "alerts.write"
  | "tasks.read"
  | "tasks.write"
  | "legal.read"
  | "legal.write"
  | "knowledge.read"
  | "family.read"
  | "ai.summary";

export const toolCapabilities: Record<string, Capability[]> = {
  get_dashboard: ["dashboard.read"],

  list_people: ["people.read"],
  get_person: ["people.read"],
  create_person: ["people.write"],
  update_person: ["people.write"],
  delete_person: ["people.write"],

  list_documents: ["documents.read"],
  get_document: ["documents.read"],
  list_expiring_documents: ["documents.read"],
  upload_document: ["documents.write"],
  process_document: ["documents.process"],
  reprocess_document: ["documents.process"],
  get_ocr_job: ["documents.read"],
  confirm_document: ["documents.write"],
  reject_document: ["documents.write"],
  create_document_upload_url: ["documents.write"],
  complete_document_upload: ["documents.write"],
  list_audit_logs: ["audit.read"],
  get_audit_log: ["audit.read"],

  list_doctors: ["health.read"],
  list_medications: ["health.read"],
  list_health_exams: ["health.read"],
  list_due_exams: ["health.read"],
  create_exam: ["health.write"],
  update_exam: ["health.write"],

  list_properties: ["property.read"],
  get_property: ["property.read"],
  create_property: ["property.write"],
  update_property: ["property.write"],

  list_accounts: ["finance.read"],
  list_financial_entries: ["finance.read"],
  list_open_debts: ["finance.read"],
  create_financial_entry: ["finance.write"],

  list_events: ["agenda.read"],
  calendar_status: ["calendar.read"],
  list_next_events: ["calendar.read"],
  list_google_upcoming_events: ["agenda.read"],
  create_calendar_event: ["calendar.write"],
  update_calendar_event: ["calendar.write"],
  delete_calendar_event: ["calendar.write"],
  create_event: ["calendar.write"],
  update_event: ["calendar.write"],

  list_timeline: ["timeline.read"],
  create_timeline_event: ["timeline.write"],

  list_alerts: ["alerts.read"],
  mark_alert_as_read: ["alerts.write"],

  list_tasks: ["tasks.read"],
  create_task: ["tasks.write"],
  complete_task: ["tasks.write"],

  list_cases: ["legal.read"],
  create_case: ["legal.write"],
  add_case_document: ["legal.write"],

  build_knowledge_graph: ["knowledge.read"],
  get_family_context: ["family.read"],
  get_executive_summary: ["ai.summary"],
  get_ai_recommendations: ["ai.summary"],
};
