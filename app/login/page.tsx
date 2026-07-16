"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setErrorMessage(null);

    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      setErrorMessage("Preencha o .env.local com URL e chave publishable do Supabase.");
      return;
    }

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes("unsupported provider")) {
        setErrorMessage(
          "Google OAuth nao esta habilitado no Supabase. Ative em Authentication > Providers > Google."
        );
        return;
      }

      setErrorMessage(error.message);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#eaf4ff_0,_#f8fafc_42%,_#f8fafc_100%)] p-6">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-xl shadow-blue-950/10">
        <div className="border-b border-slate-100 bg-gradient-to-br from-white via-blue-50/40 to-violet-50/40 px-6 py-4">
          <Image
            src="/brand/hero-familyos-horizontal.png"
            alt="HERO.FamilyOS — O Sistema Operacional da Família"
            width={1774}
            height={887}
            priority
            className="h-auto w-full object-contain"
          />
        </div>
        <div className="p-8">
          <h1 className="text-2xl font-semibold text-slate-900">Sua família, organizada e protegida.</h1>
          <p className="mt-2 text-slate-600">Entre para acessar o sistema operacional da sua família.</p>

        <button
          onClick={handleGoogleLogin}
          className="mt-8 w-full rounded-xl bg-gradient-to-r from-[#075fc7] to-[#7137d5] px-4 py-3 font-medium text-white shadow-lg shadow-blue-900/15 transition-all hover:brightness-105"
        >
          Entrar com Google
        </button>
        {!process.env.NEXT_PUBLIC_SUPABASE_URL && (
          <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Preencha o arquivo .env.local com as chaves do Supabase para habilitar o login.
          </p>
        )}
        {errorMessage && (
          <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {errorMessage}
          </p>
        )}
        </div>
      </div>
    </main>
  );
}
