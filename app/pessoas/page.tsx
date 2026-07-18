import Link from "next/link";
import { redirect } from "next/navigation";
import { ExpandableCreateForm } from "@/app/components/expandable-create-form";
import { MainNav } from "@/app/components/main-nav";
import { SubmitButton } from "@/app/components/submit-button";
import { createPerson } from "@/app/pessoas/actions";
import { getActionErrorMessage } from "@/lib/action-feedback";
import { createClient } from "@/lib/supabase/server";
import { canEditFamily, getFamilyContext } from "@/lib/family/context";

type PeoplePageProps = {
  searchParams: {
    q?: string;
    success?: string;
    error?: string;
    request_id?: string;
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
  const context = await getFamilyContext();
  const { user, family } = context;
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
        <header className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <MainNav current="pessoas" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Pessoas</h1>
            <p className="text-slate-600 mt-1">{family.name}</p>
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
            {searchParams.error
              ? getActionErrorMessage(
                  searchParams.error,
                  searchParams.request_id
                )
              : searchParams.success === "pet_created"
                ? "Pet cadastrado com sucesso. Ele já pode ser selecionado em Documentos e Saúde."
                : "Pessoa cadastrada com sucesso."}
          </section>
        )}

        {canEditFamily(context) ? (
          <ExpandableCreateForm
            id="create-person"
            title="Cadastrar pessoa, dependente ou pet"
            buttonLabel="NOVO CADASTRO"
            submitAction={createPerson}
            outcome={
              searchParams.error
                ? "error"
                : searchParams.success === "person_created" ||
                    searchParams.success === "pet_created"
                  ? "success"
                  : null
            }
            formClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <div className="md:col-span-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              Para pets e dependentes sem acesso ao sistema, deixe o e-mail vazio.
              Convites são necessários apenas para pessoas que terão login.
            </div>
            <input
              name="first_name"
              required
              placeholder="Nome"
              aria-label="Nome"
              autoComplete="given-name"
              className="rounded-xl border border-slate-300 px-3 py-2"
            />
            <input
              name="last_name"
              required
              placeholder="Sobrenome"
              aria-label="Sobrenome"
              autoComplete="family-name"
              className="rounded-xl border border-slate-300 px-3 py-2"
            />
            <select
              name="family_role"
              required
              defaultValue="Pet"
              aria-label="Tipo de vínculo familiar"
              className="rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="Pet">Pet</option>
              <option value="Dependente">Dependente</option>
              <option value="Filho(a)">Filho(a)</option>
              <option value="Cônjuge">Cônjuge</option>
              <option value="Pai/Mãe">Pai/Mãe</option>
              <option value="Familiar">Familiar</option>
              <option value="Outro">Outro</option>
            </select>
            <input
              name="birth_date"
              type="date"
              aria-label="Data de nascimento"
              className="rounded-xl border border-slate-300 px-3 py-2"
            />
            <input
              name="email"
              type="email"
              placeholder="E-mail (somente se terá login)"
              aria-label="E-mail, somente se terá login"
              autoComplete="email"
              className="rounded-xl border border-slate-300 px-3 py-2"
            />
            <input
              name="phone"
              type="tel"
              placeholder="Telefone (opcional)"
              aria-label="Telefone opcional"
              autoComplete="tel"
              className="rounded-xl border border-slate-300 px-3 py-2"
            />
            <div className="md:col-span-2">
              <SubmitButton
                label="Salvar cadastro"
                pendingLabel="Salvando..."
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              />
            </div>
          </ExpandableCreateForm>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            Seu perfil possui acesso somente para consulta.
          </section>
        )}

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
