import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFamilyContext } from "@/lib/family/context";

type PeoplePageProps = {
  searchParams: {
    q?: string;
  };
};

type PersonRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  family_role: string | null;
  status: string;
};

function formatDate(date: string | null) {
  if (!date) return "Nao informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export default async function PessoasPage({ searchParams }: PeoplePageProps) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) {
    redirect("/login");
  }

  if (!family) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 md:p-10">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-slate-900">Pessoas</h1>
            <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">
              Voltar ao dashboard
            </Link>
          </header>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-slate-700">Nenhuma familia vinculada ainda.</p>
            <p className="mt-2 text-sm text-slate-500">
              Execute a inicializacao no Dashboard para criar e vincular a Familia Seixas.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const query = searchParams.q?.trim() ?? "";

  let peopleQuery = supabase
    .from("people")
    .select("id, first_name, last_name, email, phone, birth_date, family_role, status")
    .eq("family_id", family.id)
    .is("deleted_at", null)
    .order("first_name", { ascending: true });

  if (query) {
    peopleQuery = peopleQuery.or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`
    );
  }

  const { data } = await peopleQuery;
  const people = (data ?? []) as PersonRow[];

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Pessoas</h1>
            <p className="text-slate-600 mt-1">{family.name}</p>
          </div>
          <nav className="flex gap-3 text-sm">
            <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">
              Dashboard
            </Link>
            <span className="text-slate-300">|</span>
            <Link href="/pessoas" className="text-slate-900 font-medium">
              Pessoas
            </Link>
          </nav>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Pesquisar por nome ou e-mail"
              className="w-full sm:max-w-md rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800"
            >
              Pesquisar
            </button>
          </form>

          {people.length === 0 ? (
            <p className="mt-6 rounded-xl bg-slate-50 p-4 text-slate-600">
              Nenhuma pessoa encontrada para esta familia.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-3 pr-3">Nome</th>
                    <th className="py-3 pr-3">Parentesco</th>
                    <th className="py-3 pr-3">Nascimento</th>
                    <th className="py-3 pr-3">E-mail</th>
                    <th className="py-3 pr-3">Telefone</th>
                    <th className="py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => (
                    <tr key={person.id} className="border-b border-slate-100">
                      <td className="py-3 pr-3 text-slate-900 font-medium">
                        {person.first_name} {person.last_name}
                      </td>
                      <td className="py-3 pr-3 text-slate-700">{person.family_role ?? "-"}</td>
                      <td className="py-3 pr-3 text-slate-700">{formatDate(person.birth_date)}</td>
                      <td className="py-3 pr-3 text-slate-700">{person.email ?? "-"}</td>
                      <td className="py-3 pr-3 text-slate-700">{person.phone ?? "-"}</td>
                      <td className="py-3 text-slate-700 capitalize">{person.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
