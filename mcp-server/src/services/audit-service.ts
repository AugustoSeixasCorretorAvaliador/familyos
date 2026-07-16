import type { AuthContext, RequestMetadata } from "../models/context";
import { createSupabaseAdminClient, createSupabaseUserClient } from "../providers/supabase.provider";
import { AppError } from "../utils/errors";
import { summarizeInput, summarizeResult } from "../utils/redaction";

type AuditStatus = "started" | "success" | "denied" | "failed";

type StartAuditInput = {
  auth?: AuthContext;
  metadata: RequestMetadata;
  toolName: string;
  operation: string;
  input: unknown;
};

type FinishAuditInput = {
  id?: string;
  auth?: AuthContext;
  metadata: RequestMetadata;
  toolName: string;
  operation: string;
  input: unknown;
  result?: unknown;
  status: AuditStatus;
  errorCode?: string;
  errorMessage?: string;
  startedAt: number;
};

export class AuditService {
  private admin() {
    return createSupabaseAdminClient();
  }

  async startAudit(input: StartAuditInput) {
    try {
      const { data } = await this.admin()
        .from("mcp_audit_logs")
        .insert({
          family_id: input.auth?.familyId ?? null,
          user_id: input.auth?.userId ?? null,
          request_id: input.metadata.requestId,
          session_id: input.metadata.sessionId ?? null,
          tool_name: input.toolName,
          operation: input.operation,
          input_summary: summarizeInput(input.input),
          result_summary: {},
          status: "started",
          client_name: input.metadata.clientName ?? input.auth?.clientName ?? null,
          client_version: input.metadata.clientVersion ?? input.auth?.clientVersion ?? null,
          ip_address: input.metadata.ip ?? null,
          user_agent: input.metadata.userAgent ?? input.auth?.userAgent ?? null,
        })
        .select("id")
        .single();
      return data?.id as string | undefined;
    } catch {
      return undefined;
    }
  }

  async completeAudit(input: Omit<FinishAuditInput, "status">) {
    await this.finishAudit({ ...input, status: "success" });
  }

  async failAudit(input: Omit<FinishAuditInput, "status"> & { denied?: boolean }) {
    await this.finishAudit({ ...input, status: input.denied ? "denied" : "failed" });
  }

  private async finishAudit(input: FinishAuditInput) {
    try {
      const row = {
        family_id: input.auth?.familyId ?? null,
        user_id: input.auth?.userId ?? null,
        request_id: input.metadata.requestId,
        session_id: input.metadata.sessionId ?? null,
        tool_name: input.toolName,
        operation: input.operation,
        input_summary: summarizeInput(input.input),
        result_summary: input.result ? summarizeResult(input.result) : {},
        status: input.status,
        error_code: input.errorCode ?? null,
        error_message: input.errorMessage ?? null,
        duration_ms: Date.now() - input.startedAt,
        client_name: input.metadata.clientName ?? input.auth?.clientName ?? null,
        client_version: input.metadata.clientVersion ?? input.auth?.clientVersion ?? null,
        ip_address: input.metadata.ip ?? null,
        user_agent: input.metadata.userAgent ?? input.auth?.userAgent ?? null,
      };

      if (input.id) {
        await this.admin().from("mcp_audit_logs").update(row).eq("id", input.id);
        return;
      }

      await this.admin().from("mcp_audit_logs").insert(row);
    } catch {
      // Persistent audit must not hide the primary tool result/error.
    }
  }

  async listAuditLogs(auth: AuthContext, filters: {
    from?: string;
    to?: string;
    toolName?: string;
    userId?: string;
    status?: AuditStatus;
    limit?: number;
    offset?: number;
  }) {
    this.assertAuditReader(auth);
    let query = createSupabaseUserClient(auth.token)
      .from("mcp_audit_logs")
      .select("id, request_id, session_id, tool_name, operation, status, error_code, duration_ms, client_name, client_version, ip_address, user_agent, created_at, user_id")
      .eq("family_id", auth.familyId)
      .order("created_at", { ascending: false })
      .range(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 50) - 1);

    if (filters.from) query = query.gte("created_at", filters.from);
    if (filters.to) query = query.lte("created_at", filters.to);
    if (filters.toolName) query = query.eq("tool_name", filters.toolName);
    if (filters.userId) query = query.eq("user_id", filters.userId);
    if (filters.status) query = query.eq("status", filters.status);

    const { data, error } = await query;
    if (error) throw new AppError(error.message, 500, "SUPABASE_ERROR", true);
    return data ?? [];
  }

  async getAuditLog(auth: AuthContext, id: string) {
    this.assertAuditReader(auth);
    const { data, error } = await createSupabaseUserClient(auth.token)
      .from("mcp_audit_logs")
      .select("*")
      .eq("id", id)
      .eq("family_id", auth.familyId)
      .maybeSingle();

    if (error) throw new AppError(error.message, 500, "SUPABASE_ERROR", true);
    if (!data) throw new AppError("Audit log not found", 404, "DOCUMENT_NOT_FOUND");
    return data;
  }

  private assertAuditReader(auth: AuthContext) {
    if (auth.role !== "owner" && auth.role !== "admin") {
      throw new AppError("Only family administrators can read audit logs", 403, "FORBIDDEN");
    }
  }
}
