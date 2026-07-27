import { redirect } from "next/navigation";
import { MainNav } from "@/app/components/main-nav";
import { FinanceNav } from "@/app/financas/finance-nav";
import { FinanceImportClient } from "@/app/financas/importar/import-client";
import { canEditFamily, getFamilyContext } from "@/lib/family/context";

export default async function FinanceImportPage() {
  const context = await getFamilyContext();
  if (!context.user) redirect("/login");
  if (!context.family) redirect("/dashboard?setup=required");
  if (!canEditFamily(context)) redirect("/financas?error=forbidden");

  return <main className="min-h-screen bg-slate-50 p-3 sm:p-5 lg:p-8"><div className="mx-auto max-w-6xl space-y-5">
    <header className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="bg-gradient-to-r from-slate-950 via-slate-900 to-sky-900 p-5 text-white sm:p-7"><MainNav current="financas"/><div className="mt-7"><p className="text-xs font-semibold uppercase tracking-[.2em] text-sky-300">HERO.FamilyOS · Importação oficial</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Importar competência financeira</h1><p className="mt-1 text-sm text-slate-300">{context.family.name} · Preview obrigatória, RLS e atualização idempotente por external_id</p></div></div><div className="p-4"><FinanceNav current="import"/></div></header>
    <FinanceImportClient/>
  </div></main>;
}
