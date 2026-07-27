export default function LoadingFinance() {
  return <main className="min-h-screen bg-slate-50 p-6 md:p-10" aria-busy="true" aria-label="Carregando finanças">
    <div className="mx-auto max-w-7xl animate-pulse space-y-5">
      <div className="h-40 rounded-3xl bg-slate-200" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-28 rounded-2xl bg-slate-200" />)}</div>
      <div className="h-80 rounded-2xl bg-slate-200" />
    </div>
  </main>;
}
