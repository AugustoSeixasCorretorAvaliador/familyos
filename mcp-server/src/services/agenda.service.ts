import { AppError } from "../utils/errors";
import { GoogleCalendarProvider } from "../providers/google-calendar.provider";
import { BaseService } from "./base.service";

export class AgendaService extends BaseService {
  private readonly provider = new GoogleCalendarProvider();

  async listEvents(limit = 30) {
    const { data, error } = await this.db()
      .from("events")
      .select("*")
      .eq("family_id", this.auth.familyId)
      .order("occurred_at", { ascending: false })
      .limit(limit);

    if (error) throw new AppError(error.message, 500);

    return {
      source: "familyos_events",
      events: data ?? [],
    };
  }

  async calendarStatus() {
    return this.provider.status(this.auth);
  }

  async listGoogleUpcomingEvents(input: { calendarId?: string; limit?: number } = {}) {
    return this.provider.listNextEvents(this.auth, input);
  }

  async createCalendarEvent(input: Parameters<GoogleCalendarProvider["createEvent"]>[1]) {
    return this.provider.createEvent(this.auth, input);
  }

  async updateCalendarEvent(input: Parameters<GoogleCalendarProvider["updateEvent"]>[1]) {
    return this.provider.updateEvent(this.auth, input);
  }

  async deleteCalendarEvent(input: Parameters<GoogleCalendarProvider["deleteEvent"]>[1]) {
    return this.provider.deleteEvent(this.auth, input);
  }
}
