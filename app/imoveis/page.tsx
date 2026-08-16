import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { ExpandableCreateForm } from "@/app/components/expandable-create-form";
import { FieldLabel } from "@/app/components/field-label";
import { MainNav } from "@/app/components/main-nav";
import { SubmitButton } from "@/app/components/submit-button";
import {
  createProperty,
  deleteProperty,
  deletePropertyDocument,
  updateProperty,
} from "@/app/imoveis/actions";
import { PropertyDocumentUploadForm } from "@/app/imoveis/property-document-upload-form";
import { getActionErrorMessage } from "@/lib/action-feedback";
import { getDocumentProcessingLabel } from "@/lib/document-intake/status";
import { getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: {
    situacao?: string;
    success?: string;
    count?: string;
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
  outstanding_debt: number | null;
  valuation_date: string | null;
  valuation_source: string | null;
  ownership_review_status: string;
  metadata: Record<string, unknown> | null;
  property_owners: Array<{
    person_id: string;
    ownership_percentage: number | null;
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
  metadata: Record<string, unknown> | null;
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
const fieldClass = "block w-full rounded-xl border border-slate-300 px-3 py-2";

function PropertyFields({ property, people }: { property?: PropertyRow; people: PersonOption[] }) {
  const metadata = property?.metadata ?? {};
  const ownerIds = property?.property_owners.map((owner) => owner.person_id) ?? [];
  const ownershipByPerson = new Map(property?.property_owners.map((owner) => [owner.person_id, owner.ownership_percentage]) ?? []);
  return <>
    <FieldLabel label="Nome de identificação" help="Nome amigável usado para localizar o imóvel em patrimônio, finanças, tarefas, documentos e seguros."><input name="title" required defaultValue={property?.title ?? ""} placeholder="Ex.: Apartamento Centro" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Tipo de imóvel" help="Classifica o bem, como apartamento, casa, terreno ou sala comercial."><input name="property_type" defaultValue={property?.property_type ?? ""} placeholder="Ex.: Apartamento" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Endereço" help="Localização principal usada na identificação, documentos e vínculos patrimoniais." className="md:col-span-2"><input name="address" required defaultValue={property?.address ?? ""} placeholder="Endereço completo" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Cidade" help="Município do imóvel, usado para organização e consulta."><input name="city" defaultValue={property?.city ?? ""} placeholder="Cidade" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Estado" help="UF ou estado do imóvel para complementar a localização."><input name="state" defaultValue={property?.state ?? ""} placeholder="Estado" className={fieldClass} /></FieldLabel>
    <FieldLabel label="CEP" help="Código postal usado para completar e conferir o endereço."><input name="postal_code" defaultValue={property?.postal_code ?? ""} placeholder="CEP" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Matrícula / RGI" help="Identificador registral do imóvel para rastreabilidade jurídica e documental."><input name="registry_number" defaultValue={property?.registry_number ?? ""} placeholder="Matrícula ou RGI" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Situação" help="Define se o imóvel é próprio, alugado, está à venda, vendido, em aquisição ou vago."><select name="situacao" defaultValue={String(metadata.situacao ?? "Proprio")} className={fieldClass}>{SITUACOES.map((situacao) => <option key={situacao}>{situacao}</option>)}</select></FieldLabel>
    <FieldLabel label="Valor estimado" help="Valor atual usado no cálculo do patrimônio total exibido em Imóveis."><input name="valor_estimado" defaultValue={String(metadata.valor_estimado ?? "")} inputMode="decimal" placeholder="Ex.: 850.000,00" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Dívida vinculada" help="Saldo devedor do imóvel abatido do valor proporcional para calcular o patrimônio líquido familiar."><input name="outstanding_debt" defaultValue={property?.outstanding_debt ?? ""} inputMode="decimal" placeholder="Ex.: 120.000,00" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Data da avaliação" help="Data de referência do valor estimado; permite saber se a avaliação está atualizada."><input name="valuation_date" type="date" defaultValue={property?.valuation_date ?? ""} className={fieldClass} /></FieldLabel>
    <FieldLabel label="Fonte da avaliação" help="Origem do valor estimado, como avaliação profissional, anúncio comparável ou valor declarado."><input name="valuation_source" defaultValue={property?.valuation_source ?? ""} placeholder="Ex.: Laudo de avaliação" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Renda mensal" help="Receita mensal informativa do imóvel, somada no resumo de aluguéis desta visualização."><input name="renda_mensal" defaultValue={String(metadata.renda_mensal ?? "")} inputMode="decimal" placeholder="Ex.: 3.500,00" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Condomínio" help="Valor mensal de condomínio mantido como referência de custo do imóvel."><input name="condominio" defaultValue={String(metadata.condominio ?? "")} inputMode="decimal" placeholder="Valor do condomínio" className={fieldClass} /></FieldLabel>
    <FieldLabel label="IPTU" help="Valor de IPTU registrado como referência tributária do imóvel."><input name="iptu" defaultValue={String(metadata.iptu ?? "")} inputMode="decimal" placeholder="Valor do IPTU" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Observações" help="Informações complementares para consulta; não alteram automaticamente os cálculos patrimoniais." className="md:col-span-2"><textarea name="observacoes" defaultValue={String(metadata.observacoes ?? "")} placeholder="Observações opcionais" className={fieldClass} rows={3} /></FieldLabel>
    <FieldLabel label="Proprietários e participação familiar" help="Marque os proprietários e informe o percentual de cada um. A soma pode ser inferior a 100% quando parte do imóvel pertence a terceiros, mas nunca pode exceder 100%." className="md:col-span-2"><div className="space-y-2 rounded-xl border border-slate-200 p-3">{people.map((person) => <div key={person.id} className="grid gap-2 sm:grid-cols-[1fr_10rem]"><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" name="owner_ids" value={person.id} defaultChecked={ownerIds.includes(person.id)} />{person.first_name} {person.last_name}</label><input name={`ownership_percentage_${person.id}`} defaultValue={ownershipByPerson.get(person.id) ?? ""} inputMode="decimal" placeholder="Participação %" aria-label={`Participação de ${person.first_name} ${person.last_name}`} className={fieldClass}/></div>)}</div><span className="mt-1 block text-xs font-normal text-slate-500">Cadastros sem percentual permanecem sinalizados para revisão e não entram no total proporcional.</span></FieldLabel>
  </>;
}

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
        "id, title, address, city, state, postal_code, property_type, registry_number, metadata, outstanding_debt, valuation_date, valuation_source, ownership_review_status, property_owners(person_id, ownership_percentage, people(first_name, last_name))"
      )
      .eq("family_id", family.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select(
        "id, property_id, title, document_type, file_name, issue_date, expiration_date, processing_status, metadata, created_at"
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
  const alugueisMensaisTotal = properties.reduce((sum, property) => {
    const value = property.metadata?.renda_mensal;
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
  const successMessage =
    searchParams.success === "documents_archived"
      ? `${searchParams.count ?? "1"} arquivo(s) arquivado(s) e vinculado(s) ao imovel com sucesso.`
      : searchParams.success === "updated"
        ? "Alteracoes do imovel salvas com sucesso."
        : "Operacao realizada com sucesso.";

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
            <p className="mt-1 text-sm text-slate-500">
              Alugueis mensais nesta visualizacao: {toCurrency(alugueisMensaisTotal)}
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
              : successMessage}
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
            <PropertyFields people={people} />
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
                        <PropertyFields property={property} people={people} />
                        <div className="md:col-span-2 flex gap-2">
                          <SubmitButton
                            label="Salvar alteracoes"
                            className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
                          />
                        </div>
                      </form>

                      <section className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
                        <h3 className="font-medium text-slate-900">
                          Documentos patrimoniais ({documents.length})
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          RGI, escritura, IPTU, bombeiros, laudemio, planta, convencao e seguro.
                        </p>

                        <PropertyDocumentUploadForm
                          familyId={family.id}
                          propertyId={property.id}
                          documentTypes={PROPERTY_DOCUMENT_TYPES}
                        />

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
                                    {document.document_type} ·{" "}
                                    {getDocumentProcessingLabel(
                                      document.processing_status,
                                      document.metadata
                                    )}
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
