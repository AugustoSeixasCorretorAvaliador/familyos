"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorRedirectPath, reportActionError } from "@/lib/action-error";
import type { ActionErrorCode } from "@/lib/action-feedback";
import { canEditFamily, getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline/log-event";

const ALLOWED_FAMILY_ROLES = new Set([
  "Pet",
  "Dependente",
  "Filho(a)",
  "Cônjuge",
  "Pai/Mãe",
  "Familiar",
  "Outro",
]);

function failPerson(
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
    module: "pessoas",
    action,
    fallback,
  });
  redirect(errorRedirectPath("/pessoas", result));
}

function normalizeOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  return value.trim() || null;
}

export async function createPerson(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canEditFamily(context)) redirect("/pessoas?error=permission_denied");

  const firstName = normalizeOptionalText(formData.get("first_name"));
  const lastName = normalizeOptionalText(formData.get("last_name"));
  const familyRole = normalizeOptionalText(formData.get("family_role"));
  const email = normalizeOptionalText(formData.get("email"))?.toLowerCase() ?? null;

  if (
    !firstName ||
    !lastName ||
    !familyRole ||
    !ALLOWED_FAMILY_ROLES.has(familyRole)
  ) {
    redirect("/pessoas?error=required_fields");
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/pessoas?error=required_fields");
  }

  if (email) {
    const { data: existingPeople, error: duplicateCheckError } = await supabase
      .from("people")
      .select("id, email")
      .eq("family_id", family.id)
      .is("deleted_at", null);

    if (duplicateCheckError) {
      failPerson(
        duplicateCheckError,
        user.id,
        family.id,
        "check_duplicate_email",
        "read_failed"
      );
    }

    if (
      existingPeople?.some(
        (person) => person.email?.trim().toLowerCase() === email
      )
    ) {
      redirect("/pessoas?error=duplicate");
    }
  }

  const { data: createdPerson, error } = await supabase
    .from("people")
    .insert({
      family_id: family.id,
      first_name: firstName,
      last_name: lastName,
      birth_date: normalizeOptionalText(formData.get("birth_date")),
      email,
      phone: normalizeOptionalText(formData.get("phone")),
      family_role: familyRole,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !createdPerson) {
    failPerson(
      error ?? new Error("person_not_returned"),
      user.id,
      family.id,
      "create_person",
      "create_failed"
    );
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: familyRole === "Pet" ? "pet_created" : "person_created",
    affectedEntityType: "people",
    affectedEntityId: createdPerson.id,
    source: "pessoas.actions",
  });

  revalidatePath("/pessoas");
  revalidatePath("/documentos");
  revalidatePath("/saude");
  revalidatePath("/dashboard");
  redirect(
    `/pessoas?success=${familyRole === "Pet" ? "pet_created" : "person_created"}`
  );
}
