"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionErrorCode } from "@/lib/action-feedback";
import { errorRedirectPath, reportActionError } from "@/lib/action-error";
import { canAdminFamily, getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline/log-event";

function failTask(
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
    module: "tarefas",
    action,
    fallback,
  });
  redirect(errorRedirectPath("/tarefas", result));
}

export async function createTask(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) redirect("/tarefas?error=required_fields");

  const { data: inserted, error } = await supabase
    .from("family_tasks")
    .insert({
      family_id: family.id,
      title,
      description: (formData.get("description") as string | null)?.trim() || null,
      responsible_person_id: (formData.get("responsible_person_id") as string | null) || null,
      category: (formData.get("category") as string | null)?.trim() || null,
      priority: (formData.get("priority") as string | null) || "Media",
      status: (formData.get("status") as string | null) || "A fazer",
      due_date: (formData.get("due_date") as string | null) || null,
      related_person_id: (formData.get("related_person_id") as string | null) || null,
      related_property_id: (formData.get("related_property_id") as string | null) || null,
      related_document_id: (formData.get("related_document_id") as string | null) || null,
      related_legal_case_id: (formData.get("related_legal_case_id") as string | null) || null,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    failTask(
      error ?? new Error("task_not_returned"),
      user.id,
      family.id,
      "create_task",
      "create_failed"
    );
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: "task_created",
    affectedEntityType: "family_tasks",
    affectedEntityId: inserted.id,
    source: "tarefas.actions",
  });

  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  redirect("/tarefas?success=created");
}

export async function updateTask(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const id = formData.get("id") as string | null;
  if (!id) redirect("/tarefas?error=missing_id");

  const title = (formData.get("title") as string | null)?.trim();
  if (!title) redirect("/tarefas?error=required_fields");

  const status = (formData.get("status") as string | null) || "A fazer";

  const { data, error } = await supabase
    .from("family_tasks")
    .update({
      title,
      description: (formData.get("description") as string | null)?.trim() || null,
      responsible_person_id: (formData.get("responsible_person_id") as string | null) || null,
      category: (formData.get("category") as string | null)?.trim() || null,
      priority: (formData.get("priority") as string | null) || "Media",
      status,
      due_date: (formData.get("due_date") as string | null) || null,
      related_person_id: (formData.get("related_person_id") as string | null) || null,
      related_property_id: (formData.get("related_property_id") as string | null) || null,
      related_document_id: (formData.get("related_document_id") as string | null) || null,
      related_legal_case_id: (formData.get("related_legal_case_id") as string | null) || null,
      completed_at: status === "Concluida" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("family_id", family.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    failTask(
      error ?? { code: "PGRST116", message: "task_not_found" },
      user.id,
      family.id,
      "update_task",
      "update_failed"
    );
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: status === "Concluida" ? "task_completed" : "task_updated",
    affectedEntityType: "family_tasks",
    affectedEntityId: id,
    source: "tarefas.actions",
  });

  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  redirect("/tarefas?success=updated");
}

export async function toggleTaskStatus(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const id = formData.get("id") as string | null;
  const action = formData.get("action") as string | null;
  if (!id || !action) redirect("/tarefas?error=missing_id");

  const status = action === "complete" ? "Concluida" : "Em andamento";

  const { data, error } = await supabase
    .from("family_tasks")
    .update({
      status,
      completed_at: action === "complete" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("family_id", family.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    failTask(
      error ?? { code: "PGRST116", message: "task_not_found" },
      user.id,
      family.id,
      "toggle_task",
      "update_failed"
    );
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: action === "complete" ? "task_completed" : "task_reopened",
    affectedEntityType: "family_tasks",
    affectedEntityId: id,
    source: "tarefas.actions",
  });

  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  redirect("/tarefas?success=updated");
}

export async function deleteTask(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canAdminFamily(context)) redirect("/tarefas?error=permission_denied");

  const id = formData.get("id") as string | null;
  if (!id) redirect("/tarefas?error=missing_id");

  const { data, error } = await supabase
    .from("family_tasks")
    .delete()
    .eq("id", id)
    .eq("family_id", family.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    failTask(
      error ?? { code: "PGRST116", message: "task_not_found" },
      user.id,
      family.id,
      "delete_task",
      "delete_failed"
    );
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: "task_deleted",
    affectedEntityType: "family_tasks",
    affectedEntityId: id,
    source: "tarefas.actions",
  });

  revalidatePath("/tarefas");
  revalidatePath("/dashboard");
  revalidatePath("/timeline");
  redirect("/tarefas?success=deleted");
}
