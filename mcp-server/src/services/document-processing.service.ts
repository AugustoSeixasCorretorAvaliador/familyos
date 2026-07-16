import { createHash, randomUUID } from "node:crypto";
import { env } from "../config/env";
import { createSupabaseAdminClient } from "../providers/supabase.provider";
import { AppError } from "../utils/errors";
import { parseDocumentText } from "../utils/document-parser";

export const DOCUMENT_STATUS = {
  uploaded: "Enviado",
  processing: "OCR em processamento",
  waitingReview: "Aguardando conferencia",
  confirmed: "Confirmado",
  rejected: "Rejeitado",
  ocrError: "Erro OCR",
} as const;

const BUCKET = "family-documents";
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/tiff",
  "image/tif",
]);

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function sanitizeFolderName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function decodeUpload(contentBase64: string) {
  const bytes = Buffer.from(contentBase64, "base64");
  if (bytes.byteLength === 0) throw new AppError("Empty document payload", 400, "VALIDATION_ERROR");
  if (bytes.byteLength > MAX_UPLOAD_SIZE) throw new AppError("Document exceeds 20 MB", 400, "VALIDATION_ERROR");
  return bytes;
}

export function assertAllowedMime(mimeType: string) {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new AppError("Unsupported document MIME type", 400, "VALIDATION_ERROR", false, { mimeType });
  }
}

export function buildStoragePath(input: { familyId: string; personId?: string | null; documentType: string; fileName: string }) {
  return [
    input.familyId,
    input.personId ?? "sem-titular",
    sanitizeFolderName(input.documentType || "documento-generico"),
    `${Date.now()}-${randomUUID()}-${sanitizeFileName(input.fileName)}`,
  ].join("/");
}

export async function runOcr(input: { fileName: string; mimeType: string; bytes: Uint8Array }) {
  const startedAt = Date.now();
  if (input.mimeType === "application/pdf") {
    return {
      provider: "mcp_pdf_pending_external_ocr",
      text: "",
      confidence: 0,
      durationMs: Date.now() - startedAt,
      warning: "PDF OCR requires an external worker or text extraction dependency.",
    };
  }

  if (!env.GOOGLE_VISION_API_KEY) {
    return {
      provider: "mcp_ocr_not_configured",
      text: "",
      confidence: 0,
      durationMs: Date.now() - startedAt,
      warning: "GOOGLE_VISION_API_KEY is not configured.",
    };
  }

  const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(env.GOOGLE_VISION_API_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{
        image: { content: Buffer.from(input.bytes).toString("base64") },
        features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
      }],
    }),
  });

  if (!response.ok) throw new AppError("Google Vision OCR failed", 502, "OCR_FAILED", true);
  const payload = await response.json() as {
    responses?: Array<{ fullTextAnnotation?: { text?: string; pages?: Array<{ confidence?: number }> }; error?: { message?: string } }>;
  };
  const first = payload.responses?.[0];
  if (first?.error?.message) throw new AppError(first.error.message, 502, "OCR_FAILED", true);
  const text = first?.fullTextAnnotation?.text?.trim() ?? "";
  const confidences = (first?.fullTextAnnotation?.pages ?? []).map((page) => page.confidence).filter((value): value is number => typeof value === "number");
  return {
    provider: "google_vision",
    text,
    confidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : text ? 0.85 : 0,
    durationMs: Date.now() - startedAt,
  };
}

export async function logTimeline(familyId: string, eventType: string, entityId: string, priority: "low" | "medium" | "high" | "critical" = "medium") {
  try {
    await createSupabaseAdminClient().from("events").insert({
      family_id: familyId,
      event_type: eventType,
      source: "mcp-server",
      affected_entity_type: "documents",
      affected_entity_id: entityId,
      priority,
      automation_status: "partially_automated",
      occurred_at: new Date().toISOString(),
    });
  } catch {
    // Timeline is secondary to the document operation.
  }
}

export async function createDocumentAlerts(input: { familyId: string; documentId: string; title: string; expirationDate?: string | null }) {
  if (!input.expirationDate) return;
  const expiry = new Date(input.expirationDate);
  const today = new Date();
  expiry.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
  if (diffDays > 90) return;

  await createSupabaseAdminClient().from("alerts").insert({
    family_id: input.familyId,
    related_entity_type: "documents",
    related_entity_id: input.documentId,
    severity: diffDays < 0 ? "critical" : diffDays <= 30 ? "high" : "medium",
    title: diffDays < 0 ? `Documento vencido: ${input.title}` : `Documento vence em ${Math.max(diffDays, 0)} dias: ${input.title}`,
    description: "Gerado automaticamente pelo MCP FamilyOS.",
    due_date: input.expirationDate,
    status: "pending",
  });
}

export async function interpretOcrText(rawText: string) {
  return {
    provider: "rule_based_v1",
    suggestion: parseDocumentText(rawText),
  };
}
