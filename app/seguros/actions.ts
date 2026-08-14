"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorRedirectPath, reportActionError } from "@/lib/action-error";
import type { ActionErrorCode } from "@/lib/action-feedback";
import { canAdminFamily, canEditFamily, getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline/log-event";

const INSURANCE_TYPES = new Set(["vehicle", "property", "personal", "life", "health", "travel", "card", "other"]);
const POLICY_STATUS = new Set(["pending", "active", "expired", "cancelled", "archived"]);
const PAYMENT_FREQUENCIES = new Set(["single", "monthly", "quarterly", "semiannual", "annual", "other"]);
const TARGETS = {
  person: { table: "people", column: "person_id" },
  property: { table: "properties", column: "property_id" },
  vehicle: { table: "vehicles", column: "vehicle_id" },
  credit_card: { table: "credit_cards", column: "credit_card_id" },
} as const;
type TargetType = keyof typeof TARGETS;

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim() || null;
}

function money(formData: FormData, name: string) {
  const raw = String(formData.get(name) ?? "").trim();
  if (!raw) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) throw new Error("invalid_amount");
  return value;
}

function fail(error: unknown, userId: string, familyId: string, action: string, fallback: ActionErrorCode): never {
  redirect(errorRedirectPath("/seguros", reportActionError({ error, userId, familyId, module: "seguros", action, fallback })));
}

function policyPayload(formData: FormData) {
  const title = text(formData, "title");
  const insuranceType = String(formData.get("insurance_type") ?? "");
  const insurer = text(formData, "insurer");
  const startDate = text(formData, "start_date");
  const endDate = text(formData, "end_date");
  if (!title || !insurer || !startDate || !endDate || !INSURANCE_TYPES.has(insuranceType)) throw new Error("required_fields");
  if (endDate < startDate) throw new Error("invalid_dates");
  const status = String(formData.get("status") ?? "active");
  const paymentFrequency = text(formData, "payment_frequency");
  if (!POLICY_STATUS.has(status) || (paymentFrequency && !PAYMENT_FREQUENCIES.has(paymentFrequency))) throw new Error("invalid_status");
  return {
    title,
    insurance_type: insuranceType,
    policy_number: text(formData, "policy_number"),
    insurer,
    broker: text(formData, "broker"),
    start_date: startDate,
    end_date: endDate,
    insured_amount: money(formData, "insured_amount"),
    premium_amount: money(formData, "premium_amount"),
    deductible_amount: money(formData, "deductible_amount"),
    payment_frequency: paymentFrequency,
    status,
    insured_description: text(formData, "insured_description"),
    notes: text(formData, "notes"),
  };
}

function parseTarget(formData: FormData) {
  const raw = String(formData.get("insured_target") ?? "");
  if (!raw) return null;
  const separator = raw.indexOf(":");
  if (separator < 1) throw new Error("invalid_target");
  const type = raw.slice(0, separator) as TargetType;
  const id = raw.slice(separator + 1);
  if (!(type in TARGETS) || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error("invalid_target");
  return { type, id };
}

async function validateTarget(target: { type: TargetType; id: string }, familyId: string) {
  const config = TARGETS[target.type];
  const { data, error } = await createClient().from(config.table).select("id").eq("id", target.id).eq("family_id", familyId).is("deleted_at", null).maybeSingle();
  if (error || !data) throw error ?? new Error("not_found");
}

function linkPayload(policyId: string, familyId: string, target: { type: TargetType; id: string }) {
  return {
    family_id: familyId,
    policy_id: policyId,
    target_type: target.type,
    person_id: target.type === "person" ? target.id : null,
    property_id: target.type === "property" ? target.id : null,
    vehicle_id: target.type === "vehicle" ? target.id : null,
    credit_card_id: target.type === "credit_card" ? target.id : null,
  };
}

export async function createInsurancePolicy(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canEditFamily(context)) redirect("/seguros?error=permission_denied");
  let policyId = "";
  try {
    const target = parseTarget(formData);
    if (target) await validateTarget(target, family.id);
    const db = createClient();
    const { data, error } = await db.from("insurance_policies").insert({ family_id: family.id, ...policyPayload(formData) }).select("id").single();
    if (error || !data) throw error ?? new Error("create_failed");
    policyId = data.id;
    if (target) {
      const { error: linkError } = await db.from("insurance_policy_links").insert(linkPayload(policyId, family.id, target));
      if (linkError) throw linkError;
    }
    await logTimelineEvent({ familyId: family.id, eventType: "insurance_policy_created", affectedEntityType: "insurance_policies", affectedEntityId: policyId, source: "seguros.actions" });
  } catch (error) {
    if (policyId) await createClient().from("insurance_policies").update({ status: "archived", deleted_at: new Date().toISOString() }).eq("id", policyId).eq("family_id", family.id);
    fail(error, user.id, family.id, "create_insurance_policy", "create_failed");
  }
  revalidatePath("/seguros");
  revalidatePath("/dashboard");
  redirect("/seguros?success=created");
}

export async function updateInsurancePolicy(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canEditFamily(context)) redirect("/seguros?error=permission_denied");
  const id = String(formData.get("policy_id") ?? "");
  if (!id) redirect("/seguros?error=missing_id");
  try {
    const target = parseTarget(formData);
    if (target) await validateTarget(target, family.id);
    const db = createClient();
    const { data, error } = await db.from("insurance_policies").update(policyPayload(formData)).eq("id", id).eq("family_id", family.id).is("deleted_at", null).select("id").maybeSingle();
    if (error || !data) throw error ?? new Error("not_found");
    const { error: clearError } = await db.from("insurance_policy_links").delete().eq("policy_id", id).eq("family_id", family.id);
    if (clearError) throw clearError;
    if (target) {
      const { error: linkError } = await db.from("insurance_policy_links").insert(linkPayload(id, family.id, target));
      if (linkError) throw linkError;
    }
    await logTimelineEvent({ familyId: family.id, eventType: "insurance_policy_updated", affectedEntityType: "insurance_policies", affectedEntityId: id, source: "seguros.actions" });
  } catch (error) {
    fail(error, user.id, family.id, "update_insurance_policy", "update_failed");
  }
  revalidatePath("/seguros");
  revalidatePath("/dashboard");
  redirect("/seguros?success=updated");
}

export async function archiveInsurancePolicy(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canAdminFamily(context)) redirect("/seguros?error=permission_denied");
  const id = String(formData.get("policy_id") ?? "");
  if (!id) redirect("/seguros?error=missing_id");
  const { data, error } = await createClient().from("insurance_policies").update({ status: "archived", deleted_at: new Date().toISOString() }).eq("id", id).eq("family_id", family.id).is("deleted_at", null).select("id").maybeSingle();
  if (error || !data) fail(error ?? new Error("not_found"), user.id, family.id, "archive_insurance_policy", "delete_failed");
  await logTimelineEvent({ familyId: family.id, eventType: "insurance_policy_archived", affectedEntityType: "insurance_policies", affectedEntityId: id, source: "seguros.actions", priority: "high" });
  revalidatePath("/seguros");
  revalidatePath("/dashboard");
  redirect("/seguros?success=archived");
}
