"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorRedirectPath, reportActionError } from "@/lib/action-error";
import type { ActionErrorCode } from "@/lib/action-feedback";
import { suggestDocumentTitle } from "@/lib/document-intake/merge";
import {
  validateUploadedPropertyDocuments,
} from "@/lib/document-intake/property-files";
import {
  canAdminFamily,
  canEditFamily,
  getFamilyContext,
} from "@/lib/family/context";
import { getOcrConfig } from "@/lib/ocr/config";
import {
  OcrOperationalError,
  toOcrOperationalError,
} from "@/lib/ocr/errors";
import { getOCRProvider } from "@/lib/ocr/provider";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline/log-event";

const BUCKET = "family-documents";
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/tiff",
  "image/tif",
]);

const DOCUMENT_STATUS = {
  uploaded: "Enviado",
  processing: "OCR em processamento",
  waitingReview: "Aguardando conferencia",
  confirmed: "Confirmado",
  rejected: "Rejeitado",
  ocrError: "Erro OCR",
} as const;

export type DocumentFileIntakeInput = {
  familyId: string;
  userId: string;
  file: File;
  documentId?: string | null;
  ownerPersonId?: string | null;
  propertyId?: string | null;
  skipOcr?: boolean;
  documentType?: string | null;
  documentNumber?: string | null;
  title?: string | null;
  issueDate?: string | null;
  expirationDate?: string | null;
  issuingAuthority?: string | null;
  country?: string | null;
  metadata?: Record<string, unknown>;
  source?: string;
};

export type DocumentFileIntakeResult = {
  documentId: string;
  version: number;
  isNew: boolean;
};

function failDocument(
  error: unknown,
  userId: string,
  familyId: string,
  action: string,
  fallback: ActionErrorCode
): never {
  redirect(
    errorRedirectPath(
      "/documentos",
      reportActionError({
        error,
        userId,
        familyId,
        module: "documentos",
        action,
        fallback,
      })
    )
  );
}

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

function normalizeDocumentType(rawType: string | null) {
  const value = (rawType ?? "Documento Generico").trim();
  return value || "Documento Generico";
}

function toDateOrNull(value: string | null) {
  if (!value || value.trim().length === 0) return null;
  return value;
}

