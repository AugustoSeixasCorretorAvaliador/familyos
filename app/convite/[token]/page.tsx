import { redirect } from "next/navigation";
import { acceptFamilyInvitation } from "@/app/dashboard/actions";
import { SubmitButton } from "@/app/components/submit-button";
import { getFamilyContext } from "@/lib/family/context";

type PageProps = {
  params: { token: string };
};

export default async function ConvitePage({ params }: PageProps) {
  const { user, family } = await getFamilyContext();
  const token = params.token;

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    redirect("/dashboard?error=invitation_invalid");
  }

  if (!user) {
    redirect(`/login?invite=${encodeURIComponent(token)}`);
  }

  if (family) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-lg rounded-3xl border border-blue-100 bg-white p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">Convite familiar</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Entrar na familia</h1>
        <p className="mt-3 text-slate-600">
          O convite sera validado com o e-mail autenticado. Ele so pode ser usado uma vez e precisa estar dentro da validade.
        </p>
        <form action={acceptFamilyInvitation} className="mt-6">
          <input type="hidden" name="token" value={token} />
          <SubmitButton
            label="Aceitar convite"
            pendingLabel="Validando convite..."
            className="w-full rounded-xl bg-gradient-to-r from-[#075fc7] to-[#7137d5] px-4 py-3 font-medium text-white disabled:opacity-60"
          />
        </form>
      </section>
    </main>
  );
}
