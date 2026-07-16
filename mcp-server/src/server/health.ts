import { createSupabaseAdminClient } from "../providers/supabase.provider";

export async function healthCheck() {
  try {
    const db = createSupabaseAdminClient();
    const { error } = await db.from("families").select("id").limit(1);

    if (error) {
      return {
        ok: false,
        checks: {
          supabase: { ok: false, error: error.message },
        },
      };
    }

    return {
      ok: true,
      checks: {
        supabase: { ok: true },
      },
    };
  } catch (error) {
    return {
      ok: false,
      checks: {
        supabase: { ok: false, error: error instanceof Error ? error.message : "unknown" },
      },
    };
  }
}
