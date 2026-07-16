import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type FamilyContext = {
  user: User | null;
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
    return { user: null, family: null };
  }

  const { data } = await supabase
    .from("family_members")
    .select("families(id, name, description)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const family = (data?.families ?? null) as FamilyContext["family"];

  return {
    user,
    family,
  };
}
