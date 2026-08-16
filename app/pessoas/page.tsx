import Link from "next/link";
import { Fragment } from "react";
import { redirect } from "next/navigation";
import { ExpandableCreateForm } from "@/app/components/expandable-create-form";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { FieldLabel } from "@/app/components/field-label";
import { MainNav } from "@/app/components/main-nav";
import { SubmitButton } from "@/app/components/submit-button";
import { InvitationForm } from "@/app/dashboard/invitation-form";
import {
  createPerson,
  updatePerson,
  updatePersonAccess,
} from "@/app/pessoas/actions";
import { getActionErrorMessage } from "@/lib/action-feedback";
import { createClient } from "@/lib/supabase/server";
import {
  canAdminFamily,
  canEditFamily,
  getFamilyContext,
} from "@/lib/family/context";

type PeoplePageProps = {
  searchParams: {
    q?: string;
    success?: string;
    error?: string;
    request_id?: string;
  };
};

type PersonRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  family_role: string | null;
  status: string;
};

type MembershipRow = {
  id: string;
  person_id: string | null;
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  status: "invited" | "active" | "suspended" | "revoked";
};

type InvitationRow = {
  email: string;
  role: "owner" | "admin" | "member" | "viewer";
  expires_at: string;
};

const PERSON_ROLES = [
  "Pet",
  "Dependente",
  "Filho(a)",
  "Cônjuge",
  "Pai/Mãe",
  "Familiar",
  "Outro",
];

const fieldClass = "block w-full rounded-xl border border-slate-300 px-3 py-2";

const accessRoleLabel: Record<MembershipRow["role"], string> = {
  owner: "Proprietário",
  admin: "Administrador",
  member: "Familiar — edita",
  viewer: "Convidado — somente leitura",
};

const accessStatusLabel: Record<MembershipRow["status"], string> = {
  invited: "Convidado",
  active: "Ativo",
  suspended: "Suspenso",
  revoked: "Revogado",
};

