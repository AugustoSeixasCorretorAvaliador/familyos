"use client";

import { useState } from "react";
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
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h1 className="text-2xl font-semibold text-slate-900">FamilyOS</h1>
        <p className="mt-2 text-slate-600">Entre para acessar seu dashboard familiar.</p>

        <button
          onClick={handleGoogleLogin}
          className="mt-8 w-full rounded-xl bg-slate-900 text-white py-3 px-4 font-medium hover:bg-slate-800 transition-colors"
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
    </main>
  );
}
