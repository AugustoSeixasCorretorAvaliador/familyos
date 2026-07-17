import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { ExpandableCreateForm } from "@/app/components/expandable-create-form";
import { MainNav } from "@/app/components/main-nav";
import { SubmitButton } from "@/app/components/submit-button";
import { createDocument, deleteDocument, updateDocument } from "@/app/documentos/actions";
import { getActionErrorMessage } from "@/lib/action-feedback";
import { canAdminFamily, getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: {
    success?: string;
    error?: string;
    request_id?: string;
    edit?: string;
  };
};

type PersonOption = {
  id: string;
  first_name: string;
  last_name: string;
};

type DocumentRow = {
  id: string;
  title: string;
  document_type: string;
  document_number: string | null;
  issuing_authority: string | null;
  country: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  file_name: string | null;
  storage_path: string;
  owner_person_id: string | null;
  processing_status: string;
  review_required: boolean;
  ocr_confidence: number | null;
  metadata: Record<string, unknown> | null;
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
};

const DOCUMENT_TYPES = [
  "RG",
  "CPF",
  "CNH",
  "Passaporte Brasileiro",
  "Passaporte Portugues",
  "Certidao de Nascimento",
  "Certidao de Casamento",
  "Escritura",
  "Matricula de Imovel",
  "Contrato",
  "Documento Generico",
];