function buildStoragePath(input: {
  familyId: string;
  personId: string | null;
  documentType: string;
  fileName: string;
}) {
  const personFolder = input.personId ?? "sem-titular";
  const typeFolder = sanitizeFolderName(input.documentType || "documento-generico");
  const normalizedFileName = `${Date.now()}-${randomUUID()}-${sanitizeFileName(input.fileName)}`;
  return `${input.familyId}/${personFolder}/${typeFolder}/${normalizedFileName}`;
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function upsertVersion(params: {
  familyId: string;
  documentId: string;
  version: number;
  storagePath: string;
  fileName: string;
  mimeType: string;
  uploadedBy: string;
  fileHash: string;
}) {
  const supabase = createClient();

  const { error: insertError } = await supabase.from("document_versions").insert({
    family_id: params.familyId,
    document_id: params.documentId,
    version: params.version,
    storage_path: params.storagePath,
    file_name: params.fileName,
    mime_type: params.mimeType,
    file_hash_sha256: params.fileHash,
    uploaded_by: params.uploadedBy,
    uploaded_at: new Date().toISOString(),
    is_current: true,
  });
  if (insertError) throw insertError;

  const { error: updateError } = await supabase
    .from("document_versions")
    .update({ is_current: false })
    .eq("family_id", params.familyId)
    .eq("document_id", params.documentId)
    .neq("version", params.version)
    .eq("is_current", true);
  if (updateError) throw updateError;
}

export async function intakeDocumentFile(
  input: DocumentFileIntakeInput
): Promise<DocumentFileIntakeResult> {
  const context = await getFamilyContext();
  if (
    !context.user ||
    !context.family ||
    context.user.id !== input.userId ||
    context.family.id !== input.familyId
  ) {
    throw new Error("document_intake_scope_denied");
  }
  const supabase = createClient();
  const file = input.file;

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("invalid_file");
  }
  if (file.size > getOcrConfig().maxFileSizeBytes) {
    throw new OcrOperationalError("file_too_large");
  }
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new OcrOperationalError("unsupported_format");
  }

  const documentType = normalizeDocumentType(input.documentType ?? null);
  const title = input.title?.trim() || "Documento em revisao";
  const ownerPersonId = input.ownerPersonId || null;
  const source = [
    "documentos.actions",
    "imoveis.actions",
    "saude.actions",
  ].includes(input.source ?? "")
    ? input.source!
    : "documentos.actions";
  const metadata = {
    ...(input.metadata ?? {}),
    intake_draft: !input.documentId && !input.skipOcr,
    intake_source: source,
    archived_without_ocr: input.skipOcr === true,
  };
  let documentId = input.documentId || "";
  let isNew = false;
  let previous:
    | {
        storage_path: string;
        file_name: string | null;
        mime_type: string | null;
        version: number;
        status: string;
        metadata: Record<string, unknown> | null;
      }
    | null = null;

  if (documentId) {
    const { data, error } = await supabase
      .from("documents")
      .select("storage_path, file_name, mime_type, version, status, metadata")
      .eq("id", documentId)
      .eq("family_id", input.familyId)
      .maybeSingle();
    if (error || !data) throw error ?? new Error("document_not_found");
    previous = {
      ...data,
      metadata:
        data.metadata && typeof data.metadata === "object"
          ? (data.metadata as Record<string, unknown>)
          : null,
    };
  } else {
    const { data, error } = await supabase
      .from("documents")
      .insert({
        family_id: input.familyId,
        owner_person_id: ownerPersonId,
        property_id: input.propertyId || null,
        document_type: documentType,
        document_number: input.documentNumber?.trim() || null,
        title,
        issue_date: input.issueDate || null,
        expiration_date: input.expirationDate || null,
        issuing_authority: input.issuingAuthority?.trim() || null,
        country: input.country?.trim() || "Brasil",
        storage_provider: "supabase_storage",
        storage_path: "pending",
        file_name: null,
        mime_type: null,
        version: 1,
        is_current: true,
        status: input.skipOcr ? "active" : "pending",
        processing_status: input.skipOcr
          ? DOCUMENT_STATUS.confirmed
          : DOCUMENT_STATUS.uploaded,
        review_required: !input.skipOcr,
        last_ocr_error: null,
        metadata,
      })
      .select("id")
      .single();
    if (error || !data) {
      throw error ?? new Error("document_draft_not_returned");
    }
    documentId = data.id;
    isNew = true;
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const storagePath = buildStoragePath({
    familyId: input.familyId,
    personId: ownerPersonId,
    documentType,
    fileName: file.name,
  });
  const version = isNew ? 1 : (previous?.version ?? 1) + 1;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) {
    if (isNew) {
      await supabase
        .from("documents")
        .update({
          metadata: {
            ...metadata,
            intake_error: "storage_failed",
          },
        })
        .eq("id", documentId)
        .eq("family_id", input.familyId);
    }
    throw uploadError;
  }

  try {
    await upsertVersion({
      familyId: input.familyId,
      documentId,
      version,
      storagePath,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      uploadedBy: input.userId,
      fileHash: sha256(bytes),
    });

    const { data: persistedDocument, error: updateError } = await supabase
      .from("documents")
      .update({
        owner_person_id: ownerPersonId,
        property_id: input.propertyId || undefined,
        document_type: documentType,
        document_number: input.documentNumber?.trim() || null,
        title,
        issue_date: input.issueDate || null,
        expiration_date: input.expirationDate || null,
        issuing_authority: input.issuingAuthority?.trim() || null,
        country: input.country?.trim() || "Brasil",
        storage_provider: "supabase_storage",
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        version,
        is_current: true,
        status: (input.skipOcr
          ? "active"
          : isNew
            ? "pending"
            : previous?.status ?? "active") as "active" | "inactive" | "pending" | "expired" | "archived" | "cancelled",
        processing_status: input.skipOcr
          ? DOCUMENT_STATUS.confirmed
          : DOCUMENT_STATUS.uploaded,
        review_required: !input.skipOcr,
        last_ocr_error: null,
        metadata: {
          ...(previous?.metadata ?? {}),
          ...metadata,
          intake_error: null,
        },
      })
      .eq("id", documentId)
      .eq("family_id", input.familyId)
      .select("id, property_id, processing_status, storage_path")
      .maybeSingle();
    if (updateError || !persistedDocument) {
      throw updateError ?? new Error("document_intake_not_persisted");
    }
    if (
      input.propertyId &&
      persistedDocument.property_id !== input.propertyId
    ) {
      throw new Error("document_property_link_not_persisted");
    }
    if (
      input.skipOcr &&
      persistedDocument.processing_status !== DOCUMENT_STATUS.confirmed
    ) {
      throw new Error("document_archive_status_not_persisted");
    }
    if (persistedDocument.storage_path !== storagePath) {
      throw new Error("document_storage_path_not_persisted");
    }
  } catch (error) {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    await supabase
      .from("document_versions")
      .delete()
      .eq("family_id", input.familyId)
      .eq("document_id", documentId)
      .eq("version", version);
    if (previous) {
      await supabase
        .from("document_versions")
        .update({ is_current: true })
        .eq("family_id", input.familyId)
        .eq("document_id", documentId)
        .eq("version", previous.version);
    }
    throw error;
  }

  await logTimelineEvent({
    familyId: input.familyId,
    eventType: input.propertyId
      ? "property_document_uploaded"
      : "document_uploaded",
    affectedEntityType: "documents",
    affectedEntityId: documentId,
    source,
  });

  return { documentId, version, isNew };
}

