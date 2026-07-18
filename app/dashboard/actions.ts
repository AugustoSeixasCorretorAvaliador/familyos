"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { errorRedirectPath, reportActionError } from "@/lib/action-error";
import { canAdminFamily, getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";

export type InvitationActionState = {
  error: string | null;
  invitationUrl: string | null;
};

export async function bootstrapFamily(formData: FormData) {
  const context = await getFamilyContext();
  const { user } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (context.family) redirect("/dashboard");

  const familyName = (formData.get("family_name") as string | null)?.trim();
  if (!familyName) redirect("/dashboard?error=required_fields");

  const { error } = await supabase.rpc("bootstrap_family", {
    p_family_name: familyName,
    p_description: null,
  });

  if (error) {
    const result = reportActionError({
      error,
      userId: user.id,
      familyId: "not-linked",
      module: "dashboard",
      action: "bootstrap_family",
      fallback: "create_failed",
    });
    redirect(errorRedirectPath("/dashboard", result));
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?success=family_created");
}

export async function createFamilyInvitation(
  _previousState: InvitationActionState,
  formData: FormData
): Promise<InvitationActionState> {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user || !family) {
    return { error: "Sua sessao familiar expirou.", invitationUrl: null };
  }
  if (!canAdminFamily(context)) {
    return {
      error: "Apenas owner ou administrador pode criar convites.",
      invitationUrl: null,
    };
  }

  const email = (formData.get("email") as string | null)?.trim().toLowerCase();
  const role = (formData.get("role") as string | null) || "member";

  if (!email) {
    return { error: "Informe o e-mail do familiar.", invitationUrl: null };
  }

  const { data, error } = await supabase.rpc("create_family_invitation", {
    p_family_id: family.id,
    p_email: email,
    p_role: role,
  });

  if (error?.message === "unique_person_required") {
    return {
      error:
        "Nenhuma pessoa única foi encontrada com este e-mail. Cadastre primeiro a pessoa em Pessoas. Pets e dependentes sem login não precisam de convite.",
      invitationUrl: null,
    };
  }

  if (error || !data?.[0]?.invitation_token) {
    const result = reportActionError({
      error: error ?? new Error("invitation_token_missing"),
      userId: user.id,
      familyId: family.id,
      module: "dashboard",
      action: "create_family_invitation",
      fallback: "create_failed",
    });
    return {
      error: `Nao foi possivel criar o convite. Codigo: ${result.requestId}`,
      invitationUrl: null,
    };
  }

  const requestHeaders = headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const invitationPath = `/convite/${data[0].invitation_token}`;
  const invitationUrl = host ? `${protocol}://${host}${invitationPath}` : invitationPath;

  revalidatePath("/dashboard");
  return { error: null, invitationUrl };
}

export async function acceptFamilyInvitation(formData: FormData) {
  const { user } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");

  const token = (formData.get("token") as string | null)?.trim();
  if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
    redirect("/dashboard?error=invitation_invalid");
  }

  const { error } = await supabase.rpc("accept_family_invitation", {
    p_token: token,
  });

  if (error) {
    const result = reportActionError({
      error,
      userId: user.id,
      familyId: "pending-invitation",
      module: "dashboard",
      action: "accept_family_invitation",
      fallback: "invitation_invalid",
    });
    redirect(errorRedirectPath("/dashboard", result));
  }

  revalidatePath("/dashboard");
  revalidatePath("/pessoas");
  redirect("/dashboard?success=invitation_accepted");
}
