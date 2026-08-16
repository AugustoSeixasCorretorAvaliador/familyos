"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  intakeDocumentFile,
  processDocumentPipeline,
} from "@/app/documentos/actions";
import type { ActionErrorCode } from "@/lib/action-feedback";
import { errorRedirectPath, reportActionError } from "@/lib/action-error";
import {
  getPropertyDocumentFiles,
  getPropertyDocumentTitle,
  isArchiveWithoutOcr,
  MAX_PROPERTY_ARCHIVE_FILES,
  validateUploadedPropertyDocuments,
} from "@/lib/document-intake/property-files";
import { canAdminFamily, getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline/log-event";

const DOCUMENTS_BUCKET = "family-documents";
function failProperty(
  error: unknown,
  userId: string,
  familyId: string,
  action: string,
  fallback: ActionErrorCode
): never {
  const result = reportActionError({
    error,
    userId,
    familyId,
    module: "imoveis",
    action,
    fallback,
  });
  redirect(errorRedirectPath("/imoveis", result));
}

function toNumberOrNull(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const raw = value.trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function readOwners(formData: FormData) {
  const ownerIds = formData
    .getAll("owner_ids")
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  const owners = ownerIds.map((personId) => ({
    person_id: personId,
    ownership_percentage: toNumberOrNull(formData.get(`ownership_percentage_${personId}`)),
  }));
  const knownTotal = owners.reduce((sum, owner) => sum + (owner.ownership_percentage ?? 0), 0);
  if (owners.some((owner) => owner.ownership_percentage !== null && (owner.ownership_percentage < 0 || owner.ownership_percentage > 100)) || knownTotal > 100.0001) {
    redirect("/imoveis?error=invalid_percentage");
  }
  return owners;
}

export async function createProperty(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const title = (formData.get("title") as string | null)?.trim();
  const address = (formData.get("address") as string | null)?.trim();

  if (!title || !address) {
    redirect("/imoveis?error=required_fields");
  }

  const metadata = {
    situacao: (formData.get("situacao") as string | null) ?? "Proprio",
    valor_estimado: toNumberOrNull(formData.get("valor_estimado")),
    renda_mensal: toNumberOrNull(formData.get("renda_mensal")),
    condominio: toNumberOrNull(formData.get("condominio")),
    iptu: toNumberOrNull(formData.get("iptu")),
    observacoes: (formData.get("observacoes") as string | null)?.trim() ?? null,
  };

  const owners = readOwners(formData);
  const { data: insertedProperty, error } = await supabase
    .from("properties")
    .insert({
      family_id: family.id,
      title,
      address,
      city: (formData.get("city") as string | null)?.trim() || null,
      state: (formData.get("state") as string | null)?.trim() || null,
      postal_code: (formData.get("postal_code") as string | null)?.trim() || null,
      property_type: (formData.get("property_type") as string | null)?.trim() || null,
      registry_number: (formData.get("registry_number") as string | null)?.trim() || null,
      status: "active",
      metadata,
      outstanding_debt: toNumberOrNull(formData.get("outstanding_debt")),
      valuation_date: (formData.get("valuation_date") as string | null) || null,
      valuation_source: (formData.get("valuation_source") as string | null)?.trim() || null,
      ownership_review_status: owners.length > 0 && owners.every((owner) => owner.ownership_percentage !== null) ? "confirmed" : "review_required",
    })
    .select("id")
    .single();

  if (error || !insertedProperty) {
    failProperty(
      error ?? new Error("property_not_returned"),
      user.id,
      family.id,
      "create_property",
      "create_failed"
    );
  }

  if (owners.length > 0) {
    const rows = owners.map((owner) => ({
      property_id: insertedProperty.id,
      ...owner,
    }));
    const { error: ownersError } = await supabase.from("property_owners").insert(rows);
    if (ownersError) {
      failProperty(
        ownersError,
        user.id,
        family.id,
        "create_property_owners",
        "create_failed"
      );
    }
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: "property_created",
    affectedEntityType: "properties",
    affectedEntityId: insertedProperty.id,
    source: "imoveis.actions",
  });

  revalidatePath("/imoveis");
  revalidatePath("/dashboard");
  redirect("/imoveis?success=created");
}

export async function updateProperty(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const propertyId = formData.get("property_id") as string | null;
  if (!propertyId) {
    redirect("/imoveis?error=missing_id");
  }

  const title = (formData.get("title") as string | null)?.trim();
  const address = (formData.get("address") as string | null)?.trim();

  if (!title || !address) {
    redirect("/imoveis?error=required_fields");
  }

  const metadata = {
    situacao: (formData.get("situacao") as string | null) ?? "Proprio",
    valor_estimado: toNumberOrNull(formData.get("valor_estimado")),
    renda_mensal: toNumberOrNull(formData.get("renda_mensal")),
    condominio: toNumberOrNull(formData.get("condominio")),
    iptu: toNumberOrNull(formData.get("iptu")),
    observacoes: (formData.get("observacoes") as string | null)?.trim() ?? null,
  };

  const owners = readOwners(formData);
  const { data, error } = await supabase
    .from("properties")
    .update({
      title,
      address,
      city: (formData.get("city") as string | null)?.trim() || null,
      state: (formData.get("state") as string | null)?.trim() || null,
      postal_code: (formData.get("postal_code") as string | null)?.trim() || null,
      property_type: (formData.get("property_type") as string | null)?.trim() || null,
      registry_number: (formData.get("registry_number") as string | null)?.trim() || null,
      metadata,
      outstanding_debt: toNumberOrNull(formData.get("outstanding_debt")),
      valuation_date: (formData.get("valuation_date") as string | null) || null,
      valuation_source: (formData.get("valuation_source") as string | null)?.trim() || null,
      ownership_review_status: owners.length > 0 && owners.every((owner) => owner.ownership_percentage !== null) ? "confirmed" : "review_required",
    })
    .eq("id", propertyId)
    .eq("family_id", family.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    failProperty(
      error ?? { code: "PGRST116", message: "property_not_found" },
      user.id,
      family.id,
      "update_property",
      "update_failed"
    );
  }

  const { error: clearOwnersError } = await supabase
    .from("property_owners")
    .delete()
    .eq("property_id", propertyId);
  if (clearOwnersError) {
    failProperty(
      clearOwnersError,
      user.id,
      family.id,
      "clear_property_owners",
      "update_failed"
    );
  }

  if (owners.length > 0) {
    const rows = owners.map((owner) => ({
      property_id: propertyId,
      ...owner,
    }));
    const { error: ownersError } = await supabase.from("property_owners").insert(rows);
    if (ownersError) {
      failProperty(
        ownersError,
        user.id,
        family.id,
        "update_property_owners",
        "update_failed"
      );
    }
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: "property_updated",
    affectedEntityType: "properties",
    affectedEntityId: propertyId,
    source: "imoveis.actions",
  });

  revalidatePath("/imoveis");
  revalidatePath("/dashboard");
  redirect("/imoveis?success=updated");
}

