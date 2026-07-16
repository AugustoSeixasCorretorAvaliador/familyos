import { redirect } from "next/navigation";
import { MainNav } from "@/app/components/main-nav";
import { getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";

type TimelineRow = {
  id: string;
  event_type: string;
  source: string;
  affected_entity_type: string;
  affected_entity_id: string | null;
  occurred_at: string;
  priority: string;
};

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

export default async function TimelinePage() {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const { data } = await supabase
    .from("events")
    .select("id, event_type, source, affected_entity_type, affected_entity_id, occurred_at, priority")
    .eq("family_id", family.id)
    .order("occurred_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as TimelineRow[];

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
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{row.event_type}</p>
                      <p className="text-sm text-slate-600">
                        Entidade: {row.affected_entity_type}
                        {row.affected_entity_id ? ` (${row.affected_entity_id})` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs ${priorityClass(row.priority)}`}>
                        {row.priority}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">{formatDateTime(row.occurred_at)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Origem: {row.source}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
