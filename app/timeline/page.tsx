import Link from "next/link";
import { redirect } from "next/navigation";
import { MainNav } from "@/app/components/main-nav";
import { getFamilyContext } from "@/lib/family/context";
import { loadTimelineEntries } from "@/lib/timeline/load-events";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function priorityClass(priority: string) {
  if (priority === "critical") return "text-red-700 bg-red-50 border-red-200";
  if (priority === "high") return "text-orange-700 bg-orange-50 border-orange-200";
  if (priority === "medium") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
}

function priorityLabel(priority: string) {
  if (priority === "critical") return "Crítica";
  if (priority === "high") return "Alta";
  if (priority === "medium") return "Média";
  return "Informativa";
}

export default async function TimelinePage() {
  const { user, family } = await getFamilyContext();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const rows = await loadTimelineEntries({ familyId: family.id, limit: 200 });

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <MainNav current="timeline" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Timeline</h1>
            <p className="mt-1 text-slate-600">{family.name}</p>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {rows.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-slate-600">Nenhum evento encontrado.</p>
          ) : (
            <ul className="space-y-3">
              {rows.map((row) => (
                <li key={row.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl"
                    >
                      {row.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {row.moduleLabel} · {row.entityLabel}
                          </p>
                          {row.href ? (
                            <Link
                              href={row.href}
                              className="mt-1 block font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-700"
                            >
                              {row.message}
                            </Link>
                          ) : (
                            <p className="mt-1 font-medium text-slate-900">{row.message}</p>
                          )}
                        </div>
                        <span
                          className={`inline-flex w-fit shrink-0 rounded-full border px-2 py-1 text-xs ${priorityClass(row.priority)}`}
                        >
                          {priorityLabel(row.priority)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {formatDateTime(row.occurredAt)}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
