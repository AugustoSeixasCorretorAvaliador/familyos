import type { AuditEntry } from "../models/context";
import { logger } from "../config/logger";
import { AuditService } from "../services/audit-service";

export function logAudit(entry: AuditEntry): void {
  logger.info({ audit: entry }, "mcp_tool_audit");
}

export const auditService = new AuditService();
