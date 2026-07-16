import type { AuthContext } from "../models/context";
import { createSupabaseUserClient } from "../providers/supabase.provider";

export class BaseService {
  protected readonly auth: AuthContext;

  constructor(auth: AuthContext) {
    this.auth = auth;
  }

  protected db() {
    return createSupabaseUserClient(this.auth.token);
  }
}