async function createDocumentAlerts(input: {
  familyId: string;
  documentId: string;
  title: string;
  expirationDate: string | null;
}) {
  const supabase = createClient();

  await supabase
    .from("alerts")
    .update({
      status: "archived",
      resolved_at: new Date().toISOString(),
    })
    .eq("family_id", input.familyId)
    .eq("related_entity_type", "documents")
    .eq("related_entity_id", input.documentId)
    .eq("status", "pending");

  if (!input.expirationDate) return;

  const expiry = new Date(input.expirationDate);
  expiry.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays > 90) return;

  const title =
    diffDays < 0
      ? `Documento vencido: ${input.title}`
      : diffDays === 0
        ? `Documento vence hoje: ${input.title}`
        : diffDays === 1
          ? `Documento vence amanhã: ${input.title}`
          : `Documento vence em ${diffDays} dias: ${input.title}`;

  await supabase.from("alerts").insert({
    family_id: input.familyId,
    related_entity_type: "documents",
    related_entity_id: input.documentId,
    severity:
      diffDays < 0 || diffDays <= 7
        ? "critical"
        : diffDays <= 30
          ? "high"
          : "medium",
    title,
    description: "Gerado automaticamente pelo processamento inteligente de documentos.",
    due_date: input.expirationDate,
    status: "pending",
  });
}

