import { AppError } from "../utils/errors";
import { createSupabaseAdminClient } from "../providers/supabase.provider";
import { BaseService } from "./base.service";
import {
  buildStoragePath,
  createDocumentAlerts,
  decodeUpload,
  DOCUMENT_STATUS,
  assertAllowedMime,
  interpretOcrText,
  logTimeline,
  runOcr,
  sha256,
} from "./document-processing.service";

export class DocumentsService extends BaseService {
  async listDocuments() {
    const { data, error } = await this.db()
      .from("documents")
      .select("id, title, document_type, document_number, expiration_date, processing_status")
      .eq("family_id", this.auth.familyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw new AppError(error.message, 500);
    return data ?? [];
  }

  async getDocument(id: string) {
    const { data, error } = await this.db()
      .from("documents")
      .select("*")
      .eq("id", id)
      .eq("family_id", this.auth.familyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new AppError(error.message, 500);
    if (!data) throw new AppError("Document not found", 404);
    return data;
  }

  async listExpiringDocuments(days = 90) {
    const end = new Date();
    end.setDate(end.getDate() + days);

    const { data, error } = await this.db()
      .from("documents")
      .select("id, title, document_type, expiration_date")
      .eq("family_id", this.auth.familyId)
      .is("deleted_at", null)
      .not("expiration_date", "is", null)
      .lte("expiration_date", end.toISOString().slice(0, 10))
      .order("expiration_date", { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return data ?? [];
  }

  async uploadDocument(input: {
    personId?: string | null;
    documentType: string;
    title?: string;
    documentNumber?: string;
    issueDate?: string;
    expirationDate?: string;
    issuingAuthority?: string;
    country?: string;
    observations?: string;
    fileName: string;
    mimeType: string;
    contentBase64: string;
  }) {
    assertAllowedMime(input.mimeType);
    const bytes = decodeUpload(input.contentBase64);
    const fileHash = sha256(bytes);
    const storagePath = buildStoragePath({
      familyId: this.auth.familyId,
      personId: input.personId,
      documentType: input.documentType,
      fileName: input.fileName,
    });
    const admin = this.adminDb();

    if (input.personId) {
      const { data: person, error } = await admin
        .from("people")
        .select("id")
        .eq("id", input.personId)
        .eq("family_id", this.auth.familyId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw new AppError(error.message, 500, "SUPABASE_ERROR", true);
      if (!person) throw new AppError("Person not found in family", 404, "DOCUMENT_NOT_FOUND");
    }

    const upload = await admin.storage.from("family-documents").upload(storagePath, bytes, {
      contentType: input.mimeType,
      upsert: false,
    });
    if (upload.error) throw new AppError(upload.error.message, 500, "SUPABASE_ERROR", true);

    const title = input.title ?? input.fileName;
    const { data: existing } = await admin
      .from("documents")
      .select("id, version")
      .eq("family_id", this.auth.familyId)
      .eq("document_type", input.documentType)
      .eq("file_name", input.fileName)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let documentId: string;
    let version = 1;
    if (existing) {
      documentId = existing.id;
      version = (existing.version ?? 1) + 1;
      const { error } = await admin
        .from("documents")
        .update({
          owner_person_id: input.personId ?? null,
          document_type: input.documentType,
          document_number: input.documentNumber ?? null,
          title,
          issue_date: input.issueDate ?? null,
          expiration_date: input.expirationDate ?? null,
          issuing_authority: input.issuingAuthority ?? null,
          country: input.country ?? "Brasil",
          storage_provider: "supabase_storage",
          storage_path: storagePath,
          file_name: input.fileName,
          mime_type: input.mimeType,
          version,
          is_current: true,
          status: "active",
          processing_status: DOCUMENT_STATUS.uploaded,
          review_required: true,
          last_ocr_error: null,
          metadata: { observacoes: input.observations ?? null },
        })
        .eq("id", documentId)
        .eq("family_id", this.auth.familyId);
      if (error) throw new AppError(error.message, 500, "SUPABASE_ERROR", true);
    } else {
      const { data, error } = await admin
        .from("documents")
        .insert({
          family_id: this.auth.familyId,
          owner_person_id: input.personId ?? null,
          document_type: input.documentType,
          document_number: input.documentNumber ?? null,
          title,
          issue_date: input.issueDate ?? null,
          expiration_date: input.expirationDate ?? null,
          issuing_authority: input.issuingAuthority ?? null,
          country: input.country ?? "Brasil",
          storage_provider: "supabase_storage",
          storage_path: storagePath,
          file_name: input.fileName,
          mime_type: input.mimeType,
          version,
          is_current: true,
          status: "active",
          processing_status: DOCUMENT_STATUS.uploaded,
          review_required: true,
          metadata: { observacoes: input.observations ?? null },
        })
        .select("id")
        .single();
      if (error || !data) throw new AppError(error?.message ?? "Document creation failed", 500, "SUPABASE_ERROR", true);
      documentId = data.id;
    }

    await admin.from("document_versions").update({ is_current: false }).eq("family_id", this.auth.familyId).eq("document_id", documentId);
    await admin.from("document_versions").insert({
      family_id: this.auth.familyId,
      document_id: documentId,
      version,
      storage_path: storagePath,
      file_name: input.fileName,
      mime_type: input.mimeType,
      file_hash_sha256: fileHash,
      uploaded_by: this.auth.userId,
      is_current: true,
    });
    await createDocumentAlerts({ familyId: this.auth.familyId, documentId, title, expirationDate: input.expirationDate });
    await logTimeline(this.auth.familyId, "document_uploaded", documentId);

    return {
      documentId,
      version,
      fileHashSha256: fileHash,
      storagePath,
      status: DOCUMENT_STATUS.uploaded,
      next: "Call process_document or reprocess_document to run OCR.",
    };
  }

  async processDocument(input: { documentId: string; reprocess?: boolean }) {
    const admin = this.adminDb();
    const { data: document, error } = await admin
      .from("documents")
      .select("id, storage_path, file_name, mime_type")
      .eq("id", input.documentId)
      .eq("family_id", this.auth.familyId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw new AppError(error.message, 500, "SUPABASE_ERROR", true);
    if (!document?.storage_path) throw new AppError("Document not found", 404, "DOCUMENT_NOT_FOUND");

    const { data: job, error: jobError } = await admin
      .from("document_ocr_jobs")
      .insert({
        family_id: this.auth.familyId,
        document_id: input.documentId,
        provider: "mcp",
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (jobError || !job) throw new AppError(jobError?.message ?? "OCR job creation failed", 500, "SUPABASE_ERROR", true);

    await admin.from("documents").update({
      processing_status: DOCUMENT_STATUS.processing,
      last_ocr_error: null,
    }).eq("id", input.documentId).eq("family_id", this.auth.familyId);
    await logTimeline(this.auth.familyId, "document_ocr_started", input.documentId);

    try {
      const downloaded = await admin.storage.from("family-documents").download(document.storage_path);
      if (downloaded.error || !downloaded.data) throw new AppError("Failed to download document for OCR", 500, "SUPABASE_ERROR", true);

      const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
      const ocr = await runOcr({
        fileName: document.file_name ?? `${input.documentId}.bin`,
        mimeType: document.mime_type ?? "application/octet-stream",
        bytes,
      });
      const interpreted = await interpretOcrText(ocr.text);
      const status = ocr.text ? DOCUMENT_STATUS.waitingReview : DOCUMENT_STATUS.ocrError;

      await admin.from("document_metadata").upsert({
        family_id: this.auth.familyId,
        document_id: input.documentId,
        extracted_text: ocr.text,
        interpreted_fields: interpreted.suggestion.fields,
        confidence_by_field: interpreted.suggestion.confidenceByField,
        overall_confidence: interpreted.suggestion.overallConfidence,
        needs_review: true,
      }, { onConflict: "document_id" });

      await admin.from("documents").update({
        processing_status: status,
        ai_provider: interpreted.provider,
        ocr_provider: ocr.provider,
        ocr_confidence: Number((ocr.confidence * 100).toFixed(2)),
        review_required: true,
        last_ocr_at: new Date().toISOString(),
        last_ocr_error: ocr.text ? null : (ocr.warning ?? "OCR returned no text"),
      }).eq("id", input.documentId).eq("family_id", this.auth.familyId);

      await admin.from("document_ocr_jobs").update({
        status: ocr.text ? "completed" : "failed",
        provider: ocr.provider,
        confidence: Number((ocr.confidence * 100).toFixed(2)),
        duration_ms: ocr.durationMs,
        extracted_text: ocr.text,
        suggestion_json: interpreted.suggestion,
        error_message: ocr.text ? null : (ocr.warning ?? "OCR returned no text"),
        finished_at: new Date().toISOString(),
      }).eq("id", job.id).eq("family_id", this.auth.familyId);

      await logTimeline(this.auth.familyId, ocr.text ? "document_ocr_completed" : "document_ocr_failed", input.documentId, ocr.text ? "medium" : "high");

      return {
        documentId: input.documentId,
        jobId: job.id,
        status,
        provider: ocr.provider,
        confidence: ocr.confidence,
        reviewRequired: true,
        warning: ocr.warning,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "OCR failed";
      await admin.from("documents").update({
        processing_status: DOCUMENT_STATUS.ocrError,
        review_required: true,
        last_ocr_error: message,
      }).eq("id", input.documentId).eq("family_id", this.auth.familyId);
      await admin.from("document_ocr_jobs").update({
        status: "failed",
        error_message: message,
        finished_at: new Date().toISOString(),
      }).eq("id", job.id).eq("family_id", this.auth.familyId);
      await logTimeline(this.auth.familyId, "document_ocr_failed", input.documentId, "high");
      throw error;
    }
  }

  async getOcrJob(jobId: string) {
    const { data, error } = await this.db()
      .from("document_ocr_jobs")
      .select("id, document_id, provider, status, confidence, duration_ms, suggestion_json, error_message, started_at, finished_at, created_at")
      .eq("id", jobId)
      .eq("family_id", this.auth.familyId)
      .maybeSingle();
    if (error) throw new AppError(error.message, 500, "SUPABASE_ERROR", true);
    if (!data) throw new AppError("OCR job not found", 404, "DOCUMENT_NOT_FOUND");
    return data;
  }

  async confirmDocument(input: { documentId: string; fields?: Record<string, unknown> }) {
    const fields = input.fields ?? {};
    const title = String(fields.title ?? fields.nome ?? "Documento confirmado");
    const expirationDate = typeof fields.data_validade === "string" ? fields.data_validade : null;
    const admin = this.adminDb();
    const { error } = await admin.from("documents").update({
      title,
      document_type: String(fields.document_type ?? fields.tipo ?? "Documento Generico"),
      document_number: fields.numero ? String(fields.numero) : null,
      expiration_date: expirationDate,
      processing_status: DOCUMENT_STATUS.confirmed,
      review_required: false,
      last_ocr_error: null,
      metadata: fields,
    }).eq("id", input.documentId).eq("family_id", this.auth.familyId);
    if (error) throw new AppError(error.message, 500, "SUPABASE_ERROR", true);

    await admin.from("document_metadata").upsert({
      family_id: this.auth.familyId,
      document_id: input.documentId,
      interpreted_fields: fields,
      needs_review: false,
      reviewed_by: this.auth.userId,
      reviewed_at: new Date().toISOString(),
    }, { onConflict: "document_id" });
    await createDocumentAlerts({ familyId: this.auth.familyId, documentId: input.documentId, title, expirationDate });
    await logTimeline(this.auth.familyId, "document_review_confirmed", input.documentId);
    return { documentId: input.documentId, status: DOCUMENT_STATUS.confirmed };
  }

  async rejectDocument(input: { documentId: string; reason?: string }) {
    const { error } = await this.adminDb().from("documents").update({
      processing_status: DOCUMENT_STATUS.rejected,
      review_required: true,
      last_ocr_error: input.reason ?? "Document rejected by MCP review.",
    }).eq("id", input.documentId).eq("family_id", this.auth.familyId);
    if (error) throw new AppError(error.message, 500, "SUPABASE_ERROR", true);
    await logTimeline(this.auth.familyId, "document_review_rejected", input.documentId, "high");
    return { documentId: input.documentId, status: DOCUMENT_STATUS.rejected };
  }

  private adminDb() {
    if (this.auth.role !== "owner" && this.auth.role !== "admin" && this.auth.role !== "member") {
      throw new AppError("Family editor role is required for privileged document operations", 403, "FORBIDDEN");
    }
    return createSupabaseAdminClient();
  }
}
