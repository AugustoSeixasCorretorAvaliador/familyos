import { z } from "zod";

export const IdSchema = z.object({ id: z.string().uuid() });
export const PaginationSchema = z.object({ limit: z.number().int().min(1).max(500).optional() });

export const CreatePersonSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().optional(),
  family_role: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  status: z.string().optional(),
});

export const UpdatePersonSchema = z.object({
  id: z.string().uuid(),
  input: z.record(z.string(), z.unknown()),
});

export const CreateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  due_date: z.string().optional(),
  person_id: z.string().uuid().optional(),
  status: z.string().optional(),
});

export const CompleteTaskSchema = z.object({ id: z.string().uuid() });
export const DaysSchema = z.object({ days: z.number().int().min(1).max(365).optional() });
export const MarkAlertReadSchema = z.object({ id: z.string().uuid() });
export const CreateCaseSchema = z.object({ input: z.record(z.string(), z.unknown()) });
export const CreateExamSchema = z.object({ input: z.record(z.string(), z.unknown()) });
export const UpdateExamSchema = z.object({ id: z.string().uuid(), input: z.record(z.string(), z.unknown()) });
export const CreatePropertySchema = z.object({ input: z.record(z.string(), z.unknown()) });
export const UpdatePropertySchema = z.object({ id: z.string().uuid(), input: z.record(z.string(), z.unknown()) });
export const CreateFinancialEntrySchema = z.object({ input: z.record(z.string(), z.unknown()) });
export const TimelineCreateSchema = z.object({ input: z.record(z.string(), z.unknown()) });

export const AuditListSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  toolName: z.string().optional(),
  userId: z.string().uuid().optional(),
  status: z.enum(["started", "success", "denied", "failed"]).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

export const UploadDocumentSchema = z.object({
  personId: z.string().uuid().nullable().optional(),
  documentType: z.string().min(1),
  title: z.string().min(1).optional(),
  documentNumber: z.string().optional(),
  issueDate: z.string().optional(),
  expirationDate: z.string().optional(),
  issuingAuthority: z.string().optional(),
  country: z.string().optional(),
  observations: z.string().optional(),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  contentBase64: z.string().min(1),
});

export const ProcessDocumentSchema = z.object({ documentId: z.string().uuid() });
export const OCRJobSchema = z.object({ jobId: z.string().uuid() });
export const ConfirmDocumentSchema = z.object({
  documentId: z.string().uuid(),
  fields: z.record(z.string(), z.unknown()).optional(),
});
export const RejectDocumentSchema = z.object({
  documentId: z.string().uuid(),
  reason: z.string().optional(),
});

export const CalendarEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  start: z.string().min(1),
  end: z.string().min(1),
  timezone: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string().email()).optional(),
  reminders: z.array(z.object({ method: z.enum(["email", "popup"]), minutes: z.number().int().min(0) })).optional(),
  allDay: z.boolean().optional(),
  calendarId: z.string().optional(),
});

export const CalendarUpdateSchema = CalendarEventSchema.partial().extend({
  eventId: z.string().min(1),
  calendarId: z.string().optional(),
});

export const CalendarDeleteSchema = z.object({
  eventId: z.string().min(1),
  calendarId: z.string().optional(),
});

export const CalendarListSchema = z.object({
  calendarId: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
