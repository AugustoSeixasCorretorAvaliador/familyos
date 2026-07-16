import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import { AppError } from "../utils/errors";

export type SupabaseJwtPayload = {
  sub: string;
  email?: string;
  exp?: number;
  role?: string;
};

export async function verifySupabaseJwt(token: string): Promise<SupabaseJwtPayload> {
  if (!token) throw new AppError("Missing bearer token", 401);

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user?.id) {
    throw new AppError("Invalid or expired bearer token", 401, "UNAUTHENTICATED");
  }

  return {
    sub: user.id,
    email: user.email,
  };
}
