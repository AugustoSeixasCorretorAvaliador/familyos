import { redirect } from "next/navigation";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { MainNav } from "@/app/components/main-nav";
import { createProperty, deleteProperty, updateProperty } from "@/app/imoveis/actions";
import { getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: {
    situacao?: string;
    success?: string;
    error?: string;
  };
};

type PersonOption = {
  id: string;
  first_name: string;
  last_name: string;
};

type PropertyRow = {
  id: string;
  title: string;
  address: string;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  property_type: string | null;
  registry_number: string | null;
  metadata: Record<string, unknown> | null;
  property_owners: Array<{
    person_id: string;
    people:
      | {
          first_name: string;
          last_name: string;
        }
      | {
          first_name: string;
          last_name: string;
        }[]
      | null;
  }>;
};

const SITUACOES = ["Proprio", "Alugado", "A venda", "Vendido", "Em aquisicao", "Vago"];

function toCurrency(value: unknown) {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default async function ImoveisPage({ searchParams }: PageProps) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const [{ data: peopleData }, { data: propertiesData }] = await Promise.all([
    supabase
      .from("people")
      .select("id, first_name, last_name")
      .eq("family_id", family.id)
      .is("deleted_at", null)
      .order("first_name", { ascending: true }),
    supabase
      .from("properties")
      .select(
        "id, title, address, city, state, postal_code, property_type, registry_number, metadata, property_owners(person_id, people(first_name, last_name))"
      )
      .eq("family_id", family.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const people = (peopleData ?? []) as PersonOption[];
  let properties = ((propertiesData ?? []) as PropertyRow[]).map((property) => ({
    ...property,
    property_owners: property.property_owners.map((owner) => ({
      ...owner,
      people: Array.isArray(owner.people) ? owner.people[0] ?? null : owner.people,
    })),
  }));

  if (searchParams.situacao) {
    properties = properties.filter(
      (property) => (property.metadata?.situacao as string | undefined) === searchParams.situacao
    );
  }

  const patrimonioTotal = properties.reduce((sum, property) => {
    const value = property.metadata?.valor_estimado;
    return sum + (typeof value === "number" ? value : 0);
  }, 0);

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <MainNav current="imoveis" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Imoveis</h1>
            <p className="mt-1 text-slate-600">{family.name}</p>
            <p className="mt-2 text-sm text-slate-500">
              Patrimonio total nesta visualizacao: {toCurrency(patrimonioTotal)}
            </p>
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
              ? "Nao foi possivel concluir a operacao. Verifique os dados e tente novamente."
              : "Operacao realizada com sucesso."}
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Novo imovel</h2>
          <form action={createProperty} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <input name="title" required placeholder="Nome de identificacao" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="property_type" placeholder="Tipo" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="address" required placeholder="Endereco" className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" />
            <input name="city" placeholder="Cidade" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="state" placeholder="Estado" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="postal_code" placeholder="CEP" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="registry_number" placeholder="Matricula/RGI" className="rounded-xl border border-slate-300 px-3 py-2" />
            <select name="situacao" className="rounded-xl border border-slate-300 px-3 py-2">
              {SITUACOES.map((situacao) => (
                <option key={situacao} value={situacao}>
                  {situacao}
                </option>
              ))}
            </select>
            <input name="valor_estimado" placeholder="Valor estimado" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="renda_mensal" placeholder="Renda mensal" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="condominio" placeholder="Condominio" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="iptu" placeholder="IPTU" className="rounded-xl border border-slate-300 px-3 py-2" />
            <textarea name="observacoes" placeholder="Observacoes" className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" rows={3} />
            <div className="md:col-span-2">
              <label className="block text-sm text-slate-600 mb-1">Proprietarios</label>
              <select name="owner_ids" multiple className="w-full rounded-xl border border-slate-300 px-3 py-2 min-h-28">
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.first_name} {person.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800">
                Salvar imovel
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Lista de imoveis</h2>
            <form className="flex gap-2">
              <select name="situacao" defaultValue={searchParams.situacao ?? ""} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                <option value="">Todas as situacoes</option>
                {SITUACOES.map((situacao) => (
                  <option key={situacao} value={situacao}>
                    {situacao}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
                Filtrar
              </button>
            </form>
          </div>

          {properties.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-600">Nenhum imovel cadastrado.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {properties.map((property) => {
                const metadata = property.metadata ?? {};
                const owners = property.property_owners
                  .map((owner) => owner.people)
                  .filter((owner): owner is { first_name: string; last_name: string } => !!owner)
                  .map((owner) => `${owner.first_name} ${owner.last_name}`)
                  .join(", ");

                return (
                  <details key={property.id} className="rounded-xl border border-slate-200 p-4">
                    <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900">{property.title}</p>
                        <p className="text-sm text-slate-600">{property.city ?? "Cidade nao informada"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600">{String(metadata.situacao ?? "-")}</p>
                        <p className="text-sm font-medium text-slate-900">{toCurrency(metadata.valor_estimado)}</p>
                      </div>
                    </summary>

                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-slate-700">Proprietarios: {owners || "Nao informado"}</p>
                      <form action={updateProperty} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input type="hidden" name="property_id" value={property.id} />
                        <input name="title" defaultValue={property.title} required className="rounded-xl border border-slate-300 px-3 py-2" />
                        <input name="property_type" defaultValue={property.property_type ?? ""} placeholder="Tipo" className="rounded-xl border border-slate-300 px-3 py-2" />
                        <input name="address" defaultValue={property.address} required className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" />
                        <input name="city" defaultValue={property.city ?? ""} placeholder="Cidade" className="rounded-xl border border-slate-300 px-3 py-2" />
                        <input name="state" defaultValue={property.state ?? ""} placeholder="Estado" className="rounded-xl border border-slate-300 px-3 py-2" />
                        <input name="postal_code" defaultValue={property.postal_code ?? ""} placeholder="CEP" className="rounded-xl border border-slate-300 px-3 py-2" />
                        <input name="registry_number" defaultValue={property.registry_number ?? ""} placeholder="Matricula/RGI" className="rounded-xl border border-slate-300 px-3 py-2" />
                        <select name="situacao" defaultValue={String(metadata.situacao ?? "Proprio")} className="rounded-xl border border-slate-300 px-3 py-2">
                          {SITUACOES.map((situacao) => (
                            <option key={situacao} value={situacao}>
                              {situacao}
                            </option>
                          ))}
                        </select>
                        <input name="valor_estimado" defaultValue={String(metadata.valor_estimado ?? "")} placeholder="Valor estimado" className="rounded-xl border border-slate-300 px-3 py-2" />
                        <input name="renda_mensal" defaultValue={String(metadata.renda_mensal ?? "")} placeholder="Renda mensal" className="rounded-xl border border-slate-300 px-3 py-2" />
                        <input name="condominio" defaultValue={String(metadata.condominio ?? "")} placeholder="Condominio" className="rounded-xl border border-slate-300 px-3 py-2" />
                        <input name="iptu" defaultValue={String(metadata.iptu ?? "")} placeholder="IPTU" className="rounded-xl border border-slate-300 px-3 py-2" />
                        <textarea
                          name="observacoes"
                          defaultValue={String(metadata.observacoes ?? "")}
                          placeholder="Observacoes"
                          className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2"
                          rows={2}
                        />
                        <div className="md:col-span-2">
                          <label className="block text-sm text-slate-600 mb-1">Proprietarios</label>
                          <select
                            name="owner_ids"
                            multiple
                            className="w-full rounded-xl border border-slate-300 px-3 py-2 min-h-24"
                            defaultValue={property.property_owners.map((owner) => owner.person_id)}
                          >
                            {people.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.first_name} {person.last_name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="md:col-span-2 flex gap-2">
                          <button type="submit" className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800">
                            Salvar alteracoes
                          </button>
                        </div>
                      </form>

                      <form action={deleteProperty}>
                        <input type="hidden" name="property_id" value={property.id} />
                        <ConfirmSubmitButton
                          label="Excluir imovel"
                          confirmMessage="Deseja realmente excluir este imovel?"
                          className="rounded-xl border border-red-300 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-50"
                        />
                      </form>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
