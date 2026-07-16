import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env";
import type { AuthContext } from "../models/context";
import { verifySupabaseJwt } from "./jwt";
import { AppError } from "../utils/errors";

type BuildAuthOptions = {
  familyId?: string;
  clientName?: string;
  clientVersion?: string;
  userAgent?: string;
  googleAccessToken?: string;
  googleScopes?: string[];
};

export async function buildAuthContextFromBearer(
  authorization: string | undefined,
  options: BuildAuthOptions = {},
): Promise<AuthContext> {
  const token = authorization?.replace(/^Bearer\s+/i, "")?.trim() ?? "";
  if (!token) {
    throw new AppError("Bearer token is required", 401, "UNAUTHENTICATED");
  }

  const payload = await verifySupabaseJwt(token);

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });

  let query = supabase
    .from("family_members")
    .select("family_id, role")
    .eq("user_id", payload.sub)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (options.familyId) {
    query = query.eq("family_id", options.familyId);
  }

  const { data: memberships, error } = await query;

  if (error) {
    throw new AppError(error.message, 500, "SUPABASE_ERROR", true);
  }

  if (!memberships || memberships.length === 0) {
    throw new AppError("No active family membership for user", 403, "FAMILY_NOT_FOUND");
  }

  if (!options.familyId && memberships.length > 1) {
    throw new AppError("family_id is required for users with multiple families", 400, "VALIDATION_ERROR", false, {
      familyIds: memberships.map((membership) => membership.family_id),
    });
  }

  const member = memberships[0] as { family_id: string; role: AuthContext["role"] };

  return {
    userId: payload.sub,
    email: payload.email,
    token,
    familyId: member.family_id,
    role: member.role,
    clientName: options.clientName,
    clientVersion: options.clientVersion,
    userAgent: options.userAgent,
    googleAccessToken: options.googleAccessToken,
    googleScopes: options.googleScopes ?? [],
  };
}
