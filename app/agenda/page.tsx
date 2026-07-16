import { redirect } from "next/navigation";
import { MainNav } from "@/app/components/main-nav";
import { ConnectGoogleCalendarButton } from "@/app/agenda/connect-google-calendar-button";
import { DisconnectGoogleCalendarButton } from "@/app/agenda/disconnect-google-calendar-button";
import { getFamilyContext } from "@/lib/family/context";
import { getGoogleCalendarIntegrationStatus, getGoogleCalendarUpcomingEvents } from "@/lib/calendar/status";

function formatCalendarDate(value: string, allDay: boolean) {
  const date = new Date(value);
  if (allDay) {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function AgendaPage() {
  const { user, family } = await getFamilyContext();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const [status, upcoming] = await Promise.all([
    getGoogleCalendarIntegrationStatus(),
    getGoogleCalendarUpcomingEvents(8),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <MainNav current="agenda" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Agenda</h1>
            <p className="mt-1 text-slate-600">Preparacao para integracao com Google Calendar.</p>
          </div>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Status da Integracao</h2>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">Provedor: Google Calendar</p>
              <p className="mt-1 text-amber-900 font-medium">
                {status.connected ? "Conectado" : "Nao conectado"}
              </p>
              <p className="mt-2 text-sm text-amber-800">{status.message}</p>
            </div>
            {status.connected ? <DisconnectGoogleCalendarButton /> : <ConnectGoogleCalendarButton />}
            <p className="mt-4 text-sm text-slate-600">
              Esta tela esta preparada para receber autenticacao OAuth e leitura dos proximos eventos sem duplicar
              dados do Google Calendar no banco.
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Proximos Eventos</h2>
            {upcoming.error ? (
              <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-sm text-slate-700">{upcoming.error}</p>
                <p className="mt-2 text-xs text-slate-500">Conecte novamente para atualizar sua agenda.</p>
              </div>
            ) : upcoming.events.length === 0 ? (
              <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-sm text-slate-700">Nenhum evento futuro encontrado no calendario principal.</p>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {upcoming.events.map((event) => (
                  <li key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-medium text-slate-900">{event.summary}</p>
                    <p className="mt-1 text-xs text-slate-500">Calendario: {event.calendarSummary}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Inicio: {formatCalendarDate(event.start, event.allDay)}
                    </p>
                    <p className="text-sm text-slate-600">Fim: {formatCalendarDate(event.end, event.allDay)}</p>
                    {event.htmlLink && (
                      <a
                        href={event.htmlLink}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex text-sm font-medium text-slate-800 underline"
                      >
                        Abrir no Google Calendar
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
