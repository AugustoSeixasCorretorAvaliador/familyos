"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionErrorCode } from "@/lib/action-feedback";
import { errorRedirectPath, reportActionError } from "@/lib/action-error";
import { canAdminFamily, getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline/log-event";

const DOCUMENTS_BUCKET = "family-documents";
const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024;
const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/tiff",
]);

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

function sanitizePathPart(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "documento";
}

function toNumberOrNull(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const raw = value.trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function readOwnerIds(formData: FormData) {
  return formData
    .getAll("owner_ids")
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
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

  const ownerIds = readOwnerIds(formData);
  if (ownerIds.length > 0) {
    const rows = ownerIds.map((personId) => ({
      property_id: insertedProperty.id,
      person_id: personId,
      ownership_percentage: null,
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

  const ownerIds = readOwnerIds(formData);
  if (ownerIds.length > 0) {
    const rows = ownerIds.map((personId) => ({
      property_id: propertyId,
      person_id: personId,
      ownership_percentage: null,
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
  const title = (formData.get("title") as string | null)?.trim();
  const documentType = (formData.get("document_type") as string | null)?.trim();
  const file = formData.get("file");

  if (!propertyId || !title || !documentType || !(file instanceof File) || file.size === 0) {
    redirect("/imoveis?error=required_fields");
  }
  if (file.size > MAX_DOCUMENT_SIZE) redirect("/imoveis?error=file_too_large");
  if (!ALLOWED_DOCUMENT_TYPES.has(file.type)) {
    redirect("/imoveis?error=unsupported_file_type");
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

  const storedName = `${Date.now()}-${randomUUID()}-${sanitizePathPart(file.name)}`;
  const storagePath = [
    family.id,
    propertyId,
    sanitizePathPart(documentType),
    storedName,
  ].join("/");
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) {
    failProperty(
      uploadError,
      user.id,
      family.id,
      "upload_property_document",
      "storage_failed"
    );
  }

  const { data: document, error: documentError } = await supabase
    .from("documents")
    .insert({
      family_id: family.id,
      property_id: propertyId,
      owner_person_id: null,
      document_type: documentType,
      document_number: null,
      title,
      issue_date: (formData.get("issue_date") as string | null) || null,
      expiration_date: (formData.get("expiration_date") as string | null) || null,
      issuing_authority: null,
      country: "Brasil",
      storage_provider: "supabase_storage",
      storage_path: storagePath,
      file_name: file.name,
      mime_type: file.type,
      version: 1,
      is_current: true,
      status: "active",
      processing_status: "Enviado",
      review_required: true,
      metadata: {
        observacoes: (formData.get("observacoes") as string | null)?.trim() || null,
      },
    })
    .select("id")
    .single();

  if (documentError || !document) {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
    failProperty(
      documentError ?? new Error("property_document_not_returned"),
      user.id,
      family.id,
      "create_property_document",
      "create_failed"
    );
  }

  const { error: versionError } = await supabase.from("document_versions").insert({
    family_id: family.id,
    document_id: document.id,
    version: 1,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type,
    file_hash_sha256: createHash("sha256").update(bytes).digest("hex"),
    uploaded_by: user.id,
    uploaded_at: new Date().toISOString(),
    is_current: true,
  });
  if (versionError) {
    failProperty(
      versionError,
      user.id,
      family.id,
      "create_property_document_version",
      "create_failed"
    );
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: "property_document_uploaded",
    affectedEntityType: "documents",
    affectedEntityId: document.id,
    source: "imoveis.actions",
    newState: {
      property_id: propertyId,
      document_type: documentType,
    },
  });

  revalidatePath("/imoveis");
  revalidatePath("/documentos");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  redirect("/imoveis?success=document_uploaded");
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
