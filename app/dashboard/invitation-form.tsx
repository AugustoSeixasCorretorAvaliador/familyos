"use client";

import { useFormState } from "react-dom";
import {
  createFamilyInvitation,
  type InvitationActionState,
} from "@/app/dashboard/actions";
import { SubmitButton } from "@/app/components/submit-button";

const INITIAL_STATE: InvitationActionState = {
  error: null,
  invitationUrl: null,
};

export function InvitationForm() {
  const [state, action] = useFormState(createFamilyInvitation, INITIAL_STATE);

  return (
    <form action={action} className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_auto]">
      <input
        name="email"
        type="email"
        required
        placeholder="E-mail do familiar cadastrado"
        className="rounded-xl border border-slate-300 px-3 py-2"
      />
      <select name="role" defaultValue="member" className="rounded-xl border border-slate-300 px-3 py-2">
        <option value="member">Membro — adiciona e edita</option>
        <option value="admin">Administrador</option>
        <option value="viewer">Somente leitura</option>
      </select>
      <SubmitButton
        label="Gerar convite"
        pendingLabel="Gerando..."
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      />

      {state.error && (
        <p className="text-sm text-red-700 md:col-span-3">{state.error}</p>
      )}
      {state.invitationUrl && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 md:col-span-3">
          <p className="text-sm font-medium text-emerald-900">Convite criado. Envie este link ao familiar:</p>
          <input
            readOnly
            value={state.invitationUrl}
            aria-label="Link do convite"
            className="mt-2 w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-slate-800"
          />
        </div>
      )}
    </form>
  );
}
