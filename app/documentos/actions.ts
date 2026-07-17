"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorRedirectPath, reportActionError } from "@/lib/action-error";
import type { ActionErrorCode } from "@/lib/action-feedback";
import { canAdminFamily, getFamilyContext } from "@/lib/family/context";
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

type SimilarDocument = {
  id: string;
  version: number;
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

async function findSimilarDocument(params: {
  familyId: string;
  ownerPersonId: string | null;
  documentType: string;
  documentNumber: string | null;
  title: string;
}) {
  const supabase = createClient();

  let query = supabase
    .from("documents")
    .select("id, version")
    .eq("family_id", params.familyId)
    .eq("document_type", params.documentType)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  query = params.ownerPersonId ? query.eq("owner_person_id", params.ownerPersonId) : query.is("owner_person_id", null);
  query = params.documentNumber ? query.eq("document_number", params.documentNumber) : query.eq("title", params.title);

  const { data } = await query.maybeSingle();
  return (data ?? null) as SimilarDocument | null;
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

async function createDocumentAlerts(input: {
  familyId: string;
  documentId: string;
  title: string;
  expirationDate: string | null;
}) {
  const supabase = createClient();

  await supabase
    .from("alerts")
    .delete()
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

  const rows: Array<{ severity: "low" | "medium" | "high" | "critical"; title: string }> = [];

  if (diffDays < 0) {
    rows.push({ severity: "critical", title: `Documento vencido: ${input.title}` });
  } else {
    if (diffDays <= 90) rows.push({ severity: diffDays <= 30 ? "high" : "medium", title: `Documento vence em 90 dias: ${input.title}` });
    if (diffDays <= 30) rows.push({ severity: diffDays <= 7 ? "critical" : "high", title: `Documento vence em 30 dias: ${input.title}` });
    if (diffDays <= 7) rows.push({ severity: "critical", title: `Documento vence em 7 dias: ${input.title}` });
  }

  if (rows.length === 0) return;

  await supabase.from("alerts").insert(
    rows.map((row) => ({
      family_id: input.familyId,
      related_entity_type: "documents",
      related_entity_id: input.documentId,
      severity: row.severity,
      title: row.title,
      description: "Gerado automaticamente pelo processamento inteligente de documentos.",
      due_date: input.expirationDate,
      status: "pending",
    }))
  );
}

async function processDocumentPipeline(params: { familyId: string; documentId: string }) {
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
    const interpretedFields = { ...ocr.suggestion.fields };
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

export async function createDocument(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const title = (formData.get("title") as string | null)?.trim();
  const documentType = normalizeDocumentType(formData.get("document_type") as string | null);
  const ownerPersonId = (formData.get("owner_person_id") as string | null) || null;
  const documentNumber = (formData.get("document_number") as string | null)?.trim() || null;
  const issueDate = toDateOrNull((formData.get("issue_date") as string | null) || null);
  const expirationDate = toDateOrNull((formData.get("expiration_date") as string | null) || null);
  const issuingAuthority = (formData.get("issuing_authority") as string | null)?.trim() || null;
  const country = (formData.get("country") as string | null)?.trim() || "Brasil";
  const observacoes = (formData.get("observacoes") as string | null)?.trim() || null;
  const file = formData.get("file");

  if (!title || !(file instanceof File) || file.size === 0) redirect("/documentos?error=required_fields");
  if (file.size > getOcrConfig().maxFileSizeBytes) redirect("/documentos?error=file_too_large");
  if (!ALLOWED_MIME_TYPES.has(file.type)) redirect("/documentos?error=unsupported_file_type");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileHash = sha256(bytes);

  const storagePath = buildStoragePath({
    familyId: family.id,
    personId: ownerPersonId,
    documentType,
    fileName: file.name,
  });

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) failDocument(uploadError, user.id, family.id, "upload", "storage_failed");

  const similar = await findSimilarDocument({
    familyId: family.id,
    ownerPersonId,
    documentType,
    documentNumber,
    title,
  });

  let documentId = "";
  let version = 1;

  if (similar) {
    documentId = similar.id;
    version = (similar.version ?? 1) + 1;

    const { error } = await supabase
      .from("documents")
      .update({
        owner_person_id: ownerPersonId,
        document_type: documentType,
        document_number: documentNumber,
        title,
        issue_date: issueDate,
        expiration_date: expirationDate,
        issuing_authority: issuingAuthority,
        country,
        storage_provider: "supabase_storage",
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        version,
        is_current: true,
        status: "active",
        processing_status: DOCUMENT_STATUS.uploaded,
        review_required: true,
        last_ocr_error: null,
        metadata: { observacoes },
      })
      .eq("id", documentId)
      .eq("family_id", family.id);

    if (error) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      failDocument(error, user.id, family.id, "create_version", "update_failed");
    }
  } else {
    const { data, error } = await supabase
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
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type || "application/octet-stream",
        version: 1,
        is_current: true,
        status: "active",
        processing_status: DOCUMENT_STATUS.uploaded,
        review_required: true,
        last_ocr_error: null,
        metadata: { observacoes },
      })
      .select("id, version")
      .single();

    if (error || !data) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      failDocument(error ?? new Error("document_insert_returned_no_row"), user.id, family.id, "create", "create_failed");
    }
    documentId = data.id;
    version = data.version ?? 1;
  }

  try {
    await upsertVersion({
      familyId: family.id,
      documentId,
      version,
      storagePath,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      uploadedBy: user.id,
      fileHash,
    });
  } catch (error) {
    failDocument(error, user.id, family.id, "create_version_record", "create_failed");
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: "document_uploaded",
    affectedEntityType: "documents",
    affectedEntityId: documentId,
    source: "documentos.actions",
  });

  await createDocumentAlerts({
    familyId: family.id,
    documentId,
    title,
    expirationDate,
  });

  const ocrResult = await processDocumentPipeline({ familyId: family.id, documentId });

  revalidatePath("/documentos");
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

