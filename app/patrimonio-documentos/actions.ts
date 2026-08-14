"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  intakeDocumentFile,
  processDocumentPipeline,
} from "@/app/documentos/actions";
import { reportActionError } from "@/lib/action-error";
import type { ActionErrorCode } from "@/lib/action-feedback";
import {
  getPropertyDocumentFiles,
  getPropertyDocumentTitle,
  isArchiveWithoutOcr,
  MAX_PROPERTY_ARCHIVE_FILES,
  validateUploadedPropertyDocuments,
} from "@/lib/document-intake/property-files";
import {
  canAdminFamily,
  canEditFamily,
  getFamilyContext,
} from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline/log-event";

const DOCUMENTS_BUCKET = "family-documents";

type AssetEntityType = "vehicle" | "insurance_policy";

const ENTITY_CONFIG = {
  vehicle: {
    table: "vehicles",
    column: "vehicle_id",
    route: "/automoveis",
    source: "automoveis.actions",
  },
  insurance_policy: {
    table: "insurance_policies",
    column: "insurance_policy_id",
    route: "/seguros",
    source: "seguros.actions",
  },
} as const;

function parseEntityType(value: FormDataEntryValue | null): AssetEntityType | null {
  return value === "vehicle" || value === "insurance_policy" ? value : null;
}

function linkPayload(type: AssetEntityType, id: string) {
  return type === "vehicle"
    ? { vehicle_id: id, insurance_policy_id: null }
    : { vehicle_id: null, insurance_policy_id: id };
}

function intakeLink(type: AssetEntityType, id: string) {
  return type === "vehicle"
    ? { vehicleId: id }
    : { insurancePolicyId: id };
}

function fail(
  error: unknown,
  userId: string,
  familyId: string,
  type: AssetEntityType,
  action: string,
  fallback: ActionErrorCode
): never {
  const config = ENTITY_CONFIG[type];
  const result = reportActionError({
    error,
    userId,
    familyId,
    module: type === "vehicle" ? "automoveis" : "seguros",
    action,
    fallback,
  });
  const params = new URLSearchParams({
    error: result.code,
    request_id: result.requestId,
  });
  redirect(`${config.route}?${params.toString()}`);
}

async function assertEntity(
  type: AssetEntityType,
  id: string,
  familyId: string
) {
  const config = ENTITY_CONFIG[type];
  const { data, error } = await createClient()
    .from(config.table)
    .select("id")
    .eq("id", id)
    .eq("family_id", familyId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) throw error ?? new Error("not_found");
}

function revalidateEntityPaths(type: AssetEntityType) {
  revalidatePath(ENTITY_CONFIG[type].route);
  revalidatePath("/documentos");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
}

