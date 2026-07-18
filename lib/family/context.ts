import type { User } from "@supabase/supabase-js";
import { resolveDisplayName } from "@/lib/identity/display-name";
import { createClient } from "@/lib/supabase/server";

export type FamilyContext = {
  user: User | null;
  displayName: string;
  person:
    | {
        id: string;
        first_name: string;
        last_name: string;
      }
    | null;
  membership:
    | {
        id: string;
        person_id: string | null;
        role: "owner" | "admin" | "member" | "viewer";
        status: string;
      }
    | null;
  family:
    | {
        id: string;
        name: string;
        description: string | null;
      }
    | null;
};

export async function getFamilyContext(): Promise<FamilyContext> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      displayName: "usuário",
      person: null,
      membership: null,
      family: null,
    };
  }

  const [
    { data: membershipData, error: membershipError },
    { data: profileData, error: profileError },
  ] = await Promise.all([
    supabase
      .from("family_members")
      .select("id, person_id, role, status, families(id, name, description)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("joined_at", { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("display_name")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (membershipError || profileError) {
    console.error(
      "[familyos_context_error]",
      JSON.stringify({
        user_id: user.id,
        membership_error_code: membershipError?.code ?? null,
        profile_error_code: profileError?.code ?? null,
      })
    );
  }

  const personResult = membershipData?.person_id
    ? await supabase
        .from("people")
        .select("id, first_name, last_name")
        .eq("id", membershipData.person_id)
        .is("deleted_at", null)
        .maybeSingle()
    : { data: null, error: null };

  if (personResult.error) {
    console.error(
      "[familyos_context_person_error]",
      JSON.stringify({
        user_id: user.id,
        error_code: personResult.error.code,
      })
    );
  }

  const person = (personResult.data ?? null) as FamilyContext["person"];
  const family = (membershipData?.families ?? null) as FamilyContext["family"];
  const membership = membershipData
    ? ({
        id: membershipData.id,
        person_id: membershipData.person_id,
        role: membershipData.role,
        status: membershipData.status,
      } as FamilyContext["membership"])
    : null;

  return {
    user,
    displayName: resolveDisplayName({
      person: person
        ? { firstName: person.first_name, lastName: person.last_name }
        : null,
      profileDisplayName: profileData?.display_name ?? null,
      userMetadata: user.user_metadata,
      email: user.email,
    }),
    person,
    membership,
    family,
  };
}

export function canAdminFamily(context: FamilyContext) {
  return context.membership?.role === "owner" || context.membership?.role === "admin";
}

export function canEditFamily(context: FamilyContext) {
  return (
    context.membership?.role === "owner" ||
    context.membership?.role === "admin" ||
    context.membership?.role === "member"
  );
}
