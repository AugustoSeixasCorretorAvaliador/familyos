import { createClient } from "@/lib/supabase/server";

export type CalendarIntegrationStatus = {
  connected: boolean;
  provider: "google_calendar";
  message: string;
};

export type GoogleCalendarEvent = {
  id: string;
  summary: string;
  start: string;
  end: string;
  allDay: boolean;
  htmlLink: string | null;
  calendarSummary: string;
};

type GoogleCalendarEventsResult = {
  events: GoogleCalendarEvent[];
  error: string | null;
};

type GoogleCalendarApiResponse = {
  items?: Array<{
    id?: string;
    summary?: string;
    htmlLink?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  }>;
};

type GoogleCalendarListResponse = {
  items?: Array<{
    id?: string;
    summary?: string;
    primary?: boolean;
  }>;
};

type CalendarDescriptor = {
  id: string;
  summary: string;
  primary: boolean;
};

async function getGoogleAccessToken() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const providerToken = (session as unknown as { provider_token?: string | null } | null)?.provider_token;
  return providerToken ?? null;
}

async function fetchCalendarList(token: string) {
  const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  return response;
}

function mapEventsFromCalendar(
  payload: GoogleCalendarApiResponse,
  calendarSummary: string
): GoogleCalendarEvent[] {
  return (payload.items ?? [])
    .map((item): GoogleCalendarEvent | null => {
      const start = item.start?.dateTime ?? item.start?.date;
      const end = item.end?.dateTime ?? item.end?.date;
      if (!item.id || !start || !end) return null;

      return {
        id: item.id,
        summary: item.summary?.trim() || "Evento sem titulo",
        start,
        end,
        allDay: Boolean(item.start?.date && !item.start?.dateTime),
        htmlLink: item.htmlLink ?? null,
        calendarSummary,
      };
    })
    .filter((item): item is GoogleCalendarEvent => Boolean(item));
}

async function fetchCalendarDescriptors(token: string): Promise<CalendarDescriptor[]> {
  const response = await fetchCalendarList(token);
  if (!response.ok) return [];

  const payload = (await response.json()) as GoogleCalendarListResponse;
  return (payload.items ?? [])
    .map((item): CalendarDescriptor | null => {
      if (!item.id) return null;
      return {
        id: item.id,
        summary: item.summary?.trim() || "Calendario",
        primary: Boolean(item.primary),
      };
    })
    .filter((item): item is CalendarDescriptor => Boolean(item));
}

async function fetchEventsFromCalendar(
  token: string,
  calendar: CalendarDescriptor,
  maxResults: number
): Promise<{ events: GoogleCalendarEvent[]; error: string | null }> {
  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`
  );
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", new Date().toISOString());
  url.searchParams.set("maxResults", String(maxResults));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return {
      events: [],
      error: `Falha ao consultar calendario ${calendar.summary}.`,
    };
  }

  const payload = (await response.json()) as GoogleCalendarApiResponse;
  return {
    events: mapEventsFromCalendar(payload, calendar.summary),
    error: null,
  };
}

export async function getGoogleCalendarIntegrationStatus(): Promise<CalendarIntegrationStatus> {
  const supabase = createClient();
  const token = await getGoogleAccessToken();

  if (!token) {
    return {
      connected: false,
      provider: "google_calendar",
      message: "Conexao ausente. Clique em Conectar Google Calendar para autorizar a leitura dos eventos.",
    };
  }

  const verifyResponse = await fetchCalendarList(token);

  if (!verifyResponse.ok) {
    return {
      connected: false,
      provider: "google_calendar",
      message: "Sessao Google Calendar expirada ou sem permissao. Reconecte para continuar.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("display_name")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  const displayName = profile?.display_name?.trim();

  return {
    connected: true,
    provider: "google_calendar",
    message: displayName
      ? `Google Calendar conectado para ${displayName}.`
      : "Google Calendar conectado com sucesso.",
  };
}

export async function getGoogleCalendarUpcomingEvents(maxResults = 8): Promise<GoogleCalendarEventsResult> {
  const token = await getGoogleAccessToken();

  if (!token) {
    return {
      events: [],
      error: "Conexao Google Calendar nao autorizada.",
    };
  }

  const calendars = await fetchCalendarDescriptors(token);

  if (calendars.length === 0) {
    return {
      events: [],
      error: "Nao foi possivel listar calendarios do Google. Reconecte a conta.",
    };
  }

  const orderedCalendars = [...calendars].sort((a, b) => {
    if (a.primary && !b.primary) return -1;
    if (!a.primary && b.primary) return 1;
    return a.summary.localeCompare(b.summary, "pt-BR");
  });

  const collected: GoogleCalendarEvent[] = [];
  let lastError: string | null = null;

  for (const calendar of orderedCalendars) {
    if (collected.length >= maxResults) break;
    const remaining = maxResults - collected.length;
    const result = await fetchEventsFromCalendar(token, calendar, remaining);

    if (result.error) {
      lastError = result.error;
      continue;
    }

    collected.push(...result.events);
  }

  const events = collected
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, maxResults);

  if (events.length === 0 && lastError) {
    return {
      events: [],
      error: `${lastError} Reconecte a conta para renovar as permissoes.`,
    };
  }

  return {
    events,
    error: null,
  };
}
