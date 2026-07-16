import { createSecretKey } from "node:crypto";
import { jwtVerify } from "jose";
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

  const secret = createSecretKey(Buffer.from(env.SUPABASE_JWT_SECRET, "utf8"));
  const verified = await jwtVerify(token, secret, { algorithms: ["HS256"] });
  const payload = verified.payload as unknown as SupabaseJwtPayload;

  if (!payload?.sub) {
    throw new AppError("Invalid JWT payload", 401);
  }

  return payload;
}
