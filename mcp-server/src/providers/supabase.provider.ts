import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";

export function createSupabaseUserClient(jwt: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function createSupabaseAdminClient() {
  if (!env.SUPABASE_SERVICE_ROLE) {
    throw new Error("SUPABASE_SERVICE_ROLE not configured");
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
