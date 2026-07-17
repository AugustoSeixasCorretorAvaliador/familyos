import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { ExpandableCreateForm } from "@/app/components/expandable-create-form";
import { MainNav } from "@/app/components/main-nav";
import { SubmitButton } from "@/app/components/submit-button";
import {
  createProperty,
  createPropertyDocument,
  deleteProperty,
  deletePropertyDocument,
  updateProperty,
} from "@/app/imoveis/actions";
import { getActionErrorMessage } from "@/lib/action-feedback";
import { getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: {
    situacao?: string;
    success?: string;
    error?: string;
    request_id?: string;
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

type PropertyDocumentRow = {
  id: string;
  property_id: string;
  title: string;
  document_type: string;
  file_name: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  processing_status: string;
  created_at: string;
};

const SITUACOES = ["Proprio", "Alugado", "A venda", "Vendido", "Em aquisicao", "Vago"];
const PROPERTY_DOCUMENT_TYPES = [
  "Promessa de Compra e Venda",
  "RGI / Matricula",
  "Escritura",
  "IPTU",
  "Corpo de Bombeiros",
  "Laudemio",
  "Planta",
  "Convencao de Condominio",
  "Documento de Condominio",
  "Seguro",
  "Outro",
];

function toCurrency(value: unknown) {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default async function ImoveisPage({ searchParams }: PageProps) {
  const { user, family, membership } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const [{ data: peopleData }, { data: propertiesData }, { data: documentsData }] = await Promise.all([
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
    supabase
      .from("documents")
      .select(
        "id, property_id, title, document_type, file_name, issue_date, expiration_date, processing_status, created_at"
      )
      .eq("family_id", family.id)
      .not("property_id", "is", null)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const people = (peopleData ?? []) as PersonOption[];
  const propertyDocuments = (documentsData ?? []) as PropertyDocumentRow[];
  const canAdmin = membership?.role === "owner" || membership?.role === "admin";
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
              ? getActionErrorMessage(searchParams.error, searchParams.request_id)
              : "Operacao realizada com sucesso."}
          </section>
        )}

        <ExpandableCreateForm
          id="create-property"
          title="Cadastrar imóvel"
          buttonLabel="NOVO IMÓVEL"
          submitAction={createProperty}
          outcome={searchParams.error ? "error" : searchParams.success ? "success" : null}
          formClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
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
              <SubmitButton
                label="Salvar imovel"
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
              />
            </div>
        </ExpandableCreateForm>

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
                const documents = propertyDocuments.filter(
                  (document) => document.property_id === property.id
                );

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
                          <SubmitButton
                            label="Salvar alteracoes"
                            className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
                          />
                        </div>
                      </form>

                      <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                        <h3 className="font-medium text-slate-900">Documentos patrimoniais</h3>
                        <p className="mt-1 text-sm text-slate-600">
                          RGI, escritura, IPTU, bombeiros, laudemio, planta, convencao e seguro.
                        </p>

                        <form
                          action={createPropertyDocument}
                          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
                        >
                          <input type="hidden" name="property_id" value={property.id} />
                          <input
                            name="files"
                            type="file"
                            multiple
                            required
                            accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,application/pdf,image/png,image/jpeg,image/webp,image/tiff"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 md:col-span-2"
                          />
                          <p className="text-xs text-slate-500 md:col-span-2">
                            Selecione um arquivo para OCR ou ate 10 arquivos para arquivar no historico sem OCR.
                          </p>
                          <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900 md:col-span-2">
                            <input
                              name="archive_without_ocr"
                              type="checkbox"
                              className="mt-0.5 h-4 w-4 rounded border-emerald-400"
                            />
                            <span>
                              <strong className="block">Somente arquivar no historico</strong>
                              Nao executar OCR agora. Os arquivos permanecem vinculados ao imovel e poderao ser revisados ou processados depois.
                            </span>
                          </label>
                          <select
                            name="document_type"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2"
                          >
                            <option value="">Tipo (opcional antes do OCR)</option>
                            {PROPERTY_DOCUMENT_TYPES.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                          <input
                            name="title"
                            placeholder="Titulo (opcional antes do OCR)"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2"
                          />
                          <label className="text-sm text-slate-600">
                            Emissao
                            <input
                              name="issue_date"
                              type="date"
                              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                            />
                          </label>
                          <label className="text-sm text-slate-600">
                            Validade
                            <input
                              name="expiration_date"
                              type="date"
                              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                            />
                          </label>
                          <textarea
                            name="observacoes"
                            rows={2}
                            placeholder="Observacoes"
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 md:col-span-2"
                          />
                          <div className="md:col-span-2">
                            <SubmitButton
                              label="Enviar e guardar"
                              pendingLabel="Enviando arquivos..."
                              className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                            />
                          </div>
                        </form>

                        {documents.length === 0 ? (
                          <p className="mt-4 text-sm text-slate-500">Nenhum documento vinculado.</p>
                        ) : (
                          <div className="mt-4 space-y-2">
                            {documents.map((document) => (
                              <div
                                key={document.id}
                                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{document.title}</p>
                                  <p className="text-xs text-slate-500">
                                    {document.document_type} · {document.processing_status}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Link
                                    href={`/documentos/${document.id}/download`}
                                    className="rounded-lg border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700"
                                  >
                                    Baixar
                                  </Link>
                                  <Link
                                    href={`/documentos/${document.id}/revisar`}
                                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                                  >
                                    Revisar
                                  </Link>
                                  <Link
                                    href={`/documentos?edit=${document.id}#document-${document.id}`}
                                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700"
                                  >
                                    Substituir
                                  </Link>
                                  {canAdmin && (
                                    <form action={deletePropertyDocument}>
                                      <input type="hidden" name="document_id" value={document.id} />
                                      <ConfirmSubmitButton
                                        label="Excluir"
                                        confirmMessage="Deseja excluir este documento patrimonial?"
                                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700"
                                      />
                                    </form>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>

                      {canAdmin && (
                        <form action={deleteProperty}>
                          <input type="hidden" name="property_id" value={property.id} />
                          <ConfirmSubmitButton
                            label="Excluir imovel"
                            confirmMessage="Deseja realmente excluir este imovel?"
                            className="rounded-xl border border-red-300 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-50"
                          />
                        </form>
                      )}
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
