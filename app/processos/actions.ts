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

export async function createLegalCase(formData: FormData) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) redirect("/processos?error=required_fields");

  const { data: inserted, error } = await supabase
    .from("legal_cases")
    .insert({
      family_id: family.id,
      case_number: (formData.get("case_number") as string | null)?.trim() || null,
      title,
      case_type: (formData.get("case_type") as string | null)?.trim() || null,
      person_id: (formData.get("person_id") as string | null) || null,
      court: (formData.get("court") as string | null)?.trim() || null,
      start_date: (formData.get("start_date") as string | null) || null,
      lawyer: (formData.get("lawyer") as string | null)?.trim() || null,
      claim_value: toNumberOrNull(formData.get("claim_value")),
      expected_value: toNumberOrNull(formData.get("expected_value")),
      last_update: (formData.get("last_update") as string | null)?.trim() || null,
      last_update_date: (formData.get("last_update_date") as string | null) || null,
      status: (formData.get("status") as string | null) || "Ativo",
      notes: (formData.get("notes") as string | null)?.trim() || null,
    })
    .select("id")
    .single();

  if (error || !inserted) redirect("/processos?error=create_failed");

  await logTimelineEvent({
    familyId: family.id,
    eventType: "legal_case_created",
    affectedEntityType: "legal_cases",
    affectedEntityId: inserted.id,
    source: "processos.actions",
  });

  revalidatePath("/processos");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  redirect("/processos?success=created");
}

export async function updateLegalCase(formData: FormData) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const id = formData.get("id") as string | null;
  const title = (formData.get("title") as string | null)?.trim();
  if (!id || !title) redirect("/processos?error=required_fields");

  const { error } = await supabase
    .from("legal_cases")
    .update({
      case_number: (formData.get("case_number") as string | null)?.trim() || null,
      title,
      case_type: (formData.get("case_type") as string | null)?.trim() || null,
      person_id: (formData.get("person_id") as string | null) || null,
      court: (formData.get("court") as string | null)?.trim() || null,
      start_date: (formData.get("start_date") as string | null) || null,
      lawyer: (formData.get("lawyer") as string | null)?.trim() || null,
      claim_value: toNumberOrNull(formData.get("claim_value")),
      expected_value: toNumberOrNull(formData.get("expected_value")),
      last_update: (formData.get("last_update") as string | null)?.trim() || null,
      last_update_date: (formData.get("last_update_date") as string | null) || null,
      status: (formData.get("status") as string | null) || "Ativo",
      notes: (formData.get("notes") as string | null)?.trim() || null,
    })
    .eq("id", id)
    .eq("family_id", family.id);

  if (error) redirect("/processos?error=update_failed");

  await logTimelineEvent({
    familyId: family.id,
    eventType: "legal_case_updated",
    affectedEntityType: "legal_cases",
    affectedEntityId: id,
    source: "processos.actions",
  });

  revalidatePath("/processos");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  redirect("/processos?success=updated");
}

export async function deleteLegalCase(formData: FormData) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const id = formData.get("id") as string | null;
  if (!id) redirect("/processos?error=missing_id");

  await supabase.from("legal_cases").delete().eq("id", id).eq("family_id", family.id);

  await logTimelineEvent({
    familyId: family.id,
    eventType: "legal_case_deleted",
    affectedEntityType: "legal_cases",
    affectedEntityId: id,
    source: "processos.actions",
  });

  revalidatePath("/processos");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  redirect("/processos?success=deleted");
}
