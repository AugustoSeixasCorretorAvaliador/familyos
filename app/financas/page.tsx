import { redirect } from "next/navigation";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { MainNav } from "@/app/components/main-nav";
import { SubmitButton } from "@/app/components/submit-button";
import { createAccount, deleteAccount, updateAccount } from "@/app/financas/actions";
import { SaldoCell } from "@/app/financas/saldo-cell";
import { getActionErrorMessage } from "@/lib/action-feedback";
import { canAdminFamily, getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: {
    success?: string;
    error?: string;
    request_id?: string;
  };
};

type PersonOption = {
  id: string;
  first_name: string;
  last_name: string;
};

type AccountRow = {
  id: string;
  institution: string;
  account_type: string;
  account_identifier: string | null;
  owner_person_id: string | null;
  metadata: Record<string, unknown> | null;
  people: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
};

function formatDate(date: string | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function toCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default async function FinancasPage({ searchParams }: PageProps) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const [{ data: peopleData }, { data: accountsData }] = await Promise.all([
    supabase
      .from("people")
      .select("id, first_name, last_name")
      .eq("family_id", family.id)
      .is("deleted_at", null)
      .order("first_name", { ascending: true }),
    supabase
      .from("accounts")
      .select("id, institution, account_type, account_identifier, owner_person_id, metadata, people:owner_person_id(first_name, last_name)")
      .eq("family_id", family.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  const people = (peopleData ?? []) as PersonOption[];
  const accounts = ((accountsData ?? []) as AccountRow[]).map((account) => ({
    ...account,
    people: Array.isArray(account.people) ? account.people[0] ?? null : account.people,
  }));

  const saldoConsolidado = accounts.reduce((sum, account) => {
    const saldo = account.metadata?.saldo_atual;
    return sum + (typeof saldo === "number" ? saldo : 0);
  }, 0);

  const ultimaAtualizacao = accounts
    .map((account) => account.metadata?.data_atualizacao)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort()
    .at(-1) ?? null;

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <MainNav current="financas" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Financas</h1>
            <p className="mt-1 text-slate-600">{family.name}</p>
            <p className="mt-2 text-sm text-slate-500">
              Saldo consolidado: {toCurrency(saldoConsolidado)} | Ultima atualizacao: {formatDate(ultimaAtualizacao)}
            </p>
          </div>
        </header>

        {(searchParams.success || searchParams.error) && (
          <section
            className={`rounded-2xl border p-4 shadow-sm ${
              searchParams.error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {searchParams.error
              ? getActionErrorMessage(searchParams.error, searchParams.request_id)
              : "Operacao concluida com sucesso."}
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Nova conta</h2>
          <form action={createAccount} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <input name="institution" required placeholder="Banco" className="rounded-xl border border-slate-300 px-3 py-2" />
            <select name="owner_person_id" className="rounded-xl border border-slate-300 px-3 py-2">
              <option value="">Titular</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.first_name} {person.last_name}
                </option>
              ))}
            </select>
            <input name="account_type" required placeholder="Tipo de conta" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="account_identifier" placeholder="Identificador da conta" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="agencia" placeholder="Agencia" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="ultimos_quatro" placeholder="Ultimos quatro digitos" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="saldo_atual" placeholder="Saldo atual" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="data_atualizacao" type="date" className="rounded-xl border border-slate-300 px-3 py-2" />
            <textarea name="observacoes" placeholder="Observacoes" className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" rows={3} />
            <div className="md:col-span-2">
              <SubmitButton
                label="Salvar conta"
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
              />
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Contas cadastradas</h2>
          {accounts.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-600">Nenhuma conta cadastrada.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {accounts.map((account) => {
                const metadata = account.metadata ?? {};
                return (
                  <details key={account.id} className="rounded-xl border border-slate-200 p-4">
                    <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-slate-900">{account.institution}</p>
                        <p className="text-sm text-slate-600">{account.account_type}</p>
                      </div>
                      <SaldoCell amount={typeof metadata.saldo_atual === "number" ? metadata.saldo_atual : null} />
                    </summary>

                    <div className="mt-4 space-y-3">
                      <p className="text-sm text-slate-700">
                        Titular: {account.people ? `${account.people.first_name} ${account.people.last_name}` : "Nao informado"}
                      </p>
                      <p className="text-sm text-slate-700">
                        Ultima atualizacao: {formatDate(typeof metadata.data_atualizacao === "string" ? metadata.data_atualizacao : null)}
                      </p>

                      <form action={updateAccount} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input type="hidden" name="account_id" value={account.id} />
                        <input name="institution" required defaultValue={account.institution} className="rounded-xl border border-slate-300 px-3 py-2" />
                        <select name="owner_person_id" defaultValue={account.owner_person_id ?? ""} className="rounded-xl border border-slate-300 px-3 py-2">
                          <option value="">Titular</option>
                          {people.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.first_name} {person.last_name}
                            </option>
                          ))}
                        </select>
                        <input name="account_type" required defaultValue={account.account_type} className="rounded-xl border border-slate-300 px-3 py-2" />
                        <input name="account_identifier" defaultValue={account.account_identifier ?? ""} className="rounded-xl border border-slate-300 px-3 py-2" />
                        <input name="agencia" defaultValue={String(metadata.agencia ?? "")} className="rounded-xl border border-slate-300 px-3 py-2" />
                        <input name="ultimos_quatro" defaultValue={String(metadata.ultimos_quatro ?? "")} className="rounded-xl border border-slate-300 px-3 py-2" />
                        <input name="saldo_atual" defaultValue={String(metadata.saldo_atual ?? "")} className="rounded-xl border border-slate-300 px-3 py-2" />
                        <input name="data_atualizacao" type="date" defaultValue={typeof metadata.data_atualizacao === "string" ? metadata.data_atualizacao : ""} className="rounded-xl border border-slate-300 px-3 py-2" />
                        <textarea
                          name="observacoes"
                          defaultValue={String(metadata.observacoes ?? "")}
                          className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2"
                          rows={2}
                        />
                        <div className="md:col-span-2">
                          <SubmitButton
                            label="Salvar alteracoes"
                            className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
                          />
                        </div>
                      </form>

                      {canAdminFamily(context) && (
                        <form action={deleteAccount}>
                          <input type="hidden" name="account_id" value={account.id} />
                          <ConfirmSubmitButton
                            label="Excluir conta"
                            confirmMessage="Deseja realmente excluir esta conta?"
                            className="rounded-xl border border-red-300 text-red-700 px-4 py-2 text-sm font-medium hover:bg-red-50"
                          />
                        </form>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
