# Tool Catalog

## Dashboard
- `get_dashboard`

## People
- `list_people`
- `get_person`
- `create_person`
- `update_person`
- `delete_person`

## Documents
- `list_documents`
- `get_document`
- `list_expiring_documents`
- `upload_document`
- `process_document`
- `reprocess_document`
- `get_ocr_job`
- `confirm_document`
- `reject_document`

`upload_document` accepts `personId`, `documentType`, `fileName`, `mimeType`, and `contentBase64`. It stores files in the private `family-documents` bucket, creates or versions a row in `documents`, writes `document_versions`, and returns a `documentId`.

## Audit
- `list_audit_logs`
- `get_audit_log`

Audit tools require `audit.read` and family admin/owner role.

## Health
- `list_doctors`
- `list_medications`
- `list_health_exams`
- `list_due_exams`
- `create_exam`
- `update_exam`

## Property
- `list_properties`
- `get_property`
- `create_property`
- `update_property`

## Finance
- `list_accounts`
- `list_financial_entries`
- `list_open_debts`
- `create_financial_entry`

## Agenda and Timeline
- `list_events`
- `calendar_status`
- `list_google_upcoming_events`
- `list_next_events`
- `create_calendar_event`
- `update_calendar_event`
- `delete_calendar_event`
- `list_timeline`
- `create_timeline_event`

Calendar read tools require `calendar.read`. Mutating tools require `calendar.write` and the Google scope `https://www.googleapis.com/auth/calendar.events`.

## Alerts and Tasks
- `list_alerts`
- `mark_alert_as_read`
- `list_tasks`
- `create_task`
- `complete_task`

## Legal
- `list_cases`
- `create_case`
- `add_case_document` (stub)

## Intelligence
- `build_knowledge_graph`
- `get_family_context`
- `get_executive_summary`
- `get_ai_recommendations`
