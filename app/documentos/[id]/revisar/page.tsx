import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { MainNav } from "@/app/components/main-nav";
import { confirmDocumentReview, processDocumentOCR, rejectDocumentReview } from "@/app/documentos/actions";
import { OcrSubmitButton } from "@/app/documentos/[id]/revisar/ocr-submit-button";
import { getFamilyContext } from "@/lib/family/context";
import { getOcrConfig } from "@/lib/ocr/config";
import { getOcrPublicMessage } from "@/lib/ocr/errors";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: { id: string };
  searchParams: { success?: string; error?: string; warning?: string; reason?: string };
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
  ocr_provider: string | null;
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
  suggestion_json: Record<string, unknown> | null;
  started_at: string | null;
  finished_at: string | null;
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
  { key: "data_nascimento", label: "Data nascimento" },
  { key: "nacionalidade", label: "Nacionalidade" },
  { key: "naturalidade", label: "Naturalidade" },
  { key: "filiacao", label: "Filiacao" },
  { key: "valor_monetario", label: "Valor monetario" },
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

type OcrHistoryMetadata = {
  attempt?: number;
  model?: string | null;
  request_id?: string | null;
  error_code?: string | null;
  extracted_fields_count?: number;
  warning_count?: number;
  confidence_kind?: string;
};

function historyMetadata(value: Record<string, unknown> | null): OcrHistoryMetadata {
  const meta = value?.ocr_meta;
  return meta && typeof meta === "object" && !Array.isArray(meta)
    ? (meta as OcrHistoryMetadata)
    : {};
}

function feedbackMessage(searchParams: PageProps["searchParams"], provider: string | null) {
  if (searchParams.warning === "ocr_failed" || searchParams.error === "ocr_failed") {
    return getOcrPublicMessage(searchParams.reason);
  }
  if (searchParams.success === "ocr_done") {
    return provider === "openai"
      ? "OCR concluido pela OpenAI. Confira os campos sugeridos antes de salvar."
      : "OCR concluido. Confira os campos sugeridos antes de salvar.";
  }
  if (searchParams.success === "manual" || searchParams.success === "uploaded_manual") {
    return "Documento salvo para preenchimento e revisao manual.";
  }
  if (searchParams.success === "uploaded_ocr") {
    return "Documento salvo e OCR concluido. Confira os campos sugeridos antes de salvar.";
  }
  return searchParams.success ? "Operacao concluida com sucesso." : null;
}

export default async function RevisarDocumentoPage({ params, searchParams }: PageProps) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const [{ data: document }, { data: metadata }, { data: jobs }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, document_type, document_number, issuing_authority, country, issue_date, expiration_date, processing_status, ocr_provider, ocr_confidence, review_required, metadata")
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
      .select("id, provider, status, confidence, duration_ms, error_message, suggestion_json, started_at, finished_at, created_at")
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
  const { reviewThreshold } = getOcrConfig();
  const feedback = feedbackMessage(searchParams, doc.ocr_provider);
  const hasOcrWarning = searchParams.warning === "ocr_failed" || searchParams.error === "ocr_failed";
  const isProcessing = doc.processing_status === "OCR em processamento";

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

        {feedback && (
          <section
            className={`rounded-2xl border p-4 shadow-sm ${
              hasOcrWarning
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {feedback}
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
              <OcrSubmitButton processing={isProcessing} />
            </form>

            {latestJobs.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-900">Historico OCR</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-700">
                  {latestJobs.map((job) => (
                    <li key={job.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      {(() => {
                        const meta = historyMetadata(job.suggestion_json);
                        return (
                          <>
                            <p className="font-medium">
                              {job.provider} - {job.status}
                              {job.confidence !== null ? ` - ${Math.round(job.confidence)}%` : ""}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {meta.model ? `Modelo: ${meta.model} · ` : ""}
                              {meta.attempt ? `Tentativa: ${meta.attempt} · ` : ""}
                              {`Inicio: ${new Date(job.started_at ?? job.created_at).toLocaleString("pt-BR")}`}
                              {job.duration_ms !== null ? ` · Duracao: ${job.duration_ms}ms` : ""}
                              {typeof meta.extracted_fields_count === "number"
                                ? ` · Campos: ${meta.extracted_fields_count}`
                                : ""}
                              {typeof meta.warning_count === "number"
                                ? ` · Avisos: ${meta.warning_count}`
                                : ""}
                              {meta.request_id ? ` · Request: ${meta.request_id}` : ""}
                              {meta.error_code ? ` · Codigo: ${meta.error_code}` : ""}
                            </p>
                            {job.error_message ? (
                              <p className="mt-1 text-xs text-amber-700">{job.error_message}</p>
                            ) : null}
                          </>
                        );
                      })()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Campos sugeridos</h2>
            <p className="mt-1 text-sm text-slate-600">
              Campos abaixo de {Math.round(reviewThreshold * 100)}% de confianca estimada aparecem
              destacados para conferencia humana.
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
                const lowConfidence =
                  confidence !== null && confidence < Math.round(reviewThreshold * 100);

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
