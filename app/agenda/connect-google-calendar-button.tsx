"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ConnectGoogleCalendarButton() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleConnect = async () => {
    setErrorMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/agenda`,
        scopes: "openid email profile https://www.googleapis.com/auth/calendar.readonly",
        queryParams: {
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      },
    });

    if (error) {
      setErrorMessage(error.message);
    }
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleConnect}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        Conectar Google Calendar
      </button>
      {errorMessage && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>
      )}
    </div>
  );
}
