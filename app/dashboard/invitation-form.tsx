"use client";

import { useFormState } from "react-dom";
import {
  createFamilyInvitation,
  type InvitationActionState,
} from "@/app/dashboard/actions";
import { FieldLabel } from "@/app/components/field-label";
import { SubmitButton } from "@/app/components/submit-button";

const INITIAL_STATE: InvitationActionState = {
  error: null,
  invitationUrl: null,
};

type InvitationFormProps = {
  defaultEmail?: string;
  compact?: boolean;
};

export function InvitationForm({
  defaultEmail,
  compact = false,
}: InvitationFormProps = {}) {
  const [state, action] = useFormState(createFamilyInvitation, INITIAL_STATE);

  return (
    <form
      action={action}
      className={`mt-4 grid gap-3 ${compact ? "md:grid-cols-2" : "md:grid-cols-[1fr_190px_auto]"}`}
    >
      <FieldLabel
        label="E-mail de acesso"
        help="O convite só poderá ser aceito por uma conta autenticada com este mesmo e-mail. O endereço não precisa ser Gmail."
      >
        <input
          name="email"
          type="email"
          required
          readOnly={Boolean(defaultEmail)}
          defaultValue={defaultEmail}
          placeholder="E-mail do familiar cadastrado"
          className="block w-full rounded-xl border border-slate-300 px-3 py-2 read-only:bg-slate-50"
        />
      </FieldLabel>
      <FieldLabel
        label="Nível de acesso"
        help="Administrador gerencia a família; Familiar adiciona e edita; Convidado possui somente leitura."
      >
        <select name="role" defaultValue="member" className="block w-full rounded-xl border border-slate-300 px-3 py-2">
          <option value="member">Familiar — adiciona e edita</option>
          <option value="admin">Administrador</option>
          <option value="viewer">Convidado — somente leitura</option>
        </select>
      </FieldLabel>
      <div className={compact ? "md:col-span-2" : "flex items-end"}>
        <SubmitButton
          label="Gerar convite"
          pendingLabel="Gerando..."
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
        />
      </div>

      {state.error && (
        <p className={`text-sm text-red-700 ${compact ? "md:col-span-2" : "md:col-span-3"}`}>{state.error}</p>
      )}
      {state.invitationUrl && (
        <div className={`rounded-xl border border-emerald-200 bg-emerald-50 p-3 ${compact ? "md:col-span-2" : "md:col-span-3"}`}>
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