function formatDate(date: string | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function getDocValidityLabel(expirationDate: string | null) {
  if (!expirationDate) return "Sem validade informada";
  const today = new Date();
  const expiry = new Date(expirationDate);
  const diffMs = expiry.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return "Vencido";
  if (diffDays <= 90) return "Vence em breve";
  return "Valido";
}

export default async function DocumentosPage({ searchParams }: PageProps) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const [{ data: peopleData }, { data: docsData }] = await Promise.all([
    supabase
      .from("people")
      .select("id, first_name, last_name")
      .eq("family_id", family.id)
      .is("deleted_at", null)
      .order("first_name", { ascending: true }),
    supabase
      .from("documents")
      .select(
        "id, title, document_type, document_number, issuing_authority, country, issue_date, expiration_date, file_name, storage_path, owner_person_id, processing_status, review_required, ocr_confidence, metadata, people:owner_person_id(first_name, last_name)"
      )
      .eq("family_id", family.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const people = (peopleData ?? []) as PersonOption[];
  const documents = ((docsData ?? []) as DocumentRow[]).map((document) => {
    const owner = Array.isArray(document.people) ? document.people[0] ?? null : document.people;
    return {
      ...document,
      people: owner,
    };
  });

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <MainNav current="documentos" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Documentos</h1>
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
            {searchParams.error
              ? getActionErrorMessage(searchParams.error, searchParams.request_id)
              : "Operacao concluida com sucesso."}
          </section>
        )}

        <ExpandableCreateForm
          id="create-document"
          title="Novo documento inteligente"
          buttonLabel="NOVO DOCUMENTO"
          submitAction={createDocument}
          encType="multipart/form-data"
          outcome={searchParams.error ? "error" : searchParams.success ? "success" : null}
          formClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
        >
            <input name="title" required placeholder="Titulo" className="rounded-xl border border-slate-300 px-3 py-2" />
            <select name="document_type" required className="rounded-xl border border-slate-300 px-3 py-2">
              <option value="">Tipo</option>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <select name="owner_person_id" className="rounded-xl border border-slate-300 px-3 py-2">
              <option value="">Titular</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.first_name} {person.last_name}
                </option>
              ))}
            </select>
            <input name="document_number" placeholder="Numero" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="issuing_authority" placeholder="Orgao emissor" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="country" defaultValue="Brasil" placeholder="Pais" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="issue_date" type="date" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="expiration_date" type="date" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input
              name="file"
              type="file"
              required
              accept="application/pdf,image/png,image/jpeg,image/webp,image/tiff,image/tif"
              className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2"
            />
            <p className="text-xs text-slate-500 md:col-span-2">Formatos: PDF, PNG, JPEG, WEBP, TIFF. Limite: 20MB.</p>
            <textarea name="observacoes" placeholder="Observacoes" className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" rows={3} />
            <div className="md:col-span-2">
              <SubmitButton
                label="Salvar documento"
                pendingLabel="Enviando documento..."
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
              />
            </div>
        </ExpandableCreateForm>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Lista de documentos</h2>
          {documents.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-600">Nenhum documento cadastrado.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {documents.map((document) => (
                <details
                  id={`document-${document.id}`}
                  key={document.id}
                  open={searchParams.edit === document.id}
                  className="scroll-mt-6 rounded-xl border border-slate-200 p-4"
                >
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900">{document.title}</p>
                      <p className="text-sm text-slate-600">{document.document_type}</p>
                      <p className="text-xs text-slate-500 mt-1">Pipeline: {document.processing_status}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-600">{getDocValidityLabel(document.expiration_date)}</p>
                      <p className="text-sm text-slate-500">Validade: {formatDate(document.expiration_date)}</p>
                    </div>
                  </summary>

                  <div className="mt-4 space-y-3">
                    <p className="text-sm text-slate-700">
                      Titular: {document.people ? `${document.people.first_name} ${document.people.last_name}` : "Nao informado"}
                    </p>
                    <p className="text-sm text-slate-700">Arquivo: {document.file_name ?? "Sem nome"}</p>
                    <Link
                      href={`/documentos/${document.id}/download`}
                      className="inline-block text-sm text-slate-700 underline hover:text-slate-900"
                    >
                      Baixar arquivo privado
                    </Link>
                    <div>
                      <Link
                        href={`/documentos/${document.id}/revisar`}
                        className="inline-block text-sm text-slate-700 underline hover:text-slate-900"
                      >
                        Revisar documento inteligente
                      </Link>
                      {document.ocr_confidence !== null && (
                        <p className="text-xs text-slate-500 mt-1">Confianca OCR: {Math.round(document.ocr_confidence)}%</p>
                      )}
                    </div>

                    <form action={updateDocument} encType="multipart/form-data" className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input type="hidden" name="document_id" value={document.id} />
                      <input name="title" required defaultValue={document.title} className="rounded-xl border border-slate-300 px-3 py-2" />
                      <select name="document_type" defaultValue={document.document_type} className="rounded-xl border border-slate-300 px-3 py-2">
                        {DOCUMENT_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <select name="owner_person_id" defaultValue={document.owner_person_id ?? ""} className="rounded-xl border border-slate-300 px-3 py-2">
                        <option value="">Titular</option>
                        {people.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.first_name} {person.last_name}
                          </option>
                        ))}
                      </select>
                      <input name="document_number" defaultValue={document.document_number ?? ""} placeholder="Numero" className="rounded-xl border border-slate-300 px-3 py-2" />
                      <input name="issuing_authority" defaultValue={document.issuing_authority ?? ""} placeholder="Orgao emissor" className="rounded-xl border border-slate-300 px-3 py-2" />
                      <input name="country" defaultValue={document.country ?? "Brasil"} placeholder="Pais" className="rounded-xl border border-slate-300 px-3 py-2" />
                      <input name="issue_date" type="date" defaultValue={document.issue_date ?? ""} className="rounded-xl border border-slate-300 px-3 py-2" />
                      <input name="expiration_date" type="date" defaultValue={document.expiration_date ?? ""} className="rounded-xl border border-slate-300 px-3 py-2" />
                      <input name="file" type="file" className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" />
                      <textarea
                        name="observacoes"
                        defaultValue={String(document.metadata?.observacoes ?? "")}
                        placeholder="Observacoes"
                        className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2"
                        rows={2}
                      />
                      <div className="md:col-span-2 flex gap-2">
                        <SubmitButton
                          label="Salvar alteracoes"
                          className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
                        />
                      </div>
                    </form>

                    {canAdminFamily(context) && (
                      <form action={deleteDocument}>
                        <input type="hidden" name="document_id" value={document.id} />
                        <ConfirmSubmitButton
                          label="Excluir documento"
                          confirmMessage="Deseja realmente excluir este documento?"
                          className="rounded-xl border border-red-300 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-50"
                        />
                      </form>
                    )}
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
