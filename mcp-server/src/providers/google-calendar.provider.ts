import { AppError } from "../utils/errors";
import type { AuthContext } from "../models/context";

const WRITE_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const READ_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

type CalendarEventInput = {
  title?: string;
  description?: string;
  start?: string;
  end?: string;
  timezone?: string;
  location?: string;
  attendees?: string[];
  reminders?: Array<{ method: "email" | "popup"; minutes: number }>;
  allDay?: boolean;
  calendarId?: string;
};

function assertToken(auth: AuthContext) {
  if (!auth.googleAccessToken) {
    throw new AppError("Google Calendar is not connected for this MCP session", 401, "CALENDAR_NOT_CONNECTED", false, {
      reconnectRequired: true,
    });
  }
  return auth.googleAccessToken;
}

function assertWriteScope(auth: AuthContext) {
  if (!auth.googleScopes.includes(WRITE_SCOPE)) {
    throw new AppError("Google Calendar write scope is required", 403, "CALENDAR_SCOPE_REQUIRED", false, {
      requiredScope: WRITE_SCOPE,
      reconnectRequired: true,
    });
  }
}

function buildEventBody(input: CalendarEventInput) {
  const body: Record<string, unknown> = {};
  if (input.title !== undefined) body.summary = input.title;
  if (input.description !== undefined) body.description = input.description;
  if (input.location !== undefined) body.location = input.location;
  if (input.attendees !== undefined) body.attendees = input.attendees.map((email) => ({ email }));
  if (input.reminders !== undefined) body.reminders = { useDefault: false, overrides: input.reminders };
  if (input.start !== undefined) {
    body.start = input.allDay
      ? { date: input.start.slice(0, 10) }
      : { dateTime: input.start, timeZone: input.timezone };
  }
  if (input.end !== undefined) {
    body.end = input.allDay
      ? { date: input.end.slice(0, 10) }
      : { dateTime: input.end, timeZone: input.timezone };
  }
  return body;
}

async function googleRequest<T>(token: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new AppError("Google Calendar API error", response.status, "GOOGLE_API_ERROR", response.status >= 500, {
      status: response.status,
      details: details.slice(0, 500),
    });
  }
  if (response.status === 204) return {} as T;
  return await response.json() as T;
}

export class GoogleCalendarProvider {
  async status(auth: AuthContext) {
    if (!auth.googleAccessToken) {
      return {
        connected: false,
        provider: "google_calendar",
        message: "Use FamilyOS web flow to connect calendar OAuth.",
        writable: false,
      };
    }

    return {
      connected: true,
      provider: "google_calendar",
      message: "Google Calendar token supplied for this MCP session.",
      writable: auth.googleScopes.includes(WRITE_SCOPE),
      scopes: auth.googleScopes.filter((scope) => scope === READ_SCOPE || scope === WRITE_SCOPE),
    };
  }

  async listNextEvents(auth: AuthContext, input: { calendarId?: string; limit?: number } = {}) {
    const token = assertToken(auth);
    const calendarId = input.calendarId ?? "primary";
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("timeMin", new Date().toISOString());
    url.searchParams.set("maxResults", String(input.limit ?? 10));
    return googleRequest(token, url.toString());
  }

  async createEvent(auth: AuthContext, input: Required<Pick<CalendarEventInput, "title" | "start" | "end">> & CalendarEventInput) {
    const token = assertToken(auth);
    assertWriteScope(auth);
    const calendarId = input.calendarId ?? "primary";
    return googleRequest(token, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
      method: "POST",
      body: JSON.stringify(buildEventBody(input)),
    });
  }

  async updateEvent(auth: AuthContext, input: CalendarEventInput & { eventId: string }) {
    const token = assertToken(auth);
    assertWriteScope(auth);
    const calendarId = input.calendarId ?? "primary";
    return googleRequest(token, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}`, {
      method: "PATCH",
      body: JSON.stringify(buildEventBody(input)),
    });
  }

  async deleteEvent(auth: AuthContext, input: { eventId: string; calendarId?: string }) {
    const token = assertToken(auth);
    assertWriteScope(auth);
    const calendarId = input.calendarId ?? "primary";
    await googleRequest(token, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}`, {
      method: "DELETE",
    });
    return { deleted: true, eventId: input.eventId, calendarId };
  }
}
