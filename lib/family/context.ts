import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type FamilyContext = {
  user: User | null;
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
    return { user: null, membership: null, family: null };
  }

  const { data, error } = await supabase
    .from("family_members")
    .select("id, person_id, role, status, families(id, name, description)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "[familyos_context_error]",
      JSON.stringify({
        user_id: user.id,
        error_code: error.code,
        error_message: error.message,
      })
    );
  }

  const family = (data?.families ?? null) as FamilyContext["family"];
  const membership = data
    ? ({
        id: data.id,
        person_id: data.person_id,
        role: data.role,
        status: data.status,
      } as FamilyContext["membership"])
    : null;

  return {
    user,
    membership,
    family,
  };
}

export function canAdminFamily(context: FamilyContext) {
  return context.membership?.role === "owner" || context.membership?.role === "admin";
}
