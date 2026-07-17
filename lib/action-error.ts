import "server-only";

import { randomUUID } from "node:crypto";
import type { ActionErrorCode } from "@/lib/action-feedback";

type ExternalError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
  statusCode?: string | number | null;
};

type ReportActionErrorInput = {
  error: unknown;
  userId: string;
  familyId: string;
  module: string;
  action: string;
  fallback: ActionErrorCode;
};

function asExternalError(error: unknown): ExternalError {
  if (error && typeof error === "object") return error as ExternalError;
  if (error instanceof Error) return { message: error.message };
  return { message: String(error ?? "unknown_error") };
}

function classifyError(error: ExternalError, fallback: ActionErrorCode): ActionErrorCode {
  const code = String(error.code ?? error.statusCode ?? "").toUpperCase();
  const message = String(error.message ?? "").toLowerCase();

  if (code === "42501") return "permission_denied";
  if (code === "PGRST205" || code === "42P01") return "schema_missing";
  if (code === "PGRST204" || code === "42703") return "schema_mismatch";
  if (code === "23505") return "duplicate";
  if (code === "23503") return "related_records";
  if (code === "PGRST116") return "not_found";
  if (message.includes("bucket") && message.includes("not found")) return "storage_bucket_missing";
  if (message.includes("storage") || message.includes("upload")) return "storage_failed";
  if (message.includes("invitation_email_mismatch")) return "invitation_email_mismatch";
  if (
    message.includes("invalid_or_expired_invitation") ||
    message.includes("invitation_already_consumed")
  ) {
    return "invitation_invalid";
  }
  if (message.includes("pending_invitation")) return "pending_invitation";
  if (message.includes("existing_person_requires_invitation")) return "invitation_required";

  return fallback;
}

export function reportActionError(input: ReportActionErrorInput) {
  const requestId = randomUUID();
  const externalError = asExternalError(input.error);
  const code = classifyError(externalError, input.fallback);

  console.error(
    "[familyos_action_error]",
    JSON.stringify({
      request_id: requestId,
      user_id: input.userId,
      family_id: input.familyId,
      module: input.module,
      action: input.action,
      error_code: externalError.code ?? externalError.statusCode ?? null,
      error_message: externalError.message ?? null,
      error_details: externalError.details ?? null,
      error_hint: externalError.hint ?? null,
    })
  );

  return { code, requestId };
}

export function errorRedirectPath(path: string, result: ReturnType<typeof reportActionError>) {
  const params = new URLSearchParams({
    error: result.code,
    request_id: result.requestId,
  });
  return `${path}?${params.toString()}`;
}
