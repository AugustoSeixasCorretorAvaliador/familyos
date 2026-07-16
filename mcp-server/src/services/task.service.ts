import { AppError } from "../utils/errors";
import { BaseService } from "./base.service";

export class TaskService extends BaseService {
  async listTasks() {
    const { data, error } = await this.db()
      .from("family_tasks")
      .select("*")
      .eq("family_id", this.auth.familyId)
      .order("due_date", { ascending: true });

    if (error) throw new AppError(error.message, 500);
    return data ?? [];
  }

  async createTask(input: Record<string, unknown>) {
    const { data, error } = await this.db()
      .from("family_tasks")
      .insert({ ...input, family_id: this.auth.familyId })
      .select("*")
      .single();

    if (error) throw new AppError(error.message, 400);
    return data;
  }

  async completeTask(id: string) {
    const { data, error } = await this.db()
      .from("family_tasks")
      .update({ status: "done" })
      .eq("id", id)
      .eq("family_id", this.auth.familyId)
      .select("*")
      .single();

    if (error) throw new AppError(error.message, 400);
    return data;
  }
}