export async function processDocumentPipeline(params: {
  familyId: string;
  documentId: string;
}) {
  const context = await getFamilyContext();
  if (!context.user || !context.family || context.family.id !== params.familyId) {
    return {
      ok: false as const,
      error: new OcrOperationalError("provider_unavailable"),
    };
  }
  const supabase = createClient();
  const config = getOcrConfig();

  const { data: document } = await supabase
    .from("documents")
    .select("id, storage_path, file_name, mime_type, document_type, processing_status")
    .eq("id", params.documentId)
    .eq("family_id", params.familyId)
    .maybeSingle();

  if (!document?.storage_path || document.storage_path === "pending") {
    return {
      ok: false as const,
      error: new OcrOperationalError("provider_unavailable"),
    };
  }

  const provider = getOCRProvider();
  if (provider.name === "manual") {
    await supabase
      .from("documents")
      .update({
        ocr_provider: provider.name,
        last_ocr_error: null,
      })
      .eq("id", params.documentId)
      .eq("family_id", params.familyId);
    return { ok: true as const, outcome: "manual" as const };
  }

  const previousStatus = document.processing_status;
  const { data: lockedDocument, error: lockError } = await supabase
    .from("documents")
    .update({
      processing_status: DOCUMENT_STATUS.processing,
      ocr_provider: provider.name,
      last_ocr_error: null,
    })
    .eq("id", params.documentId)
    .eq("family_id", params.familyId)
    .neq("processing_status", DOCUMENT_STATUS.processing)
    .select("id")
    .maybeSingle();

  if (lockError) {
    return {
      ok: false as const,
      error: new OcrOperationalError("provider_unavailable", { retryable: true }),
    };
  }
  if (!lockedDocument) {
    return {
      ok: false as const,
      error: new OcrOperationalError("already_processing"),
    };
  }

  const { count: previousAttempts } = await supabase
    .from("document_ocr_jobs")
    .select("id", { count: "exact", head: true })
    .eq("document_id", params.documentId)
    .eq("family_id", params.familyId);
  const attempt = (previousAttempts ?? 0) + 1;
  const startedAt = new Date().toISOString();

  const { data: job, error: jobError } = await supabase
    .from("document_ocr_jobs")
    .insert({
      family_id: params.familyId,
      document_id: params.documentId,
      provider: provider.name,
      status: "processing",
      started_at: startedAt,
      suggestion_json: {
        ocr_meta: {
          attempt,
          model: provider.name === "openai" ? config.openAIModel : null,
          confidence_kind: provider.name === "openai" ? "model_estimate" : "provider",
        },
      },
    })
    .select("id")
    .single();

  if (jobError || !job) {
    await supabase
      .from("documents")
      .update({
        processing_status: previousStatus,
        last_ocr_error: null,
      })
      .eq("id", params.documentId)
      .eq("family_id", params.familyId);
    return {
      ok: false as const,
      error: new OcrOperationalError("provider_unavailable", { retryable: true }),
    };
  }

  await logTimelineEvent({
    familyId: params.familyId,
    eventType: "document_ocr_started",
    affectedEntityType: "documents",
    affectedEntityId: params.documentId,
    source: "documentos.actions",
  });

  try {
    const downloaded = await supabase.storage.from(BUCKET).download(document.storage_path);
    if (downloaded.error || !downloaded.data) {
      throw new Error("Falha ao baixar arquivo para OCR.");
    }

    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    if (bytes.byteLength > config.maxFileSizeBytes) {
      throw new OcrOperationalError("file_too_large");
    }

    const ocr = await provider.process({
      fileName: document.file_name ?? `${params.documentId}.bin`,
      mimeType: document.mime_type ?? "application/octet-stream",
      bytes,
      documentTypeHint: document.document_type,
    });
    const interpretedFields = {
      ...ocr.suggestion.fields,
      detected_document_type: ocr.suggestion.detectedType,
      suggested_title: suggestDocumentTitle({
        documentType: ocr.suggestion.detectedType,
        personName: ocr.suggestion.fields.nome,
        documentNumber: ocr.suggestion.fields.numero,
        registryNumber: ocr.suggestion.fields.matricula,
        issueDate: ocr.suggestion.fields.data_emissao,
      }),
    };
    if (ocr.warnings.length > 0) {
      const warningText = `Avisos OCR: ${ocr.warnings.join(" | ")}`;
      interpretedFields.observacoes = interpretedFields.observacoes
        ? `${interpretedFields.observacoes}\n${warningText}`
        : warningText;
    }

    await supabase.from("document_metadata").upsert(
      {
        family_id: params.familyId,
        document_id: params.documentId,
        extracted_text: ocr.rawText,
        interpreted_fields: interpretedFields,
        confidence_by_field: ocr.suggestion.confidenceByField,
        overall_confidence: ocr.suggestion.overallConfidence,
        needs_review: true,
        reviewed_by: null,
        reviewed_at: null,
      },
      { onConflict: "document_id" }
    );

    await supabase
      .from("documents")
      .update({
        processing_status: DOCUMENT_STATUS.waitingReview,
        ai_provider: ocr.provider === "openai" ? "openai" : "rule_based_v1",
        ocr_provider: ocr.provider,
        ocr_confidence: Number((ocr.confidence * 100).toFixed(2)),
        review_required: true,
        last_ocr_at: new Date().toISOString(),
        last_ocr_error: null,
      })
      .eq("id", params.documentId)
      .eq("family_id", params.familyId);

    if (job?.id) {
      await supabase
        .from("document_ocr_jobs")
        .update({
          status: "completed",
          confidence: Number((ocr.confidence * 100).toFixed(2)),
          duration_ms: ocr.durationMs,
          extracted_text: null,
          suggestion_json: {
            ocr_meta: {
              attempt,
              model: ocr.model,
              request_id: ocr.requestId,
              extracted_fields_count: ocr.extractedFieldsCount,
              warning_count: ocr.warnings.length,
              confidence_kind: ocr.confidenceKind,
            },
          },
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("family_id", params.familyId);
    }

    await logTimelineEvent({
      familyId: params.familyId,
      eventType: "document_ocr_completed",
      affectedEntityType: "documents",
      affectedEntityId: params.documentId,
      source: "documentos.actions",
    });
    return { ok: true as const, outcome: "completed" as const };
  } catch (error) {
    const safeError = toOcrOperationalError(error);
    const durationMs = Math.max(0, Date.now() - new Date(startedAt).getTime());
    await supabase
      .from("documents")
      .update({
        processing_status: DOCUMENT_STATUS.ocrError,
        review_required: true,
        last_ocr_error: safeError.message,
      })
      .eq("id", params.documentId)
      .eq("family_id", params.familyId);

    if (job?.id) {
      await supabase
        .from("document_ocr_jobs")
        .update({
          status: "failed",
          duration_ms: durationMs,
          error_message: `${safeError.code}: ${safeError.message}`,
          extracted_text: null,
          suggestion_json: {
            ocr_meta: {
              attempt,
              model: provider.name === "openai" ? config.openAIModel : null,
              request_id: safeError.requestId,
              error_code: safeError.code,
              extracted_fields_count: 0,
            },
          },
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("family_id", params.familyId);
    }

    await logTimelineEvent({
      familyId: params.familyId,
      eventType: "document_ocr_failed",
      affectedEntityType: "documents",
      affectedEntityId: params.documentId,
      source: "documentos.actions",
      priority: "high",
    });
    return { ok: false as const, error: safeError };
  }
}

export async function processDocumentOCR(formData: FormData) {
  const { user, family } = await getFamilyContext();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const documentId = (formData.get("document_id") as string | null) || "";
  if (!documentId) redirect("/documentos?error=missing_id");

  const result = await processDocumentPipeline({ familyId: family.id, documentId });
  if (!result.ok) {
    revalidatePath(`/documentos/${documentId}/revisar`);
    revalidatePath("/documentos");
    revalidatePath("/dashboard");
    redirect(
      `/documentos/${documentId}/revisar?error=ocr_failed&reason=${encodeURIComponent(
        result.error.code
      )}`
    );
  }

  revalidatePath(`/documentos/${documentId}/revisar`);
  revalidatePath("/documentos");
  revalidatePath("/dashboard");
  redirect(
    `/documentos/${documentId}/revisar?success=${
      result.outcome === "manual" ? "manual" : "ocr_done"
    }`
  );
}

export async function finalizeArchivedPersonDocument(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user || !family || !canEditFamily(context)) {
    return { ok: false as const, code: "permission_denied" as const };
  }

  const title = (formData.get("title") as string | null)?.trim() || "";
  const documentType =
    (formData.get("document_type") as string | null)?.trim() || "";
  const ownerPersonId =
    (formData.get("owner_person_id") as string | null)?.trim() || "";
  if (!title || !documentType || !ownerPersonId) {
    return { ok: false as const, code: "required_fields" as const };
  }

  let uploadedValue: unknown;
  try {
    uploadedValue = JSON.parse(
      (formData.get("uploaded_files") as string | null) || "null"
    );
  } catch {
    return { ok: false as const, code: "invalid_file" as const };
  }
  const validation = validateUploadedPropertyDocuments(
    uploadedValue,
    family.id
  );
  if (!validation.ok) {
    return { ok: false as const, code: validation.code };
  }
  if (validation.files.length !== 1) {
    return { ok: false as const, code: "invalid_file" as const };
  }

  const { data: owner, error: ownerError } = await supabase
    .from("people")
    .select("id")
    .eq("id", ownerPersonId)
    .eq("family_id", family.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (ownerError || !owner) {
    return { ok: false as const, code: "not_found" as const };
  }

  const file = validation.files[0];
  let documentId = "";
  try {
    const downloaded = await supabase.storage
      .from(BUCKET)
      .download(file.storagePath);
    if (downloaded.error || !downloaded.data) {
      throw downloaded.error ?? new Error("storage_download_failed");
    }
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    if (bytes.byteLength !== file.size) {
      throw new Error("uploaded_file_size_mismatch");
    }

    const issueDate = toDateOrNull(
      (formData.get("issue_date") as string | null) || null
    );
    const expirationDate = toDateOrNull(
      (formData.get("expiration_date") as string | null) || null
    );
    const observacoes =
      (formData.get("observacoes") as string | null)?.trim() || null;
    const { data: document, error: documentError } = await supabase
      .from("documents")
      .insert({
        family_id: family.id,
        owner_person_id: ownerPersonId,
        property_id: null,
        document_type: documentType,
        document_number:
          (formData.get("document_number") as string | null)?.trim() || null,
        title,
        issue_date: issueDate,
        expiration_date: expirationDate,
        issuing_authority:
          (formData.get("issuing_authority") as string | null)?.trim() ||
          null,
        country:
          (formData.get("country") as string | null)?.trim() || "Brasil",
        storage_provider: "supabase_storage",
        storage_path: file.storagePath,
        file_name: file.fileName,
        mime_type: file.mimeType,
        version: 1,
        is_current: true,
        status: "active",
        processing_status: DOCUMENT_STATUS.confirmed,
        review_required: false,
        last_ocr_error: null,
        metadata: {
          observacoes,
          intake_draft: false,
          intake_source: "documentos.actions",
          archived_without_ocr: true,
          intake_error: null,
        },
      })
      .select("id")
      .single();
    if (documentError || !document) {
      throw documentError ?? new Error("document_not_created");
    }
    documentId = document.id;

    const { error: versionError } = await supabase
      .from("document_versions")
      .insert({
        family_id: family.id,
        document_id: documentId,
        version: 1,
        storage_path: file.storagePath,
        file_name: file.fileName,
        mime_type: file.mimeType,
        file_hash_sha256: sha256(bytes),
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString(),
        is_current: true,
      });
    if (versionError) throw versionError;

    await createDocumentAlerts({
      familyId: family.id,
      documentId,
      title,
      expirationDate,
    });
    await logTimelineEvent({
      familyId: family.id,
      eventType: "document_archived",
      affectedEntityType: "documents",
      affectedEntityId: documentId,
      source: "documentos.actions",
    });
  } catch (error) {
    if (documentId) {
      await supabase
        .from("documents")
        .delete()
        .eq("id", documentId)
        .eq("family_id", family.id);
    }
    await supabase.storage.from(BUCKET).remove([file.storagePath]);
    const reported = reportActionError({
      error,
      userId: user.id,
      familyId: family.id,
      module: "documentos",
      action: "finalize_archived_person_document",
      fallback: "create_failed",
    });
    return {
      ok: false as const,
      code: reported.code,
      requestId: reported.requestId,
    };
  }

  revalidatePath("/documentos");
  revalidatePath("/pessoas");
  revalidatePath("/saude");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  return { ok: true as const, documentId };
}

export async function createDocument(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canEditFamily(context)) {
    redirect("/documentos?error=permission_denied");
  }

  const title = (formData.get("title") as string | null)?.trim() || null;
  const requestedDocumentType =
    (formData.get("document_type") as string | null)?.trim() || null;
  const documentType = normalizeDocumentType(requestedDocumentType);
  const ownerPersonId = (formData.get("owner_person_id") as string | null) || null;
  const documentNumber = (formData.get("document_number") as string | null)?.trim() || null;
  const issueDate = toDateOrNull((formData.get("issue_date") as string | null) || null);
  const expirationDate = toDateOrNull((formData.get("expiration_date") as string | null) || null);
  const issuingAuthority = (formData.get("issuing_authority") as string | null)?.trim() || null;
  const country = (formData.get("country") as string | null)?.trim() || "Brasil";
  const observacoes = (formData.get("observacoes") as string | null)?.trim() || null;
  const file = formData.get("file");
  const archiveWithoutOcr =
    formData.get("archive_without_ocr") === "on";

  if (
    archiveWithoutOcr &&
    (!title || !requestedDocumentType || !ownerPersonId)
  ) {
    redirect("/documentos?error=required_fields");
  }

  if (!(file instanceof File) || file.size === 0) {
    if (archiveWithoutOcr) {
      redirect("/documentos?error=invalid_file");
    }
    if (!title) redirect("/documentos?error=required_fields");
    const { data: manualDocument, error: manualError } = await supabase
      .from("documents")
      .insert({
        family_id: family.id,
        owner_person_id: ownerPersonId,
        document_type: documentType,
        document_number: documentNumber,
        title,
        issue_date: issueDate,
        expiration_date: expirationDate,
        issuing_authority: issuingAuthority,
        country,
        storage_provider: "supabase_storage",
        storage_path: "pending",
        file_name: null,
        mime_type: null,
        version: 1,
        is_current: true,
        status: "active",
        processing_status: DOCUMENT_STATUS.uploaded,
        review_required: false,
        last_ocr_error: null,
        metadata: {
          observacoes,
          intake_draft: false,
          intake_source: "documentos",
        },
      })
      .select("id")
      .single();
    if (manualError || !manualDocument) {
      failDocument(
        manualError ?? new Error("manual_document_not_returned"),
        user.id,
        family.id,
        "create_manual",
        "create_failed"
      );
    }
    await createDocumentAlerts({
      familyId: family.id,
      documentId: manualDocument.id,
      title,
      expirationDate,
    });
    await logTimelineEvent({
      familyId: family.id,
      eventType: "document_created",
      affectedEntityType: "documents",
      affectedEntityId: manualDocument.id,
      source: "documentos.actions",
    });
    revalidatePath("/documentos");
    revalidatePath("/dashboard");
    redirect("/documentos?success=created");
  }
  if (file.size > getOcrConfig().maxFileSizeBytes) redirect("/documentos?error=file_too_large");
  if (!ALLOWED_MIME_TYPES.has(file.type)) redirect("/documentos?error=unsupported_file_type");

  if (archiveWithoutOcr && ownerPersonId) {
    const { data: owner, error: ownerError } = await supabase
      .from("people")
      .select("id")
      .eq("id", ownerPersonId)
      .eq("family_id", family.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (ownerError || !owner) {
      redirect("/documentos?error=not_found");
    }
  }

  let intake: DocumentFileIntakeResult;
  try {
    intake = await intakeDocumentFile({
      familyId: family.id,
      userId: user.id,
      file,
      ownerPersonId,
      documentType,
      documentNumber,
      title,
      issueDate,
      expirationDate,
      issuingAuthority,
      country,
      skipOcr: archiveWithoutOcr,
      metadata: { observacoes },
      source: "documentos.actions",
    });
  } catch (error) {
    failDocument(error, user.id, family.id, "intake", "create_failed");
  }

  if (archiveWithoutOcr) {
    await createDocumentAlerts({
      familyId: family.id,
      documentId: intake.documentId,
      title: title!,
      expirationDate,
    });
    revalidatePath("/documentos");
    revalidatePath("/pessoas");
    revalidatePath("/saude");
    revalidatePath("/dashboard");
    revalidatePath("/timeline");
    redirect("/documentos?success=archived");
  }

  const ocrResult = await processDocumentPipeline({
    familyId: family.id,
    documentId: intake.documentId,
  });

  revalidatePath("/documentos");
  revalidatePath("/dashboard");
  if (!ocrResult.ok) {
    redirect(
      `/documentos/${intake.documentId}/revisar?success=uploaded&warning=ocr_failed&reason=${encodeURIComponent(
        ocrResult.error.code
      )}`
    );
  }
  redirect(
    `/documentos/${intake.documentId}/revisar?success=${
      ocrResult.outcome === "manual" ? "uploaded_manual" : "uploaded_ocr"
    }`
  );
}

export async function confirmDocumentReview(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const documentId = (formData.get("document_id") as string | null) || "";
  if (!documentId) redirect("/documentos?error=missing_id");

  const { data: currentDocument, error: currentDocumentError } = await supabase
    .from("documents")
    .select("metadata, property_id")
    .eq("id", documentId)
    .eq("family_id", family.id)
    .maybeSingle();
  if (currentDocumentError || !currentDocument) {
    failDocument(
      currentDocumentError ?? new Error("document_not_found"),
      user.id,
      family.id,
      "confirm_review_read",
      "read_failed"
    );
  }
  const currentMetadata =
    currentDocument.metadata &&
    typeof currentDocument.metadata === "object" &&
    !Array.isArray(currentDocument.metadata)
      ? (currentDocument.metadata as Record<string, unknown>)
      : {};

  const documentType = normalizeDocumentType(formData.get("document_type") as string | null);
  const title =
    (formData.get("title") as string | null)?.trim() ||
    (documentType === "Documento Generico"
      ? "Documento"
      : `Documento ${documentType}`);
  const documentNumber = (formData.get("document_number") as string | null)?.trim() || null;
  const issuingAuthority = (formData.get("issuing_authority") as string | null)?.trim() || null;
  const country = (formData.get("country") as string | null)?.trim() || "Brasil";
  const issueDate = toDateOrNull((formData.get("issue_date") as string | null) || null);
  const expirationDate = toDateOrNull((formData.get("expiration_date") as string | null) || null);

  const extractedFields = {
    nome: (formData.get("nome") as string | null)?.trim() || null,
    numero: (formData.get("numero") as string | null)?.trim() || null,
    cpf: (formData.get("cpf") as string | null)?.trim() || null,
    rg: (formData.get("rg") as string | null)?.trim() || null,
    orgao_emissor: (formData.get("orgao_emissor") as string | null)?.trim() || null,
    pais: (formData.get("pais") as string | null)?.trim() || null,
    livro: (formData.get("livro") as string | null)?.trim() || null,
    folha: (formData.get("folha") as string | null)?.trim() || null,
    termo: (formData.get("termo") as string | null)?.trim() || null,
    matricula: (formData.get("matricula") as string | null)?.trim() || null,
    cartorio: (formData.get("cartorio") as string | null)?.trim() || null,
    data_emissao: toDateOrNull((formData.get("data_emissao") as string | null) || null),
    data_validade: toDateOrNull((formData.get("data_validade") as string | null) || null),
    data_nascimento: toDateOrNull(
      (formData.get("data_nascimento") as string | null) || null
    ),
    nacionalidade: (formData.get("nacionalidade") as string | null)?.trim() || null,
    naturalidade: (formData.get("naturalidade") as string | null)?.trim() || null,
    filiacao: (formData.get("filiacao") as string | null)?.trim() || null,
    valor_monetario: (formData.get("valor_monetario") as string | null)?.trim() || null,
    observacoes: (formData.get("observacoes") as string | null)?.trim() || null,
  };

  const { error } = await supabase
    .from("documents")
    .update({
      title,
      document_type: documentType,
      document_number: documentNumber,
      issuing_authority: issuingAuthority,
      country,
      issue_date: issueDate,
      expiration_date: expirationDate,
      status: "active",
      processing_status: DOCUMENT_STATUS.confirmed,
      review_required: false,
      last_ocr_error: null,
      metadata: {
        ...currentMetadata,
        ...extractedFields,
        intake_draft: false,
        intake_error: null,
      },
    })
    .eq("id", documentId)
    .eq("family_id", family.id);

  if (error) failDocument(error, user.id, family.id, "confirm_review", "confirm_failed");

  const { error: metadataError } = await supabase.from("document_metadata").upsert(
    {
      family_id: family.id,
      document_id: documentId,
      interpreted_fields: extractedFields,
      needs_review: false,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    },
    { onConflict: "document_id" }
  );
  if (metadataError) {
    failDocument(metadataError, user.id, family.id, "confirm_review_metadata", "confirm_failed");
  }

  const healthExamId =
    typeof currentMetadata.health_exam_id === "string"
      ? currentMetadata.health_exam_id
      : null;
  if (healthExamId) {
    const { data: healthExam } = await supabase
      .from("health_exams")
      .select("exam_name, performed_date, notes")
      .eq("id", healthExamId)
      .eq("family_id", family.id)
      .maybeSingle();
    if (healthExam) {
      await supabase
        .from("health_exams")
        .update({
          exam_name:
            healthExam.exam_name === "Exame em revisao"
              ? title
              : healthExam.exam_name,
          performed_date:
            healthExam.performed_date ??
            issueDate ??
            extractedFields.data_emissao,
          notes: healthExam.notes ?? extractedFields.observacoes,
        })
        .eq("id", healthExamId)
        .eq("family_id", family.id);
    }
  }

  await createDocumentAlerts({ familyId: family.id, documentId, title, expirationDate });

  await logTimelineEvent({
    familyId: family.id,
    eventType: "document_review_confirmed",
    affectedEntityType: "documents",
    affectedEntityId: documentId,
    source: "documentos.actions",
  });

  revalidatePath(`/documentos/${documentId}/revisar`);
  revalidatePath("/documentos");
  revalidatePath("/imoveis");
  revalidatePath("/saude");
  revalidatePath("/dashboard");
  if (currentDocument.property_id) {
    redirect("/imoveis?success=document_uploaded");
  }
  if (currentMetadata.intake_source === "saude.actions") {
    redirect("/saude?success=exam_created");
  }
  redirect("/documentos?success=confirmed");
}

export async function rejectDocumentReview(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const documentId = (formData.get("document_id") as string | null) || "";
  if (!documentId) redirect("/documentos?error=missing_id");

  const { data, error } = await supabase
    .from("documents")
    .update({
      processing_status: DOCUMENT_STATUS.rejected,
      review_required: true,
      last_ocr_error: "Documento rejeitado na revisao humana.",
    })
    .eq("id", documentId)
    .eq("family_id", family.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    failDocument(
      error ?? { code: "PGRST116", message: "document_not_found" },
      user.id,
      family.id,
      "reject_review",
      "update_failed"
    );
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: "document_review_rejected",
    affectedEntityType: "documents",
    affectedEntityId: documentId,
    source: "documentos.actions",
    priority: "high",
  });

  revalidatePath(`/documentos/${documentId}/revisar`);
  revalidatePath("/documentos");
  revalidatePath("/dashboard");
  redirect(`/documentos/${documentId}/revisar?success=rejected`);
}

export async function updateDocument(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canEditFamily(context)) {
    redirect("/documentos?error=permission_denied");
  }

  const documentId = (formData.get("document_id") as string | null) || "";
  if (!documentId) redirect("/documentos?error=missing_id");

  const { data: existingDoc, error: readError } = await supabase
    .from("documents")
    .select("id, property_id")
    .eq("id", documentId)
    .eq("family_id", family.id)
    .maybeSingle();

  if (readError) failDocument(readError, user.id, family.id, "read_for_update", "read_failed");
  if (!existingDoc) redirect("/documentos?error=not_found");

  const maybeFile = formData.get("file");
  if (maybeFile instanceof File && maybeFile.size > 0) {
    try {
      await intakeDocumentFile({
        familyId: family.id,
        userId: user.id,
        file: maybeFile,
        documentId,
        propertyId: existingDoc.property_id,
        ownerPersonId:
          (formData.get("owner_person_id") as string | null) || null,
        documentType: formData.get("document_type") as string | null,
        documentNumber: formData.get("document_number") as string | null,
        title: formData.get("title") as string | null,
        issueDate: toDateOrNull(
          (formData.get("issue_date") as string | null) || null
        ),
        expirationDate: toDateOrNull(
          (formData.get("expiration_date") as string | null) || null
        ),
        issuingAuthority: formData.get(
          "issuing_authority"
        ) as string | null,
        country: formData.get("country") as string | null,
        metadata: {
          observacoes:
            (formData.get("observacoes") as string | null)?.trim() || null,
        },
        source: "documentos.actions",
      });
    } catch (error) {
      failDocument(error, user.id, family.id, "update_intake", "update_failed");
    }
    const ocrResult = await processDocumentPipeline({
      familyId: family.id,
      documentId,
    });
    revalidatePath("/documentos");
    revalidatePath("/imoveis");
    revalidatePath("/dashboard");
    if (!ocrResult.ok) {
      redirect(
        `/documentos/${documentId}/revisar?success=uploaded&warning=ocr_failed&reason=${encodeURIComponent(
          ocrResult.error.code
        )}`
      );
    }
    redirect(
      `/documentos/${documentId}/revisar?success=${
        ocrResult.outcome === "manual" ? "uploaded_manual" : "uploaded_ocr"
      }`
    );
  }

  const title =
    (formData.get("title") as string | null)?.trim() || "Documento";
  const expirationDate = toDateOrNull(
    (formData.get("expiration_date") as string | null) || null
  );

  const { error } = await supabase
    .from("documents")
    .update({
      owner_person_id:
        (formData.get("owner_person_id") as string | null) || null,
      document_type: normalizeDocumentType(
        formData.get("document_type") as string | null
      ),
      document_number:
        (formData.get("document_number") as string | null)?.trim() || null,
      title,
      issue_date: toDateOrNull(
        (formData.get("issue_date") as string | null) || null
      ),
      expiration_date: expirationDate,
      issuing_authority:
        (formData.get("issuing_authority") as string | null)?.trim() || null,
      country:
        (formData.get("country") as string | null)?.trim() || "Brasil",
      metadata: {
        observacoes:
          (formData.get("observacoes") as string | null)?.trim() || null,
      },
    })
    .eq("id", documentId)
    .eq("family_id", family.id);
  if (error) {
    failDocument(error, user.id, family.id, "update", "update_failed");
  }

  await createDocumentAlerts({
    familyId: family.id,
    documentId,
    title,
    expirationDate,
  });

  await logTimelineEvent({
    familyId: family.id,
    eventType: existingDoc.property_id ? "property_document_updated" : "document_updated",
    affectedEntityType: "documents",
    affectedEntityId: documentId,
    source: "documentos.actions",
  });

  revalidatePath("/documentos");
  revalidatePath("/imoveis");
  revalidatePath("/dashboard");
  redirect("/documentos?success=updated");
}

export async function deleteDocument(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canAdminFamily(context)) redirect("/documentos?error=permission_denied");

  const documentId = (formData.get("document_id") as string | null) || "";
  if (!documentId) redirect("/documentos?error=missing_id");

  const { data: document, error: readError } = await supabase
    .from("documents")
    .select("storage_path, property_id")
    .eq("id", documentId)
    .eq("family_id", family.id)
    .maybeSingle();

  if (readError) failDocument(readError, user.id, family.id, "read_for_delete", "read_failed");
  if (!document) redirect("/documentos?error=not_found");

  const { data: deletedRows, error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("family_id", family.id)
    .select("id");
  if (deleteError || deletedRows?.length !== 1) {
    failDocument(deleteError ?? new Error("document_delete_returned_no_row"), user.id, family.id, "delete", "delete_failed");
  }

  if (document.storage_path && document.storage_path !== "pending") {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([document.storage_path]);
    if (storageError) {
      reportActionError({
        error: storageError,
        userId: user.id,
        familyId: family.id,
        module: "documentos",
        action: "delete_storage_after_record",
        fallback: "storage_failed",
      });
    }
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: document.property_id ? "property_document_deleted" : "document_deleted",
    affectedEntityType: "documents",
    affectedEntityId: documentId,
    source: "documentos.actions",
    priority: "high",
  });

  revalidatePath("/documentos");
  revalidatePath("/imoveis");
  revalidatePath("/dashboard");
  redirect("/documentos?success=deleted");
}
