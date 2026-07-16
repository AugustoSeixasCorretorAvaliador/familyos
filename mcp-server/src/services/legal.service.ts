import { AppError } from "../utils/errors";
import { BaseService } from "./base.service";

export class LegalService extends BaseService {
  async listCases() {
    const { data, error } = await this.db()
      .from("legal_cases")
      .select("*")
      .eq("family_id", this.auth.familyId)
      .order("created_at", { ascending: false });

    if (error) throw new AppError(error.message, 500);
    return data ?? [];
  }

  async createCase(input: Record<string, unknown>) {
    const { data, error } = await this.db()
      .from("legal_cases")
      .insert({ ...input, family_id: this.auth.familyId })
      .select("*")
      .single();

    if (error) throw new AppError(error.message, 400);
    return data;
  }

  async addCaseDocument() {
    throw new AppError("add_case_document not implemented in v1 scaffold", 501);
  }
}
