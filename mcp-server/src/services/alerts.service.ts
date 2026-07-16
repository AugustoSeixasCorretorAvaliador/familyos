import { AppError } from "../utils/errors";
import { BaseService } from "./base.service";

export class AlertsService extends BaseService {
  async listAlerts(limit = 50) {
    const { data, error } = await this.db()
      .from("alerts")
      .select("*")
      .eq("family_id", this.auth.familyId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new AppError(error.message, 500);
    return data ?? [];
  }

  async markAlertAsRead(id: string) {
    const { data, error } = await this.db()
      .from("alerts")
      .update({ status: "read" })
      .eq("id", id)
      .eq("family_id", this.auth.familyId)
      .select("*")
      .single();

    if (error) throw new AppError(error.message, 400);
    return data;
  }
}
