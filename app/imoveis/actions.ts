"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline/log-event";

function toNumberOrNull(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const normalized = value.replace(".", "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function readOwnerIds(formData: FormData) {
  return formData
    .getAll("owner_ids")
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

export async function createProperty(formData: FormData) {
  const { user, family } = await getFamilyContext();
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
    redirect("/imoveis?error=create_failed");
  }

  const ownerIds = readOwnerIds(formData);
  if (ownerIds.length > 0) {
    const rows = ownerIds.map((personId) => ({
      property_id: insertedProperty.id,
      person_id: personId,
      ownership_percentage: null,
    }));
    await supabase.from("property_owners").insert(rows);
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
  const { user, family } = await getFamilyContext();
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

  const { error } = await supabase
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
    .eq("family_id", family.id);

  if (error) {
    redirect("/imoveis?error=update_failed");
  }

  await supabase.from("property_owners").delete().eq("property_id", propertyId);

  const ownerIds = readOwnerIds(formData);
  if (ownerIds.length > 0) {
    const rows = ownerIds.map((personId) => ({
      property_id: propertyId,
      person_id: personId,
      ownership_percentage: null,
    }));
    await supabase.from("property_owners").insert(rows);
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
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const propertyId = formData.get("property_id") as string | null;
  if (!propertyId) {
    redirect("/imoveis?error=missing_id");
  }

  await supabase.from("properties").delete().eq("id", propertyId).eq("family_id", family.id);

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
