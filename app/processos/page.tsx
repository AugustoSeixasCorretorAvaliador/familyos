import { redirect } from "next/navigation";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { MainNav } from "@/app/components/main-nav";
import { createLegalCase, deleteLegalCase, updateLegalCase } from "@/app/processos/actions";
import { getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: {
    success?: string;
    error?: string;
    status?: string;
  };
};

type PersonOption = { id: string; first_name: string; last_name: string };
type LegalCaseRow = {
  id: string;
  case_number: string | null;
  title: string;
  case_type: string | null;
  person_id: string | null;
  court: string | null;
  start_date: string | null;
  lawyer: string | null;
  claim_value: number | null;
  expected_value: number | null;
  last_update: string | null;
  last_update_date: string | null;
  status: string;
  notes: string | null;
  people: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
};

const CASE_STATUSES = ["Ativo", "Aguardando", "Suspenso", "Concluido", "Arquivado"];

function formatDate(date: string | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function formatCurrency(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default async function ProcessosPage({ searchParams }: PageProps) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const [peopleRes, casesRes] = await Promise.all([
    supabase
      .from("people")
      .select("id, first_name, last_name")
      .eq("family_id", family.id)
      .is("deleted_at", null)
      .order("first_name", { ascending: true }),
    supabase
      .from("legal_cases")
      .select("id, case_number, title, case_type, person_id, court, start_date, lawyer, claim_value, expected_value, last_update, last_update_date, status, notes, people:person_id(first_name,last_name)")
      .eq("family_id", family.id)
      .order("updated_at", { ascending: false }),
  ]);

  const people = (peopleRes.data ?? []) as PersonOption[];
  let legalCases = ((casesRes.data ?? []) as LegalCaseRow[]).map((row) => ({
    ...row,
    people: Array.isArray(row.people) ? row.people[0] ?? null : row.people,
  }));

  if (searchParams.status) {
    legalCases = legalCases.filter((legalCase) => legalCase.status === searchParams.status);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <MainNav current="processos" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Processos</h1>
            <p className="mt-1 text-slate-600">{family.name}</p>
          </div>
        </header>

        {(searchParams.success || searchParams.error) && (
          <section
            className={`rounded-2xl border p-4 shadow-sm ${
              searchParams.error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {searchParams.error ? "Nao foi possivel concluir a operacao." : "Operacao concluida com sucesso."}
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Novo processo</h2>
          <form action={createLegalCase} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <input name="title" required placeholder="Titulo" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="case_number" placeholder="Numero do processo" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="case_type" placeholder="Tipo" className="rounded-xl border border-slate-300 px-3 py-2" />
            <select name="person_id" className="rounded-xl border border-slate-300 px-3 py-2">
              <option value="">Pessoa relacionada</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>
              ))}
            </select>
            <input name="court" placeholder="Tribunal ou orgao" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="start_date" type="date" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="lawyer" placeholder="Advogado" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="claim_value" placeholder="Valor da causa" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="expected_value" placeholder="Valor esperado" className="rounded-xl border border-slate-300 px-3 py-2" />
            <select name="status" defaultValue="Ativo" className="rounded-xl border border-slate-300 px-3 py-2">
              {CASE_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <textarea name="last_update" rows={2} placeholder="Ultimo andamento" className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" />
            <input name="last_update_date" type="date" className="rounded-xl border border-slate-300 px-3 py-2" />
            <textarea name="notes" rows={2} placeholder="Observacoes" className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" />
            <div className="md:col-span-2">
              <button type="submit" className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800">Salvar processo</button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Filtros</h2>
          <form className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <select name="status" defaultValue={searchParams.status ?? ""} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="">Todos status</option>
              {CASE_STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <button type="submit" className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Aplicar filtro</button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Lista de processos</h2>
          {legalCases.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-600">Nenhum processo encontrado.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {legalCases.map((legalCase) => (
                <details key={legalCase.id} className="rounded-xl border border-slate-200 p-4">
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900">{legalCase.title}</p>
                      <p className="text-sm text-slate-600">
                        {legalCase.status} | {legalCase.case_number ?? "Sem numero"}
                      </p>
                    </div>
                    <span className="text-sm text-slate-600">{formatCurrency(legalCase.expected_value)}</span>
                  </summary>

                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-slate-700">
                      Pessoa: {legalCase.people ? `${legalCase.people.first_name} ${legalCase.people.last_name}` : "Nao informada"}
                    </p>
                    <p className="text-sm text-slate-700">Ultimo andamento: {legalCase.last_update ?? "-"}</p>
                    <p className="text-sm text-slate-700">Data do andamento: {formatDate(legalCase.last_update_date)}</p>

                    <form action={updateLegalCase} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input type="hidden" name="id" value={legalCase.id} />
                      <input name="title" required defaultValue={legalCase.title} className="rounded-xl border border-slate-300 px-3 py-2" />
                      <input name="case_number" defaultValue={legalCase.case_number ?? ""} className="rounded-xl border border-slate-300 px-3 py-2" />
                      <input name="case_type" defaultValue={legalCase.case_type ?? ""} className="rounded-xl border border-slate-300 px-3 py-2" />
                      <select name="person_id" defaultValue={legalCase.person_id ?? ""} className="rounded-xl border border-slate-300 px-3 py-2">
                        <option value="">Pessoa relacionada</option>
                        {people.map((person) => (
                          <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>
                        ))}
                      </select>
                      <input name="court" defaultValue={legalCase.court ?? ""} className="rounded-xl border border-slate-300 px-3 py-2" />
                      <input name="start_date" type="date" defaultValue={legalCase.start_date ?? ""} className="rounded-xl border border-slate-300 px-3 py-2" />
                      <input name="lawyer" defaultValue={legalCase.lawyer ?? ""} className="rounded-xl border border-slate-300 px-3 py-2" />
                      <input name="claim_value" defaultValue={legalCase.claim_value ?? ""} className="rounded-xl border border-slate-300 px-3 py-2" />
                      <input name="expected_value" defaultValue={legalCase.expected_value ?? ""} className="rounded-xl border border-slate-300 px-3 py-2" />
                      <select name="status" defaultValue={legalCase.status} className="rounded-xl border border-slate-300 px-3 py-2">
                        {CASE_STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <textarea name="last_update" rows={2} defaultValue={legalCase.last_update ?? ""} className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" />
                      <input name="last_update_date" type="date" defaultValue={legalCase.last_update_date ?? ""} className="rounded-xl border border-slate-300 px-3 py-2" />
                      <textarea name="notes" rows={2} defaultValue={legalCase.notes ?? ""} className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" />
                      <div className="md:col-span-2">
                        <button type="submit" className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800">Salvar alteracoes</button>
                      </div>
                    </form>

                    <form action={deleteLegalCase}>
                      <input type="hidden" name="id" value={legalCase.id} />
                      <ConfirmSubmitButton
                        label="Excluir processo"
                        confirmMessage="Deseja realmente excluir este processo?"
                        className="rounded-xl border border-red-300 text-red-700 px-3 py-1 text-sm hover:bg-red-50"
                      />
                    </form>
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