export async function createAssetDocument(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const type = parseEntityType(formData.get("entity_type"));
  if (!type) redirect("/dashboard?error=required_fields");
  const config = ENTITY_CONFIG[type];
  if (!canEditFamily(context)) redirect(`${config.route}?error=permission_denied`);

  const entityId = String(formData.get("entity_id") ?? "");
  const files = getPropertyDocumentFiles(formData);
  const archiveWithoutOcr = isArchiveWithoutOcr(formData);
  if (!entityId || files.length === 0) {
    redirect(`${config.route}?error=required_fields`);
  }
  if (files.length > MAX_PROPERTY_ARCHIVE_FILES) {
    redirect(`${config.route}?error=too_many_files`);
  }
  if (!archiveWithoutOcr && files.length > 1) {
    redirect(`${config.route}?error=multiple_files_require_archive`);
  }

  try {
    await assertEntity(type, entityId, family.id);
  } catch (error) {
    fail(error, user.id, family.id, type, "validate_document_entity", "not_found");
  }

  const title = String(formData.get("title") ?? "").trim() || null;
  const documentType = String(formData.get("document_type") ?? "").trim() || null;
  const documentIds: string[] = [];
  try {
    for (const file of files) {
      const intake = await intakeDocumentFile({
        familyId: family.id,
        userId: user.id,
        file,
        ...intakeLink(type, entityId),
        documentType,
        title: getPropertyDocumentTitle({
          requestedTitle: title,
          fileName: file.name,
          totalFiles: files.length,
        }),
        issueDate: String(formData.get("issue_date") ?? "") || null,
        expirationDate: String(formData.get("expiration_date") ?? "") || null,
        country: "Brasil",
        skipOcr: archiveWithoutOcr,
        metadata: {
          observacoes: String(formData.get("observacoes") ?? "").trim() || null,
        },
        source: config.source,
      });
      documentIds.push(intake.documentId);
    }
  } catch (error) {
    fail(error, user.id, family.id, type, "intake_asset_document", "create_failed");
  }

  revalidateEntityPaths(type);
  if (archiveWithoutOcr) {
    redirect(`${config.route}?success=documents_archived&count=${documentIds.length}`);
  }

  const documentId = documentIds[0];
  const ocrResult = await processDocumentPipeline({
    familyId: family.id,
    documentId,
  });
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

export async function finalizeArchivedAssetDocuments(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const type = parseEntityType(formData.get("entity_type"));
  if (!user || !family || !type || !canEditFamily(context)) {
    return { ok: false as const, code: "permission_denied" as const };
  }

  const entityId = String(formData.get("entity_id") ?? "");
  if (!entityId) return { ok: false as const, code: "missing_id" as const };

  let uploadedValue: unknown;
  try {
    uploadedValue = JSON.parse(String(formData.get("uploaded_files") ?? "null"));
  } catch {
    return { ok: false as const, code: "invalid_file" as const };
  }
  const validation = validateUploadedPropertyDocuments(uploadedValue, family.id);
  if (!validation.ok) return { ok: false as const, code: validation.code };

  try {
    await assertEntity(type, entityId, family.id);
  } catch {
    return { ok: false as const, code: "not_found" as const };
  }

  const supabase = createClient();
  const requestedTitle = String(formData.get("title") ?? "").trim() || null;
  const documentType =
    String(formData.get("document_type") ?? "").trim() || "Documento Generico";
  const issueDate = String(formData.get("issue_date") ?? "") || null;
  const expirationDate = String(formData.get("expiration_date") ?? "") || null;
  const observacoes = String(formData.get("observacoes") ?? "").trim() || null;
  const createdDocumentIds: string[] = [];

  try {
    for (const file of validation.files) {
      const downloaded = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .download(file.storagePath);
      if (downloaded.error || !downloaded.data) {
        throw downloaded.error ?? new Error("storage_download_failed");
      }
      const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
      if (bytes.byteLength !== file.size) throw new Error("uploaded_file_size_mismatch");

      const { data: document, error: documentError } = await supabase
        .from("documents")
        .insert({
          family_id: family.id,
          owner_person_id: null,
          property_id: null,
          ...linkPayload(type, entityId),
          document_type: documentType,
          document_number: null,
          title: getPropertyDocumentTitle({
            requestedTitle,
            fileName: file.fileName,
            totalFiles: validation.files.length,
          }),
          issue_date: issueDate,
          expiration_date: expirationDate,
          issuing_authority: null,
          country: "Brasil",
          storage_provider: "supabase_storage",
          storage_path: file.storagePath,
          file_name: file.fileName,
          mime_type: file.mimeType,
          version: 1,
          is_current: true,
          status: "active",
          processing_status: "Confirmado",
          review_required: false,
          last_ocr_error: null,
          metadata: {
            observacoes,
            intake_draft: false,
            intake_source: ENTITY_CONFIG[type].source,
            archived_without_ocr: true,
            intake_error: null,
          },
        })
        .select("id")
        .single();
      if (documentError || !document) {
        throw documentError ?? new Error("document_not_created");
      }
      createdDocumentIds.push(document.id);

      const { error: versionError } = await supabase.from("document_versions").insert({
        family_id: family.id,
        document_id: document.id,
        version: 1,
        storage_path: file.storagePath,
        file_name: file.fileName,
        mime_type: file.mimeType,
        file_hash_sha256: createHash("sha256").update(bytes).digest("hex"),
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString(),
        is_current: true,
      });
      if (versionError) throw versionError;

      await logTimelineEvent({
        familyId: family.id,
        eventType: type === "vehicle" ? "vehicle_document_uploaded" : "insurance_document_uploaded",
        affectedEntityType: "documents",
        affectedEntityId: document.id,
        source: ENTITY_CONFIG[type].source,
      });
    }
  } catch (error) {
    if (createdDocumentIds.length > 0) {
      await supabase
        .from("documents")
        .delete()
        .eq("family_id", family.id)
        .in("id", createdDocumentIds);
    }
    await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .remove(validation.files.map((file) => file.storagePath));
    const reported = reportActionError({
      error,
      userId: user.id,
      familyId: family.id,
      module: type === "vehicle" ? "automoveis" : "seguros",
      action: "finalize_archived_asset_documents",
      fallback: "create_failed",
    });
    return { ok: false as const, code: reported.code, requestId: reported.requestId };
  }

  revalidateEntityPaths(type);
  return { ok: true as const, count: createdDocumentIds.length };
}

export async function deleteAssetDocument(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  const type = parseEntityType(formData.get("entity_type"));
  if (!type) redirect("/dashboard?error=missing_id");
  const config = ENTITY_CONFIG[type];
  if (!canAdminFamily(context)) redirect(`${config.route}?error=permission_denied`);

  const documentId = String(formData.get("document_id") ?? "");
  const entityId = String(formData.get("entity_id") ?? "");
  if (!documentId || !entityId) redirect(`${config.route}?error=missing_id`);

  const supabase = createClient();
  const { data: document, error: readError } = await supabase
    .from("documents")
    .select(`id, storage_path, ${config.column}`)
    .eq("id", documentId)
    .eq("family_id", family.id)
    .eq(config.column, entityId)
    .maybeSingle();
  if (readError || !document) {
    fail(readError ?? new Error("not_found"), user.id, family.id, type, "read_asset_document", "not_found");
  }

  const { data: deleted, error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("family_id", family.id)
    .select("id");
  if (deleteError || deleted?.length !== 1) {
    fail(deleteError ?? new Error("delete_failed"), user.id, family.id, type, "delete_asset_document", "delete_failed");
  }

  if (document.storage_path && document.storage_path !== "pending") {
    const { error: storageError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .remove([document.storage_path]);
    if (storageError) {
      reportActionError({
        error: storageError,
        userId: user.id,
        familyId: family.id,
        module: type === "vehicle" ? "automoveis" : "seguros",
        action: "delete_asset_document_storage",
        fallback: "storage_failed",
      });
    }
  }

  revalidateEntityPaths(type);
  redirect(`${config.route}?success=document_deleted`);
}
