import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { buildAuthContextFromBearer } from "../auth/session";
import { assertCapabilities, parseCapabilityHeader } from "../tools/authorization";
import { toolCapabilities } from "../tools/capabilities";
import { toolDefinitions } from "../tools/registry";
import { auditService, logAudit } from "../middleware/audit";
import { AppError, toErrorMessage, toStructuredError } from "../utils/errors";
import { healthCheck } from "./health";

function headerValue(headers: Record<string, string | undefined>, key: string) {
  return headers[key] ?? headers[key.toLowerCase()];
}

function parseScopes(value: string | undefined) {
  return (value ?? "")
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export async function startServer() {
  const server = new McpServer({
    name: env.MCP_SERVER_NAME,
    version: env.MCP_SERVER_VERSION,
  });
  const registerTool = (server as any).registerTool.bind(server) as (
    name: string,
    config: { description: string; inputSchema: unknown },
    cb: (rawInput: unknown, extra: unknown) => Promise<{ content: Array<{ type: "text"; text: string }> }>,
  ) => void;

  server.tool("health", "Health check do backend MCP", {}, async () => {
    const health = await healthCheck();
    return {
      content: [{ type: "text", text: JSON.stringify(health, null, 2) }],
    };
  });

  for (const tool of toolDefinitions) {
    registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.schema,
    }, async (rawInput, extra) => {
      const startedAt = Date.now();
      const requestInfo = extra as {
        requestInfo?: {
          headers?: Record<string, string | undefined>;
          ip?: string;
        };
      };

      const headers = requestInfo.requestInfo?.headers ?? {};
      const ip = requestInfo.requestInfo?.ip ?? "unknown";
      const metadata = {
        requestId: headerValue(headers, "x-request-id") ?? randomUUID(),
        sessionId: headerValue(headers, "mcp-session-id") ?? headerValue(headers, "x-session-id"),
        ip,
        userAgent: headerValue(headers, "user-agent"),
        clientName: headerValue(headers, "x-familyos-client-name"),
        clientVersion: headerValue(headers, "x-familyos-client-version"),
      };
      let auth: Awaited<ReturnType<typeof buildAuthContextFromBearer>> | undefined;
      let auditId: string | undefined;

      try {
        auth = await buildAuthContextFromBearer(headerValue(headers, "authorization"), {
          familyId: headerValue(headers, "x-familyos-family-id"),
          clientName: metadata.clientName,
          clientVersion: metadata.clientVersion,
          userAgent: metadata.userAgent,
          googleAccessToken: headerValue(headers, "x-google-access-token"),
          googleScopes: parseScopes(headerValue(headers, "x-google-scopes")),
        });

        auditId = await auditService.startAudit({
          auth,
          metadata,
          toolName: tool.name,
          operation: tool.name,
          input: rawInput,
        });

        const grants = parseCapabilityHeader(headerValue(headers, "x-familyos-capabilities"));

        const required = toolCapabilities[tool.name] ?? [];
        assertCapabilities(tool.name, required, grants);

        const parsed = tool.schema.safeParse(rawInput);
        if (!parsed.success) {
          throw new AppError("Invalid tool input", 400, "VALIDATION_ERROR", false, {
            issues: parsed.error.issues,
          });
        }

        const result = await tool.run(auth, parsed.data);

        logAudit({
          tool: tool.name,
          userId: auth.userId,
          familyId: auth.familyId,
          durationMs: Date.now() - startedAt,
          success: true,
          ip,
        });

        await auditService.completeAudit({
          id: auditId,
          auth,
          metadata,
          toolName: tool.name,
          operation: tool.name,
          input: rawInput,
          result,
          startedAt,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        if (!auditId) {
          auditId = await auditService.startAudit({
            auth,
            metadata,
            toolName: tool.name,
            operation: tool.name,
            input: rawInput,
          });
        }

        if (auth) {
          logAudit({
            tool: tool.name,
            userId: auth.userId,
            familyId: auth.familyId,
            durationMs: Date.now() - startedAt,
            success: false,
            ip,
            error: toErrorMessage(error),
          });
        }

        const structured = toStructuredError(error);
        await auditService.failAudit({
          id: auditId,
          auth,
          metadata,
          toolName: tool.name,
          operation: tool.name,
          input: rawInput,
          errorCode: structured.code,
          errorMessage: structured.message,
          startedAt,
          denied: structured.code === "FORBIDDEN" || structured.code === "CAPABILITY_REQUIRED" || structured.code === "UNAUTHENTICATED",
        });

        return {
          content: [{ type: "text", text: JSON.stringify({ error: structured }, null, 2) }],
        };
      }
    });
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info({ name: env.MCP_SERVER_NAME, version: env.MCP_SERVER_VERSION }, "FamilyOS MCP server started");
}