export async function confirmDocumentReview(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const documentId = (formData.get("document_id") as string | null) || "";
  if (!documentId) redirect("/documentos?error=missing_id");

  const documentType = normalizeDocumentType(formData.get("document_type") as string | null);
  const title = (formData.get("title") as string | null)?.trim() || `Documento ${documentType}`;
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
      processing_status: DOCUMENT_STATUS.confirmed,
      review_required: false,
      last_ocr_error: null,
      metadata: extractedFields,
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
  revalidatePath("/dashboard");
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

  const documentId = (formData.get("document_id") as string | null) || "";
  if (!documentId) redirect("/documentos?error=missing_id");

  const { data: existingDoc, error: readError } = await supabase
    .from("documents")
    .select("id, storage_path, version, property_id")
    .eq("id", documentId)
    .eq("family_id", family.id)
    .maybeSingle();

  if (readError) failDocument(readError, user.id, family.id, "read_for_update", "read_failed");
  if (!existingDoc) redirect("/documentos?error=not_found");

  let storagePath = existingDoc.storage_path;
  let nextVersion = existingDoc.version ?? 1;
  let uploadedNewVersion = false;

  const maybeFile = formData.get("file");

  if (maybeFile instanceof File && maybeFile.size > 0) {
    if (maybeFile.size > getOcrConfig().maxFileSizeBytes) {
      redirect("/documentos?error=file_too_large");
    }
    if (!ALLOWED_MIME_TYPES.has(maybeFile.type)) redirect("/documentos?error=unsupported_file_type");

    const normalizedType = normalizeDocumentType((formData.get("document_type") as string | null) ?? "Documento Generico");
    const ownerPersonId = (formData.get("owner_person_id") as string | null) || null;

    storagePath = buildStoragePath({
      familyId: family.id,
      personId: ownerPersonId,
      documentType: normalizedType,
      fileName: maybeFile.name,
    });

    const bytes = new Uint8Array(await maybeFile.arrayBuffer());
    const fileHash = sha256(bytes);

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, bytes, {
      contentType: maybeFile.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) failDocument(uploadError, user.id, family.id, "upload_version", "storage_failed");

    nextVersion = (existingDoc.version ?? 1) + 1;
    try {
      await upsertVersion({
        familyId: family.id,
        documentId,
        version: nextVersion,
        storagePath,
        fileName: maybeFile.name,
        mimeType: maybeFile.type || "application/octet-stream",
        uploadedBy: user.id,
        fileHash,
      });
      uploadedNewVersion = true;
    } catch (error) {
      await supabase.storage.from(BUCKET).remove([storagePath]);
      failDocument(error, user.id, family.id, "update_version_record", "update_failed");
    }
  }

  const { error } = await supabase
    .from("documents")
    .update({
      owner_person_id: (formData.get("owner_person_id") as string | null) || null,
      document_type: normalizeDocumentType(formData.get("document_type") as string | null),
      document_number: (formData.get("document_number") as string | null)?.trim() || null,
      title: (formData.get("title") as string | null)?.trim() || "Documento",
      issue_date: toDateOrNull((formData.get("issue_date") as string | null) || null),
      expiration_date: toDateOrNull((formData.get("expiration_date") as string | null) || null),
      issuing_authority: (formData.get("issuing_authority") as string | null)?.trim() || null,
      country: (formData.get("country") as string | null)?.trim() || "Brasil",
      storage_path: storagePath,
      version: nextVersion,
      file_name: maybeFile instanceof File && maybeFile.size > 0 ? maybeFile.name : undefined,
      mime_type: maybeFile instanceof File && maybeFile.size > 0 ? maybeFile.type || "application/octet-stream" : undefined,
      processing_status: maybeFile instanceof File && maybeFile.size > 0 ? DOCUMENT_STATUS.uploaded : undefined,
      review_required: maybeFile instanceof File && maybeFile.size > 0 ? true : undefined,
      last_ocr_error: maybeFile instanceof File && maybeFile.size > 0 ? null : undefined,
      metadata: {
        observacoes: (formData.get("observacoes") as string | null)?.trim() || null,
      },
    })
    .eq("id", documentId)
    .eq("family_id", family.id);

  if (error) {
    if (uploadedNewVersion) {
      await supabase
        .from("document_versions")
        .delete()
        .eq("family_id", family.id)
        .eq("document_id", documentId)
        .eq("version", nextVersion);
      await supabase
        .from("document_versions")
        .update({ is_current: true })
        .eq("family_id", family.id)
        .eq("document_id", documentId)
        .eq("version", existingDoc.version ?? 1);
      await supabase.storage.from(BUCKET).remove([storagePath]);
    }
    failDocument(error, user.id, family.id, "update", "update_failed");
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: existingDoc.property_id ? "property_document_updated" : "document_updated",
    affectedEntityType: "documents",
    affectedEntityId: documentId,
    source: "documentos.actions",
  });

  if (maybeFile instanceof File && maybeFile.size > 0) {
    void processDocumentPipeline({ familyId: family.id, documentId });
  }

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
