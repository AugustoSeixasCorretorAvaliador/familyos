"use client";

export default function FinanceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
    <section className="max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm" role="alert">
      <p className="text-sm font-semibold uppercase tracking-wider text-red-600">Módulo financeiro</p>
      <h1 className="mt-2 text-2xl font-semibold text-slate-900">Não foi possível carregar os dados</h1>
      <p className="mt-3 text-slate-600">A operação foi interrompida com segurança. Tente novamente; se persistir, informe o horário ao suporte.</p>
      <button onClick={reset} className="mt-6 rounded-xl bg-slate-900 px-4 py-2 font-medium text-white">Tentar novamente</button>
    </section>
  </main>;
}
