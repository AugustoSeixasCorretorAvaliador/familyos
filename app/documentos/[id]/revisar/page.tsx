import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { MainNav } from "@/app/components/main-nav";
import { confirmDocumentReview, processDocumentOCR, rejectDocumentReview } from "@/app/documentos/actions";
import { getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: { id: string };
  searchParams: { success?: string; error?: string };
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
  processing_status: string;
  ocr_confidence: number | null;
  review_required: boolean;
  metadata: Record<string, unknown> | null;
};

type MetadataRow = {
  interpreted_fields: Record<string, unknown> | null;
  confidence_by_field: Record<string, unknown> | null;
  overall_confidence: number | null;
  extracted_text: string | null;
};

type OCRJobRow = {
  id: string;
  provider: string;
  status: string;
  confidence: number | null;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
};

const FIELD_LABELS: Array<{ key: string; label: string }> = [
  { key: "nome", label: "Nome" },
  { key: "numero", label: "Numero" },
  { key: "cpf", label: "CPF" },
  { key: "rg", label: "RG" },
  { key: "orgao_emissor", label: "Orgao emissor" },
  { key: "pais", label: "Pais" },
  { key: "livro", label: "Livro" },
  { key: "folha", label: "Folha" },
  { key: "termo", label: "Termo" },
  { key: "matricula", label: "Matricula" },
  { key: "cartorio", label: "Cartorio" },
  { key: "data_emissao", label: "Data emissao" },
  { key: "data_validade", label: "Data validade" },
  { key: "naturalidade", label: "Naturalidade" },
  { key: "filiacao", label: "Filiacao" },
  { key: "observacoes", label: "Observacoes" },
];

function confidenceValue(value: unknown) {
  if (typeof value === "number") return Math.round(value * 100);
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed <= 1 ? Math.round(parsed * 100) : Math.round(parsed);
  }
  return null;
}

function valueString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

export default async function RevisarDocumentoPage({ params, searchParams }: PageProps) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const [{ data: document }, { data: metadata }, { data: jobs }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, document_type, document_number, issuing_authority, country, issue_date, expiration_date, processing_status, ocr_confidence, review_required, metadata")
      .eq("id", params.id)
      .eq("family_id", family.id)
      .maybeSingle(),
    supabase
      .from("document_metadata")
      .select("interpreted_fields, confidence_by_field, overall_confidence, extracted_text")
      .eq("document_id", params.id)
      .eq("family_id", family.id)
      .maybeSingle(),
    supabase
      .from("document_ocr_jobs")
      .select("id, provider, status, confidence, duration_ms, error_message, created_at")
      .eq("document_id", params.id)
      .eq("family_id", family.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (!document) {
    redirect("/documentos?error=not_found");
  }

  const doc = document as DocumentRow;
  const parsed = (metadata ?? null) as MetadataRow | null;
  const latestJobs = (jobs ?? []) as OCRJobRow[];

  const interpretedFields = parsed?.interpreted_fields ?? {};
  const confidenceByField = parsed?.confidence_by_field ?? {};

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <MainNav current="documentos" />
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Revisar Documento</h1>
              <p className="mt-1 text-slate-600">{doc.title}</p>
              <p className="text-sm text-slate-500">Status: {doc.processing_status}</p>
            </div>
            <Link href="/documentos" className="text-sm text-slate-700 underline hover:text-slate-900">
              Voltar para documentos
            </Link>
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
              ? "Nao foi possivel concluir a operacao deste documento."
              : "Operacao concluida com sucesso."}
          </section>
        )}

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Preview</h2>
            <div className="mt-4 h-[680px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <iframe title="Preview do documento" src={`/documentos/${doc.id}/download`} className="h-full w-full" />
            </div>
            <form action={processDocumentOCR} className="mt-4">
              <input type="hidden" name="document_id" value={doc.id} />
              <button
                type="submit"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Reprocessar OCR
              </button>
            </form>

            {latestJobs.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Historico OCR</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {latestJobs.map((job) => (
                    <li key={job.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      {job.provider} - {job.status}
                      {job.confidence !== null ? ` - ${Math.round(job.confidence)}%` : ""}
                      {job.duration_ms ? ` - ${job.duration_ms}ms` : ""}
                      {job.error_message ? ` - ${job.error_message}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Campos sugeridos</h2>
            <p className="mt-1 text-sm text-slate-600">
              Campos abaixo de 80% de confianca aparecem destacados para conferencia humana.
            </p>

            <form action={confirmDocumentReview} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="hidden" name="document_id" value={doc.id} />

              <input
                name="title"
                defaultValue={doc.title}
                placeholder="Titulo"
                className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2"
              />
              <input
                name="document_type"
                defaultValue={doc.document_type}
                placeholder="Tipo"
                className="rounded-xl border border-slate-300 px-3 py-2"
              />
              <input
                name="document_number"
                defaultValue={doc.document_number ?? ""}
                placeholder="Numero principal"
                className="rounded-xl border border-slate-300 px-3 py-2"
              />
              <input
                name="issuing_authority"
                defaultValue={doc.issuing_authority ?? ""}
                placeholder="Orgao emissor"
                className="rounded-xl border border-slate-300 px-3 py-2"
              />
              <input
                name="country"
                defaultValue={doc.country ?? "Brasil"}
                placeholder="Pais"
                className="rounded-xl border border-slate-300 px-3 py-2"
              />
              <input name="issue_date" type="date" defaultValue={doc.issue_date ?? ""} className="rounded-xl border border-slate-300 px-3 py-2" />
              <input
                name="expiration_date"
                type="date"
                defaultValue={doc.expiration_date ?? ""}
                className="rounded-xl border border-slate-300 px-3 py-2"
              />

              {FIELD_LABELS.map((field) => {
                const confidence = confidenceValue(confidenceByField[field.key]);
                const lowConfidence = confidence !== null && confidence < 80;

                return (
                  <div key={field.key} className={`space-y-1 ${field.key === "observacoes" ? "md:col-span-2" : ""}`}>
                    <label className="text-xs text-slate-600">{field.label}</label>
                    {field.key === "observacoes" ? (
                      <textarea
                        name={field.key}
                        rows={3}
                        defaultValue={valueString(interpretedFields[field.key])}
                        className={`w-full rounded-xl border px-3 py-2 ${
                          lowConfidence ? "border-amber-400 bg-amber-50" : "border-slate-300"
                        }`}
                      />
                    ) : (
                      <input
                        name={field.key}
                        defaultValue={valueString(interpretedFields[field.key])}
                        className={`w-full rounded-xl border px-3 py-2 ${
                          lowConfidence ? "border-amber-400 bg-amber-50" : "border-slate-300"
                        }`}
                      />
                    )}
                    <p className={`text-xs ${lowConfidence ? "text-amber-700" : "text-slate-500"}`}>
                      Confianca: {confidence !== null ? `${confidence}%` : "n/d"}
                    </p>
                  </div>
                );
              })}

              <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
                <button type="submit" className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800">
                  Confirmar e salvar
                </button>
              </div>
            </form>

            <form action={rejectDocumentReview} className="mt-3">
              <input type="hidden" name="document_id" value={doc.id} />
              <ConfirmSubmitButton
                label="Rejeitar sugestao"
                confirmMessage="Deseja marcar este documento como rejeitado para revisao posterior?"
                className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
              />
            </form>

            {parsed?.extracted_text && (
              <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-800">Texto extraido (OCR)</summary>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-slate-700">
                  {parsed.extracted_text}
                </pre>
              </details>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