export async function deleteProperty(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canAdminFamily(context)) redirect("/imoveis?error=permission_denied");

  const propertyId = formData.get("property_id") as string | null;
  if (!propertyId) {
    redirect("/imoveis?error=missing_id");
  }

  const { data, error } = await supabase
    .from("properties")
    .delete()
    .eq("id", propertyId)
    .eq("family_id", family.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    failProperty(
      error ?? { code: "PGRST116", message: "property_not_found" },
      user.id,
      family.id,
      "delete_property",
      "delete_failed"
    );
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: "property_deleted",
    affectedEntityType: "properties",
    affectedEntityId: propertyId,
    source: "imoveis.actions",
    priority: "high",
  });

  revalidatePath("/imoveis");
  revalidatePath("/dashboard");
  redirect("/imoveis?success=deleted");
}

export async function createPropertyDocument(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const propertyId = formData.get("property_id") as string | null;
  const title = (formData.get("title") as string | null)?.trim() || null;
  const documentType =
    (formData.get("document_type") as string | null)?.trim() || null;
  const files = getPropertyDocumentFiles(formData);
  const archiveWithoutOcr = isArchiveWithoutOcr(formData);

  if (!propertyId || files.length === 0) {
    redirect("/imoveis?error=required_fields");
  }
  if (files.length > MAX_PROPERTY_ARCHIVE_FILES) {
    redirect("/imoveis?error=too_many_files");
  }
  if (!archiveWithoutOcr && files.length > 1) {
    redirect("/imoveis?error=multiple_files_require_archive");
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("family_id", family.id)
    .maybeSingle();
  if (propertyError || !property) {
    failProperty(
      propertyError ?? { code: "PGRST116", message: "property_not_found" },
      user.id,
      family.id,
      "validate_property_document",
      "not_found"
    );
  }

  const documentIds: string[] = [];
  try {
    for (const file of files) {
      const intake = await intakeDocumentFile({
        familyId: family.id,
        userId: user.id,
        file,
        propertyId,
        documentType,
        title: getPropertyDocumentTitle({
          requestedTitle: title,
          fileName: file.name,
          totalFiles: files.length,
        }),
        issueDate: (formData.get("issue_date") as string | null) || null,
        expirationDate:
          (formData.get("expiration_date") as string | null) || null,
        country: "Brasil",
        skipOcr: archiveWithoutOcr,
        metadata: {
          observacoes:
            (formData.get("observacoes") as string | null)?.trim() || null,
        },
        source: "imoveis.actions",
      });
      documentIds.push(intake.documentId);
    }
  } catch (error) {
    failProperty(
      error,
      user.id,
      family.id,
      "intake_property_document",
      "create_failed"
    );
  }

  if (archiveWithoutOcr) {
    revalidatePath("/imoveis");
    revalidatePath("/documentos");
    revalidatePath("/dashboard");
    revalidatePath("/timeline");
    redirect(`/imoveis?success=documents_archived&count=${documentIds.length}`);
  }

  const documentId = documentIds[0];
  const ocrResult = await processDocumentPipeline({
    familyId: family.id,
    documentId,
  });

  revalidatePath("/imoveis");
  revalidatePath("/documentos");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
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

export async function finalizeArchivedPropertyDocuments(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user || !family) {
    return { ok: false as const, code: "permission_denied" as const };
  }

  const propertyId = (formData.get("property_id") as string | null) || "";
  if (!propertyId) {
    return { ok: false as const, code: "missing_id" as const };
  }

  let uploadedValue: unknown;
  try {
    uploadedValue = JSON.parse(
      (formData.get("uploaded_files") as string | null) || "null"
    );
  } catch {
    return { ok: false as const, code: "invalid_file" as const };
  }
  const validation = validateUploadedPropertyDocuments(uploadedValue, family.id);
  if (!validation.ok) {
    return { ok: false as const, code: validation.code };
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("family_id", family.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (propertyError || !property) {
    return { ok: false as const, code: "not_found" as const };
  }

  const requestedTitle =
    (formData.get("title") as string | null)?.trim() || null;
  const documentType =
    (formData.get("document_type") as string | null)?.trim() ||
    "Documento Generico";
  const issueDate = (formData.get("issue_date") as string | null) || null;
  const expirationDate =
    (formData.get("expiration_date") as string | null) || null;
  const observacoes =
    (formData.get("observacoes") as string | null)?.trim() || null;
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
      if (bytes.byteLength !== file.size) {
        throw new Error("uploaded_file_size_mismatch");
      }

      const title = getPropertyDocumentTitle({
        requestedTitle,
        fileName: file.fileName,
        totalFiles: validation.files.length,
      });
      const { data: document, error: documentError } = await supabase
        .from("documents")
        .insert({
          family_id: family.id,
          owner_person_id: null,
          property_id: propertyId,
          document_type: documentType,
          document_number: null,
          title,
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
            intake_source: "imoveis.actions",
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

      const { error: versionError } = await supabase
        .from("document_versions")
        .insert({
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
        eventType: "property_document_uploaded",
        affectedEntityType: "documents",
        affectedEntityId: document.id,
        source: "imoveis.actions",
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
      module: "imoveis",
      action: "finalize_archived_property_documents",
      fallback: "create_failed",
    });
    return {
      ok: false as const,
      code: reported.code,
      requestId: reported.requestId,
    };
  }

  revalidatePath("/imoveis");
  revalidatePath("/documentos");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  return { ok: true as const, count: createdDocumentIds.length };
}

export async function deletePropertyDocument(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canAdminFamily(context)) redirect("/imoveis?error=permission_denied");

  const documentId = formData.get("document_id") as string | null;
  if (!documentId) redirect("/imoveis?error=missing_id");

  const { data: document, error: readError } = await supabase
    .from("documents")
    .select("id, property_id, storage_path")
    .eq("id", documentId)
    .eq("family_id", family.id)
    .not("property_id", "is", null)
    .maybeSingle();
  if (readError || !document) {
    failProperty(
      readError ?? { code: "PGRST116", message: "property_document_not_found" },
      user.id,
      family.id,
      "read_property_document",
      "not_found"
    );
  }

  const { data: deletedRows, error: deleteError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("family_id", family.id)
    .select("id");
  if (deleteError || deletedRows?.length !== 1) {
    failProperty(
      deleteError ?? new Error("property_document_delete_returned_no_row"),
      user.id,
      family.id,
      "delete_property_document",
      "delete_failed"
    );
  }

  const { error: storageError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([document.storage_path]);
  if (storageError) {
    reportActionError({
      error: storageError,
      userId: user.id,
      familyId: family.id,
      module: "imoveis",
      action: "delete_property_document_storage_after_record",
      fallback: "storage_failed",
    });
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: "property_document_deleted",
    affectedEntityType: "documents",
    affectedEntityId: documentId,
    source: "imoveis.actions",
    priority: "high",
    previousState: { property_id: document.property_id },
  });

  revalidatePath("/imoveis");
  revalidatePath("/documentos");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  redirect("/imoveis?success=document_deleted");
}
