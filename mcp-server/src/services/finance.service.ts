import { AppError } from "../utils/errors";
import { BaseService } from "./base.service";

export class FinanceService extends BaseService {
  async listAccounts() {
    const { data, error } = await this.db().from("accounts").select("*").eq("family_id", this.auth.familyId);
    if (error) throw new AppError(error.message, 500);
    return data ?? [];
  }

  async listFinancialEntries(limit = 50) {
    const { data, error } = await this.db()
      .from("financial_entries")
      .select("*")
      .eq("family_id", this.auth.familyId)
      .order("entry_date", { ascending: false })
      .limit(limit);

    if (error) throw new AppError(error.message, 500);
    return data ?? [];
  }

  async listOpenDebts() {
    const { data, error } = await this.db()
      .from("debts")
      .select("*")
      .eq("family_id", this.auth.familyId)
      .neq("status", "Quitada")
      .order("due_date", { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return data ?? [];
  }

  async createFinancialEntry(input: Record<string, unknown>) {
    const { data, error } = await this.db()
      .from("financial_entries")
      .insert({ ...input, family_id: this.auth.familyId })
      .select("*")
      .single();

    if (error) throw new AppError(error.message, 400);
    return data;
  }
}
