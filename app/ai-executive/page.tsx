import { redirect } from "next/navigation";
import { AIExecutiveChat } from "@/app/ai-executive/ai-executive-chat";
import { MainNav } from "@/app/components/main-nav";
import { getFamilyContext } from "@/lib/family/context";

export const dynamic = "force-dynamic";

export default async function AIExecutivePage() {
  const { user, family, displayName } = await getFamilyContext();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-blue-50 via-white to-violet-50 p-6 sm:p-8">
            <MainNav current="ai-executive" />
            <div className="mt-8 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
                HERO.FamilyOS
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#061638] sm:text-4xl">
                AI Executive
              </h1>
              <p className="mt-3 text-lg text-slate-600">
                Olá, {displayName}. O que merece sua atenção hoje?
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Consulta somente leitura, protegida pela sua sessão e pelas regras RLS da família.
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <AIExecutiveChat />
        </section>
      </div>
    </main>
  );
}