function formatDate(date: string | null) {
  if (!date) return "Nao informado";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export default async function PessoasPage({ searchParams }: PeoplePageProps) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) {
    redirect("/login");
  }

  if (!family) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 md:p-10">
        <div className="mx-auto max-w-6xl space-y-6">
          <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-slate-900">Pessoas</h1>
            <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">
              Voltar ao dashboard
            </Link>
          </header>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-slate-700">Nenhuma familia vinculada ainda.</p>
            <p className="mt-2 text-sm text-slate-500">
              Execute a inicializacao no Dashboard para criar e vincular a Familia Seixas.
            </p>
          </section>
        </div>
      </main>
    );
  }

  const query = searchParams.q?.trim() ?? "";
  const canEdit = canEditFamily(context);
  const canAdmin = canAdminFamily(context);

  let peopleQuery = supabase
    .from("people")
    .select("id, first_name, last_name, email, phone, birth_date, family_role, status")
    .eq("family_id", family.id)
    .is("deleted_at", null)
    .order("first_name", { ascending: true });

  if (query) {
    peopleQuery = peopleQuery.or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`
    );
  }

  const [peopleResult, membershipsResult, invitationsResult] = await Promise.all([
    peopleQuery,
    supabase
      .from("family_members")
      .select("id, person_id, user_id, role, status")
      .eq("family_id", family.id),
    canAdmin
      ? supabase
          .from("family_invitations")
          .select("email, role, expires_at")
          .eq("family_id", family.id)
          .is("accepted_at", null)
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
      : Promise.resolve({ data: [] as InvitationRow[] }),
  ]);
  const people = (peopleResult.data ?? []) as PersonRow[];
  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  const invitations = (invitationsResult.data ?? []) as InvitationRow[];
  const membershipByPerson = new Map(
    memberships.filter((item) => item.person_id).map((item) => [item.person_id, item])
  );
  const invitationByEmail = new Map(
    invitations.map((item) => [item.email.trim().toLowerCase(), item])
  );

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <MainNav current="pessoas" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Pessoas</h1>
            <p className="text-slate-600 mt-1">{family.name}</p>
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
              ? getActionErrorMessage(
                  searchParams.error,
                  searchParams.request_id
                )
              : searchParams.success === "pet_created"
                ? "Pet cadastrado com sucesso. Ele já pode ser selecionado em Documentos e Saúde."
                : "Pessoa cadastrada com sucesso."}
          </section>
        )}

        {canEdit ? (
          <ExpandableCreateForm
            id="create-person"
            title="Cadastrar pessoa, dependente ou pet"
            buttonLabel="NOVO CADASTRO"
            submitAction={createPerson}
            outcome={
              searchParams.error
                ? "error"
                : searchParams.success === "person_created" ||
                    searchParams.success === "pet_created"
                  ? "success"
                  : null
            }
            formClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            <div className="md:col-span-2 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              Para pets e dependentes sem acesso ao sistema, deixe o e-mail vazio.
              Convites são necessários apenas para pessoas que terão login.
            </div>
            <FieldLabel label="Nome" help="Identifica a pessoa em todos os módulos e seletores do FamilyOS.">
              <input name="first_name" required placeholder="Nome" autoComplete="given-name" className={fieldClass} />
            </FieldLabel>
            <FieldLabel label="Sobrenome" help="Completa a identificação exibida em documentos, saúde, tarefas e patrimônio.">
              <input name="last_name" required placeholder="Sobrenome" autoComplete="family-name" className={fieldClass} />
            </FieldLabel>
            <FieldLabel label="Vínculo familiar" help="Descreve o parentesco ou tipo de cadastro. Não concede acesso ao sistema; o acesso é administrado separadamente.">
              <select name="family_role" required defaultValue="Pet" className={fieldClass}>
                {PERSON_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
            </FieldLabel>
            <FieldLabel label="Data de nascimento" help="Usada para idade, histórico de saúde, documentos e lembretes relacionados à pessoa.">
              <input name="birth_date" type="date" className={fieldClass} />
            </FieldLabel>
            <FieldLabel label="E-mail" help="Contato da pessoa e endereço usado para vincular um convite de login. Pode ser qualquer e-mail válido; não precisa ser Gmail.">
              <input name="email" type="email" placeholder="Opcional para quem não terá login" autoComplete="email" className={fieldClass} />
            </FieldLabel>
            <FieldLabel label="Telefone" help="Contato informativo da pessoa; não altera permissões nem autenticação.">
              <input name="phone" type="tel" placeholder="Telefone opcional" autoComplete="tel" className={fieldClass} />
            </FieldLabel>
            <div className="md:col-span-2">
              <SubmitButton
                label="Salvar cadastro"
                pendingLabel="Salvando..."
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              />
            </div>
          </ExpandableCreateForm>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            Seu perfil possui acesso somente para consulta.
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Pesquisar por nome ou e-mail"
              className="w-full sm:max-w-md rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800"
            >
              Pesquisar
            </button>
          </form>

          {people.length === 0 ? (
            <p className="mt-6 rounded-xl bg-slate-50 p-4 text-slate-600">
              Nenhuma pessoa encontrada para esta familia.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-200">
                    <th className="py-3 pr-3">Nome</th>
                    <th className="py-3 pr-3">Parentesco</th>
                    <th className="py-3 pr-3">Nascimento</th>
                    <th className="py-3 pr-3">E-mail</th>
                    <th className="py-3 pr-3">Telefone</th>
                    <th className="py-3 pr-3">Cadastro</th>
                    <th className="py-3">Acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((person) => {
                    const membership = membershipByPerson.get(person.id);
                    const invitation = person.email
                      ? invitationByEmail.get(person.email.trim().toLowerCase())
                      : undefined;
                    const isCurrentUser = membership?.user_id === user.id;

                    return (
                      <Fragment key={person.id}>
                        <tr className="border-b border-slate-100">
                          <td className="py-3 pr-3 text-slate-900 font-medium">{person.first_name} {person.last_name}</td>
                          <td className="py-3 pr-3 text-slate-700">{person.family_role ?? "-"}</td>
                          <td className="py-3 pr-3 text-slate-700">{formatDate(person.birth_date)}</td>
                          <td className="py-3 pr-3 text-slate-700">{person.email ?? "-"}</td>
                          <td className="py-3 pr-3 text-slate-700">{person.phone ?? "-"}</td>
                          <td className="py-3 pr-3 text-slate-700 capitalize">{person.status}</td>
                          <td className="py-3 text-slate-700">
                            {membership
                              ? `${accessRoleLabel[membership.role]} · ${accessStatusLabel[membership.status]}`
                              : invitation
                                ? `Convite ${accessRoleLabel[invitation.role].toLowerCase()}`
                                : "Sem acesso"}
                          </td>
                        </tr>
                        {canEdit && (
                          <tr className="border-b border-slate-200 bg-slate-50/60">
                            <td colSpan={8} className="px-2 py-3">
                              <details className="rounded-xl border border-slate-200 bg-white p-3">
                                <summary className="cursor-pointer font-medium text-sky-700">Editar cadastro e acesso</summary>
                                <form action={updatePerson} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <input type="hidden" name="id" value={person.id} />
                                  <FieldLabel label="Nome" help="Identifica esta pessoa em todos os módulos e vínculos do FamilyOS.">
                                    <input name="first_name" required defaultValue={person.first_name} className={fieldClass} />
                                  </FieldLabel>
                                  <FieldLabel label="Sobrenome" help="Completa o nome exibido em documentos, saúde, tarefas e patrimônio.">
                                    <input name="last_name" required defaultValue={person.last_name} className={fieldClass} />
                                  </FieldLabel>
                                  <FieldLabel label="Vínculo familiar" help="Classifica o parentesco ou tipo de cadastro, sem conceder acesso ao sistema.">
                                    <select name="family_role" required defaultValue={person.family_role ?? "Familiar"} className={fieldClass}>
                                      {PERSON_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
                                    </select>
                                  </FieldLabel>
                                  <FieldLabel label="Data de nascimento" help="Usada para idade, histórico de saúde, documentos e lembretes.">
                                    <input name="birth_date" type="date" defaultValue={person.birth_date ?? ""} className={fieldClass} />
                                  </FieldLabel>
                                  <FieldLabel label="E-mail" help="Contato e referência para convites. Alterar aqui não muda o e-mail da conta de login já vinculada.">
                                    <input name="email" type="email" defaultValue={person.email ?? ""} className={fieldClass} />
                                  </FieldLabel>
                                  <FieldLabel label="Telefone" help="Contato informativo; não interfere no login nem nas permissões.">
                                    <input name="phone" type="tel" defaultValue={person.phone ?? ""} className={fieldClass} />
                                  </FieldLabel>
                                  <FieldLabel label="Status do cadastro" help="Controla a condição cadastral da pessoa. É separado do status de acesso ao sistema.">
                                    <select name="status" defaultValue={person.status} className={fieldClass}>
                                      <option value="active">Ativo</option>
                                      <option value="inactive">Inativo</option>
                                      <option value="pending">Pendente</option>
                                    </select>
                                  </FieldLabel>
                                  <div className="flex items-end">
                                    <SubmitButton label="Salvar dados pessoais" pendingLabel="Salvando..." className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" />
                                  </div>
                                </form>

                                {canAdmin && membership && (
                                  <section className="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4">
                                    <h3 className="font-semibold text-slate-900">Controle de acesso</h3>
                                    {isCurrentUser ? (
                                      <p className="mt-2 text-sm text-slate-600">Seu próprio acesso está protegido contra alteração ou revogação acidental.</p>
                                    ) : (
                                      <form action={updatePersonAccess} className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                        <input type="hidden" name="person_id" value={person.id} />
                                        <FieldLabel label="Nível de acesso" help="Administrador gerencia usuários e áreas críticas; Familiar adiciona e edita; Convidado somente consulta.">
                                          <select name="access_role" defaultValue={membership.role === "owner" ? "admin" : membership.role} className={fieldClass}>
                                            <option value="admin">Administrador</option>
                                            <option value="member">Familiar — adiciona e edita</option>
                                            <option value="viewer">Convidado — somente leitura</option>
                                          </select>
                                        </FieldLabel>
                                        <FieldLabel label="Status do acesso" help="Ativo permite entrar; Suspenso bloqueia temporariamente; Revogado encerra o vínculo de acesso.">
                                          <select name="access_status" defaultValue={membership.status === "invited" ? "active" : membership.status} className={fieldClass}>
                                            <option value="active">Ativo</option>
                                            <option value="suspended">Suspenso</option>
                                            <option value="revoked">Revogado</option>
                                          </select>
                                        </FieldLabel>
                                        <div className="flex flex-wrap gap-2 md:col-span-2">
                                          <SubmitButton label="Salvar acesso" pendingLabel="Salvando..." className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" />
                                        </div>
                                      </form>
                                    )}
                                    {!isCurrentUser && membership.status !== "revoked" && (
                                      <form action={updatePersonAccess} className="mt-3">
                                        <input type="hidden" name="person_id" value={person.id} />
                                        <input type="hidden" name="access_role" value={membership.role === "owner" ? "admin" : membership.role} />
                                        <input type="hidden" name="access_status" value="revoked" />
                                        <ConfirmSubmitButton label="Revogar acesso" confirmMessage={`Revogar o acesso de ${person.first_name} ao FamilyOS?`} className="rounded-xl border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50" />
                                      </form>
                                    )}
                                  </section>
                                )}

                                {canAdmin && !membership && person.family_role !== "Pet" && (
                                  <section className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                                    <h3 className="font-semibold text-slate-900">Sem acesso ao sistema</h3>
                                    {invitation ? (
                                      <p className="mt-2 text-sm text-slate-700">Existe convite pendente como {accessRoleLabel[invitation.role].toLowerCase()}, válido até {formatDate(invitation.expires_at)}.</p>
                                    ) : person.email ? (
                                      <InvitationForm defaultEmail={person.email} compact />
                                    ) : (
                                      <p className="mt-2 text-sm text-slate-700">Informe um e-mail no cadastro para gerar um convite de acesso.</p>
                                    )}
                                  </section>
                                )}
                              </details>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
