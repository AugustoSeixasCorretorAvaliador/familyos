"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorRedirectPath, reportActionError } from "@/lib/action-error";
import { canAdminFamily, getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";

function toNumberOrNull(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const raw = value.trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createAccount(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const institution = (formData.get("institution") as string | null)?.trim();
  const accountType = (formData.get("account_type") as string | null)?.trim();

  if (!institution || !accountType) {
    redirect("/financas?error=required_fields");
  }

  const metadata = {
    agencia: (formData.get("agencia") as string | null)?.trim() || null,
    ultimos_quatro: (formData.get("ultimos_quatro") as string | null)?.trim() || null,
    saldo_atual: toNumberOrNull(formData.get("saldo_atual")),
    data_atualizacao: (formData.get("data_atualizacao") as string | null) || null,
    observacoes: (formData.get("observacoes") as string | null)?.trim() || null,
  };

  const { error } = await supabase.from("accounts").insert({
    family_id: family.id,
    owner_person_id: (formData.get("owner_person_id") as string | null) || null,
    institution,
    account_type: accountType,
    account_identifier: (formData.get("account_identifier") as string | null)?.trim() || null,
    status: "active",
    metadata,
  });

  if (error) {
    const result = reportActionError({
      error,
      userId: user.id,
      familyId: family.id,
      module: "financas",
      action: "create_account",
      fallback: "create_failed",
    });
    redirect(errorRedirectPath("/financas", result));
  }

  revalidatePath("/financas");
  revalidatePath("/dashboard");
  redirect("/financas?success=created");
}

export async function updateAccount(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const accountId = formData.get("account_id") as string | null;
  if (!accountId) {
    redirect("/financas?error=missing_id");
  }

  const institution = (formData.get("institution") as string | null)?.trim();
  const accountType = (formData.get("account_type") as string | null)?.trim();

  if (!institution || !accountType) {
    redirect("/financas?error=required_fields");
  }

  const metadata = {
    agencia: (formData.get("agencia") as string | null)?.trim() || null,
    ultimos_quatro: (formData.get("ultimos_quatro") as string | null)?.trim() || null,
    saldo_atual: toNumberOrNull(formData.get("saldo_atual")),
    data_atualizacao: (formData.get("data_atualizacao") as string | null) || null,
    observacoes: (formData.get("observacoes") as string | null)?.trim() || null,
  };

  const { data, error } = await supabase
    .from("accounts")
    .update({
      owner_person_id: (formData.get("owner_person_id") as string | null) || null,
      institution,
      account_type: accountType,
      account_identifier: (formData.get("account_identifier") as string | null)?.trim() || null,
      metadata,
    })
    .eq("id", accountId)
    .eq("family_id", family.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    const result = reportActionError({
      error: error ?? { code: "PGRST116", message: "account_not_found" },
      userId: user.id,
      familyId: family.id,
      module: "financas",
      action: "update_account",
      fallback: "update_failed",
    });
    redirect(errorRedirectPath("/financas", result));
  }

  revalidatePath("/financas");
  revalidatePath("/dashboard");
  redirect("/financas?success=updated");
}

export async function deleteAccount(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canAdminFamily(context)) redirect("/financas?error=permission_denied");

  const accountId = formData.get("account_id") as string | null;
  if (!accountId) {
    redirect("/financas?error=missing_id");
  }

  const { data, error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", accountId)
    .eq("family_id", family.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    const result = reportActionError({
      error: error ?? { code: "PGRST116", message: "account_not_found" },
      userId: user.id,
      familyId: family.id,
      module: "financas",
      action: "delete_account",
      fallback: "delete_failed",
    });
    redirect(errorRedirectPath("/financas", result));
  }

  revalidatePath("/financas");
  revalidatePath("/dashboard");
  redirect("/financas?success=deleted");
}
