"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function DisconnectGoogleCalendarButton() {
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDisconnect = async () => {
    setPending(true);
    setErrorMessage(null);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const providerToken = (session as unknown as { provider_token?: string | null } | null)?.provider_token;

    if (providerToken) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(providerToken)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        });
      } catch {
        // If revoke fails, continue with local sign out so user can reconnect.
      }
    }

    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMessage(error.message);
      setPending(false);
      return;
    }

    window.location.href = "/login";
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleDisconnect}
        disabled={pending}
        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
      >
        {pending ? "Desconectando..." : "Desconectar Google Calendar"}
      </button>
      <p className="mt-2 text-xs text-slate-500">Esta acao encerra a sessao atual para revogar o acesso ao calendario.</p>
      {errorMessage && (
        <p className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>
      )}
    </div>
  );
}
