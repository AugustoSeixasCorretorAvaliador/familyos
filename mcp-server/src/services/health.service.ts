import { AppError } from "../utils/errors";
import { BaseService } from "./base.service";

export class HealthService extends BaseService {
  async listDoctors() {
    const { data, error } = await this.db().from("doctors").select("*").eq("family_id", this.auth.familyId);
    if (error) throw new AppError(error.message, 500);
    return data ?? [];
  }

  async listMedications() {
    const { data, error } = await this.db().from("medications").select("*").eq("family_id", this.auth.familyId);
    if (error) throw new AppError(error.message, 500);
    return data ?? [];
  }

  async listHealthExams() {
    const { data, error } = await this.db().from("health_exams").select("*").eq("family_id", this.auth.familyId);
    if (error) throw new AppError(error.message, 500);
    return data ?? [];
  }

  async listDueExams() {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await this.db()
      .from("health_exams")
      .select("*")
      .eq("family_id", this.auth.familyId)
      .lte("due_date", today)
      .neq("status", "Realizado")
      .neq("status", "Resultado recebido");

    if (error) throw new AppError(error.message, 500);
    return data ?? [];
  }

  async createExam(input: Record<string, unknown>) {
    const { data, error } = await this.db()
      .from("health_exams")
      .insert({ ...input, family_id: this.auth.familyId })
      .select("*")
      .single();

    if (error) throw new AppError(error.message, 400);
    return data;
  }

  async updateExam(id: string, input: Record<string, unknown>) {
    const { data, error } = await this.db()
      .from("health_exams")
      .update(input)
      .eq("id", id)
      .eq("family_id", this.auth.familyId)
      .select("*")
      .single();

    if (error) throw new AppError(error.message, 400);
    return data;
  }
}
