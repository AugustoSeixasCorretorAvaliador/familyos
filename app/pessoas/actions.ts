"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorRedirectPath, reportActionError } from "@/lib/action-error";
import type { ActionErrorCode } from "@/lib/action-feedback";
import {
  canAdminFamily,
  canEditFamily,
  getFamilyContext,
} from "@/lib/family/context";
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

const ALLOWED_PERSON_STATUSES = new Set(["active", "inactive", "pending"]);
const ALLOWED_ACCESS_ROLES = new Set(["admin", "member", "viewer"]);
const ALLOWED_ACCESS_STATUSES = new Set(["active", "suspended", "revoked"]);

type PersonStatus = "active" | "inactive" | "pending";
type AccessRole = "admin" | "member" | "viewer";
type AccessStatus = "active" | "suspended" | "revoked";

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

export async function updatePerson(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canEditFamily(context)) redirect("/pessoas?error=permission_denied");

  const id = normalizeOptionalText(formData.get("id"));
  const firstName = normalizeOptionalText(formData.get("first_name"));
  const lastName = normalizeOptionalText(formData.get("last_name"));
  const familyRole = normalizeOptionalText(formData.get("family_role"));
  const email = normalizeOptionalText(formData.get("email"))?.toLowerCase() ?? null;
  const requestedStatus = normalizeOptionalText(formData.get("status")) ?? "active";

  if (
    !id ||
    !firstName ||
    !lastName ||
    !familyRole ||
    !ALLOWED_FAMILY_ROLES.has(familyRole) ||
    !ALLOWED_PERSON_STATUSES.has(requestedStatus)
  ) {
    redirect("/pessoas?error=required_fields");
  }
  const status = requestedStatus as PersonStatus;

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    redirect("/pessoas?error=required_fields");
  }

  if (email) {
    const { data: duplicate, error: duplicateError } = await supabase
      .from("people")
      .select("id")
      .eq("family_id", family.id)
      .is("deleted_at", null)
      .neq("id", id)
      .ilike("email", email)
      .limit(1)
      .maybeSingle();

    if (duplicateError) {
      failPerson(
        duplicateError,
        user.id,
        family.id,
        "check_update_duplicate_email",
        "read_failed"
      );
    }
    if (duplicate) redirect("/pessoas?error=duplicate");
  }

  const { data: updated, error } = await supabase
    .from("people")
    .update({
      first_name: firstName,
      last_name: lastName,
      birth_date: normalizeOptionalText(formData.get("birth_date")),
      email,
      phone: normalizeOptionalText(formData.get("phone")),
      family_role: familyRole,
      status,
    })
    .eq("id", id)
    .eq("family_id", family.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    failPerson(
      error ?? { code: "PGRST116", message: "person_not_found" },
      user.id,
      family.id,
      "update_person",
      "update_failed"
    );
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: "person_updated",
    affectedEntityType: "people",
    affectedEntityId: id,
    source: "pessoas.actions",
  });

  revalidatePath("/pessoas");
  revalidatePath("/documentos");
  revalidatePath("/saude");
  revalidatePath("/dashboard");
  redirect("/pessoas?success=person_updated");
}

export async function updatePersonAccess(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canAdminFamily(context)) redirect("/pessoas?error=permission_denied");

  const personId = normalizeOptionalText(formData.get("person_id"));
  const requestedRole = normalizeOptionalText(formData.get("access_role"));
  const requestedStatus = normalizeOptionalText(formData.get("access_status"));

  if (
    !personId ||
    !requestedRole ||
    !requestedStatus ||
    !ALLOWED_ACCESS_ROLES.has(requestedRole) ||
    !ALLOWED_ACCESS_STATUSES.has(requestedStatus)
  ) {
    redirect("/pessoas?error=required_fields");
  }
  const role = requestedRole as AccessRole;
  const status = requestedStatus as AccessStatus;

  const { data: membership, error: membershipError } = await supabase
    .from("family_members")
    .select("id, user_id, role, status")
    .eq("family_id", family.id)
    .eq("person_id", personId)
    .maybeSingle();

  if (membershipError || !membership) {
    failPerson(
      membershipError ?? { code: "PGRST116", message: "membership_not_found" },
      user.id,
      family.id,
      "read_person_access",
      "not_found"
    );
  }

  if (membership.user_id === user.id) {
    redirect("/pessoas?error=self_access_protected");
  }

  if (
    membership.status === "active" &&
    (membership.role === "owner" || membership.role === "admin") &&
    (status !== "active" || role !== "admin")
  ) {
    const { count, error: countError } = await supabase
      .from("family_members")
      .select("id", { count: "exact", head: true })
      .eq("family_id", family.id)
      .eq("status", "active")
      .in("role", ["owner", "admin"])
      .neq("id", membership.id);

    if (countError) {
      failPerson(
        countError,
        user.id,
        family.id,
        "count_family_admins",
        "read_failed"
      );
    }
    if ((count ?? 0) === 0) redirect("/pessoas?error=last_admin_required");
  }

  const { data: updated, error } = await supabase
    .from("family_members")
    .update({
      role,
      status,
      joined_at: status === "active" ? membership.status === "active" ? undefined : new Date().toISOString() : undefined,
    })
    .eq("id", membership.id)
    .eq("family_id", family.id)
    .select("id")
    .maybeSingle();

  if (error || !updated) {
    failPerson(
      error ?? { code: "PGRST116", message: "membership_not_found" },
      user.id,
      family.id,
      "update_person_access",
      "update_failed"
    );
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: status === "revoked" ? "family_member_access_revoked" : "family_member_access_updated",
    affectedEntityType: "family_members",
    affectedEntityId: membership.id,
    source: "pessoas.actions",
  });

  revalidatePath("/pessoas");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  redirect(`/pessoas?success=${status === "revoked" ? "access_revoked" : "access_updated"}`);
}
