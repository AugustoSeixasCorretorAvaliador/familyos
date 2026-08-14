"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorRedirectPath, reportActionError } from "@/lib/action-error";
import type { ActionErrorCode } from "@/lib/action-feedback";
import { canAdminFamily, canEditFamily, getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline/log-event";

function text(formData: FormData, name: string, required = false) {
  const value = String(formData.get(name) ?? "").trim();
  return value || (required ? null : null);
}

function numberValue(formData: FormData, name: string) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error("invalid_amount");
  return parsed;
}

function yearValue(formData: FormData, name: string) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1886 || parsed > 2200) {
    throw new Error("invalid_year");
  }
  return parsed;
}

function fail(
  error: unknown,
  userId: string,
  familyId: string,
  action: string,
  fallback: ActionErrorCode
): never {
  redirect(
    errorRedirectPath(
      "/automoveis",
      reportActionError({ error, userId, familyId, module: "automoveis", action, fallback })
    )
  );
}

function vehiclePayload(formData: FormData) {
  const title = text(formData, "title", true);
  const make = text(formData, "make", true);
  const model = text(formData, "model", true);
  if (!title || !make || !model) throw new Error("required_fields");

  const status = String(formData.get("status") ?? "active");
  if (!new Set(["active", "financed", "sold", "archived"]).has(status)) {
    throw new Error("invalid_status");
  }
  return {
    title,
    make,
    model,
    version: text(formData, "version"),
    manufacture_year: yearValue(formData, "manufacture_year"),
    model_year: yearValue(formData, "model_year"),
    plate: text(formData, "plate")?.toUpperCase() ?? null,
    renavam: text(formData, "renavam"),
    vin: text(formData, "vin")?.toUpperCase() ?? null,
    color: text(formData, "color"),
    fuel_type: text(formData, "fuel_type"),
    acquisition_date: text(formData, "acquisition_date"),
    acquisition_value: numberValue(formData, "acquisition_value"),
    estimated_value: numberValue(formData, "estimated_value"),
    owner_person_id: text(formData, "owner_person_id"),
    status,
    notes: text(formData, "notes"),
  };
}

export async function createVehicle(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canEditFamily(context)) redirect("/automoveis?error=permission_denied");

  try {
    const payload = vehiclePayload(formData);
    const { data, error } = await createClient()
      .from("vehicles")
      .insert({ family_id: family.id, ...payload })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("create_failed");
    await logTimelineEvent({
      familyId: family.id,
      eventType: "vehicle_created",
      affectedEntityType: "vehicles",
      affectedEntityId: data.id,
      source: "automoveis.actions",
    });
  } catch (error) {
    fail(error, user.id, family.id, "create_vehicle", "create_failed");
  }
  revalidatePath("/automoveis");
  revalidatePath("/dashboard");
  redirect("/automoveis?success=created");
}

export async function updateVehicle(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canEditFamily(context)) redirect("/automoveis?error=permission_denied");
  const id = String(formData.get("vehicle_id") ?? "");
  if (!id) redirect("/automoveis?error=missing_id");

  try {
    const { data, error } = await createClient()
      .from("vehicles")
      .update(vehiclePayload(formData))
      .eq("id", id)
      .eq("family_id", family.id)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error || !data) throw error ?? new Error("not_found");
    await logTimelineEvent({
      familyId: family.id,
      eventType: "vehicle_updated",
      affectedEntityType: "vehicles",
      affectedEntityId: id,
      source: "automoveis.actions",
    });
  } catch (error) {
    fail(error, user.id, family.id, "update_vehicle", "update_failed");
  }
  revalidatePath("/automoveis");
  revalidatePath("/dashboard");
  redirect("/automoveis?success=updated");
}

export async function archiveVehicle(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canAdminFamily(context)) redirect("/automoveis?error=permission_denied");
  const id = String(formData.get("vehicle_id") ?? "");
  if (!id) redirect("/automoveis?error=missing_id");

  const { data, error } = await createClient()
    .from("vehicles")
    .update({ status: "archived", deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("family_id", family.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    fail(error ?? new Error("not_found"), user.id, family.id, "archive_vehicle", "delete_failed");
  }
  await logTimelineEvent({
    familyId: family.id,
    eventType: "vehicle_archived",
    affectedEntityType: "vehicles",
    affectedEntityId: id,
    source: "automoveis.actions",
    priority: "high",
  });
  revalidatePath("/automoveis");
  revalidatePath("/dashboard");
  redirect("/automoveis?success=archived");
}
