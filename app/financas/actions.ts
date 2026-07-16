"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";

function toNumberOrNull(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const normalized = value.replace(".", "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function createAccount(formData: FormData) {
  const { user, family } = await getFamilyContext();
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
    redirect("/financas?error=create_failed");
  }

  revalidatePath("/financas");
  revalidatePath("/dashboard");
  redirect("/financas?success=created");
}

export async function updateAccount(formData: FormData) {
  const { user, family } = await getFamilyContext();
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

  const { error } = await supabase
    .from("accounts")
    .update({
      owner_person_id: (formData.get("owner_person_id") as string | null) || null,
      institution,
      account_type: accountType,
      account_identifier: (formData.get("account_identifier") as string | null)?.trim() || null,
      metadata,
    })
    .eq("id", accountId)
    .eq("family_id", family.id);

  if (error) {
    redirect("/financas?error=update_failed");
  }

  revalidatePath("/financas");
  revalidatePath("/dashboard");
  redirect("/financas?success=updated");
}

export async function deleteAccount(formData: FormData) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const accountId = formData.get("account_id") as string | null;
  if (!accountId) {
    redirect("/financas?error=missing_id");
  }

  await supabase.from("accounts").delete().eq("id", accountId).eq("family_id", family.id);

  revalidatePath("/financas");
  revalidatePath("/dashboard");
  redirect("/financas?success=deleted");
}
