"use client";

import { useRef, useState, useTransition } from "react";
import { commitFinanceImport, previewFinanceImport, type ImportActionResult } from "@/app/financas/importar/actions";

const button = "rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export function FinanceImportClient() {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportActionResult>({ ok: false });
  const [pending, startTransition] = useTransition();

  function archiveForm() {
    const file = input.current?.files?.[0];
    if (!file) throw new Error("Selecione o arquivo ZIP oficial.");
    const data = new FormData();
    data.set("archive", file);
    return data;
  }

  function preview() {
    startTransition(async () => {
      try { setState(await previewFinanceImport(archiveForm())); }
      catch (error) { setState({ ok: false, error: error instanceof Error ? error.message : "Falha ao ler o arquivo." }); }
    });
  }

  function commit() {
    if (!state.preview?.canImportSafe || !window.confirm(`Confirmar a importação de ${state.preview.sourceSummary.safe} registros seguros no Supabase? ${state.preview.sourceSummary.quarantined} registros permanecerão em quarentena.`)) return;
    startTransition(async () => {
      try {
        const data = archiveForm();
        data.set("expected_digest", state.preview!.digest);
        setState(await commitFinanceImport(data));
      } catch (error) { setState({ ok: false, error: error instanceof Error ? error.message : "Falha ao importar." }); }
    });
  }

  const previewData = state.preview;
  const blocking = previewData?.issues.filter((issue) => issue.severity === "blocking") ?? [];
  const warnings = previewData?.issues.filter((issue) => issue.severity === "non_blocking") ?? [];

  return <div className="space-y-5">
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-slate-900">Pacote oficial</h2>
      <p className="mt-1 text-sm text-slate-600">O ZIP é validado integralmente. Nenhuma gravação ocorre durante a Preview.</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-sm font-medium text-slate-700">Arquivo ZIP
          <input ref={input} type="file" accept=".zip,application/zip" onChange={() => setState({ ok: false })}
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:font-semibold"/>
        </label>
        <button type="button" onClick={preview} disabled={pending} className={`${button} bg-slate-900 text-white hover:bg-slate-800`}>
          {pending ? "Analisando..." : "Gerar Preview"}
        </button>
      </div>
    </section>

    {state.error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}</div>}
    {state.commit && <section role="status" className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
      <h2 className="text-lg font-semibold">Relatório final da importação</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-white/80 p-3"><strong className="block text-2xl">{state.commit.created}</strong>criados</div>
        <div className="rounded-xl bg-white/80 p-3"><strong className="block text-2xl">{state.commit.updated}</strong>atualizados</div>
        <div className="rounded-xl bg-white/80 p-3"><strong className="block text-2xl">{state.commit.quarantined.length}</strong>em quarentena</div>
        <div className="rounded-xl bg-white/80 p-3"><strong className="block text-2xl">{state.commit.integrity.duplicates}</strong>duplicidades</div>
      </div>
      <ul className="mt-4 space-y-1">
        <li>Registros confirmados no Supabase: {state.commit.integrity.confirmed}/{state.commit.integrity.expected}</li>
        <li>Referências: {state.commit.integrity.referencesValid ? "válidas" : "requerem revisão"}</li>
        <li>Isolamento por família: {state.commit.integrity.familyIsolation ? "confirmado" : "não confirmado"}</li>
        <li>Hash: <code className="break-all">{state.commit.digest}</code></li>
      </ul>
      {state.commit.quarantined.length > 0 && <div className="mt-4"><strong>Não importados:</strong><ul className="mt-2 list-disc space-y-1 pl-5">{state.commit.quarantined.map((item) => <li key={`${item.dataset}/${item.externalId}`}><code>{item.dataset}/{item.externalId}</code> — {item.reason}</li>)}</ul></div>}
    </section>}

    {previewData && <>
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-wider text-sky-700">Preview · {previewData.competence}</p><h2 className="mt-1 text-xl font-semibold text-slate-900">{previewData.packageName}</h2><p className="mt-1 break-all text-xs text-slate-500">SHA-256 {previewData.digest}</p></div>
          <span className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${previewData.canImportSafe ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{previewData.canImportSafe ? "Registros seguros prontos" : "Importação segura bloqueada"}</span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-100 p-4"><span className="text-xs font-semibold uppercase text-slate-500">Total no pacote</span><strong className="mt-1 block text-2xl text-slate-900">{previewData.sourceSummary.total}</strong></div>
          <div className="rounded-2xl bg-emerald-50 p-4"><span className="text-xs font-semibold uppercase text-emerald-700">Seguros</span><strong className="mt-1 block text-2xl text-emerald-900">{previewData.sourceSummary.safe}</strong></div>
          <div className="rounded-2xl bg-amber-50 p-4"><span className="text-xs font-semibold uppercase text-amber-700">Quarentena</span><strong className="mt-1 block text-2xl text-amber-900">{previewData.sourceSummary.quarantined}</strong></div>
        </div>
        <div className="mt-5 overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="px-3 py-2">Conjunto</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2 text-right">Novos</th><th className="px-3 py-2 text-right">Atualizados</th></tr></thead><tbody>{previewData.counts.map((row) => <tr key={row.dataset} className="border-b border-slate-100"><td className="px-3 py-2 font-medium text-slate-800">{row.dataset}</td><td className="px-3 py-2 text-right">{row.total}</td><td className="px-3 py-2 text-right text-emerald-700">{row.new}</td><td className="px-3 py-2 text-right text-sky-700">{row.updated}</td></tr>)}</tbody></table></div>
      </section>

      {(blocking.length > 0 || warnings.length > 0) && <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5"><h2 className="font-semibold text-red-900">Inconsistências bloqueantes ({blocking.length})</h2><ul className="mt-3 space-y-2 text-sm text-red-800">{blocking.map((issue, index) => <li key={`${issue.code}-${issue.externalId ?? index}`} className="rounded-xl bg-white/70 p-3"><strong>{issue.code}</strong>{issue.dataset && <> · {issue.dataset}</>}{issue.externalId && <> · <code>{issue.externalId}</code></>}<br/>{issue.message}</li>)}</ul></div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-semibold text-amber-900">Alertas não bloqueantes ({warnings.length})</h2><ul className="mt-3 space-y-2 text-sm text-amber-900">{warnings.map((issue, index) => <li key={`${issue.code}-${index}`} className="rounded-xl bg-white/70 p-3"><strong>{issue.code}</strong><br/>{issue.message}</li>)}</ul></div>
      </section>}

      {previewData.reviewRequired.length > 0 && <section className="rounded-3xl border border-fuchsia-200 bg-fuchsia-50 p-5"><h2 className="font-semibold text-fuchsia-900">Registros marcados para revisão</h2><ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">{previewData.reviewRequired.map((item) => <li key={`${item.dataset}:${item.externalId}`} className="rounded-xl bg-white/80 p-3"><span className="text-fuchsia-700">{item.dataset}</span><br/><code className="break-all text-slate-800">{item.externalId}</code></li>)}</ul></section>}

      {previewData.quarantined.length > 0 && <section className="rounded-3xl border border-amber-300 bg-amber-50 p-5"><h2 className="font-semibold text-amber-950">Quarentena — não será importado</h2><ul className="mt-3 space-y-2 text-sm">{previewData.quarantined.map((item) => <li key={`${item.dataset}/${item.externalId}`} className="rounded-xl bg-white/80 p-3"><code className="break-all font-semibold">{item.dataset}/{item.externalId}</code><br/>{item.reason}</li>)}</ul></section>}

      <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">O commit revalida o ZIP, o hash, a sessão e todas as referências.</p>
        <button type="button" onClick={commit} disabled={pending || !previewData.canImportSafe} className={`${button} bg-emerald-600 text-white hover:bg-emerald-700`}>{pending ? "Processando..." : previewData.canImportSafe ? "Importar registros seguros" : "Corrija os bloqueios estruturais"}</button>
      </section>
    </>}
  </div>;
}
