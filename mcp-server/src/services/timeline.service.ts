import { AppError } from "../utils/errors";
import { BaseService } from "./base.service";

export class TimelineService extends BaseService {
  async listTimeline(limit = 100) {
    const { data, error } = await this.db()
      .from("events")
      .select("*")
      .eq("family_id", this.auth.familyId)
      .order("occurred_at", { ascending: false })
      .limit(limit);

    if (error) throw new AppError(error.message, 500);
    return data ?? [];
  }

  async createTimelineEvent(input: Record<string, unknown>) {
    const { data, error } = await this.db()
      .from("events")
      .insert({ ...input, family_id: this.auth.familyId })
      .select("*")
      .single();

    if (error) throw new AppError(error.message, 400);
    return data;
  }
}
