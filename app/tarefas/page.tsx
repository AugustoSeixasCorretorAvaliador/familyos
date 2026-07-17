import { redirect } from "next/navigation";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { ExpandableCreateForm } from "@/app/components/expandable-create-form";
import { MainNav } from "@/app/components/main-nav";
import { SubmitButton } from "@/app/components/submit-button";
import { createTask, deleteTask, toggleTaskStatus, updateTask } from "@/app/tarefas/actions";
import { getActionErrorMessage } from "@/lib/action-feedback";
import { canAdminFamily, getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  searchParams: {
    status?: string;
    priority?: string;
    responsible?: string;
    success?: string;
    error?: string;
    request_id?: string;
  };
};

type PersonOption = { id: string; first_name: string; last_name: string };
type PropertyOption = { id: string; title: string };
type DocumentOption = { id: string; title: string };
type LegalCaseOption = { id: string; title: string };

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  status: string;
  due_date: string | null;
  completed_at: string | null;
  responsible_person_id: string | null;
  related_person_id: string | null;
  related_property_id: string | null;
  related_document_id: string | null;
  related_legal_case_id: string | null;
  responsible: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
};

const PRIORITIES = ["Baixa", "Media", "Alta", "Urgente"];
const STATUSES = ["A fazer", "Em andamento", "Aguardando terceiro", "Concluida", "Cancelada"];

function formatDate(date: string | null) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function isOverdue(task: TaskRow) {
  if (!task.due_date) return false;
  if (task.status === "Concluida" || task.status === "Cancelada") return false;
  const due = new Date(task.due_date);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < new Date().setHours(0, 0, 0, 0);
}

export default async function TarefasPage({ searchParams }: PageProps) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const [peopleRes, propertiesRes, documentsRes, legalCasesRes, tasksRes] = await Promise.all([
    supabase
      .from("people")
      .select("id, first_name, last_name")
      .eq("family_id", family.id)
      .is("deleted_at", null)
      .order("first_name", { ascending: true }),
    supabase
      .from("properties")
      .select("id, title")
      .eq("family_id", family.id)
      .is("deleted_at", null)
      .order("title", { ascending: true }),
    supabase
      .from("documents")
      .select("id, title")
      .eq("family_id", family.id)
      .is("deleted_at", null)
      .order("title", { ascending: true }),
    supabase
      .from("legal_cases")
      .select("id, title")
      .eq("family_id", family.id)
      .order("title", { ascending: true }),
    supabase
      .from("family_tasks")
      .select("id, title, description, category, priority, status, due_date, completed_at, responsible_person_id, related_person_id, related_property_id, related_document_id, related_legal_case_id, responsible:responsible_person_id(first_name,last_name)")
      .eq("family_id", family.id)
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  const people = (peopleRes.data ?? []) as PersonOption[];
  const properties = (propertiesRes.data ?? []) as PropertyOption[];
  const documents = (documentsRes.data ?? []) as DocumentOption[];
  const legalCases = (legalCasesRes.data ?? []) as LegalCaseOption[];

  let tasks = ((tasksRes.data ?? []) as TaskRow[]).map((task) => ({
    ...task,
    responsible: Array.isArray(task.responsible) ? task.responsible[0] ?? null : task.responsible,
  }));

  if (searchParams.status) {
    tasks = tasks.filter((task) => task.status === searchParams.status);
  }
  if (searchParams.priority) {
    tasks = tasks.filter((task) => task.priority === searchParams.priority);
  }
  if (searchParams.responsible) {
    tasks = tasks.filter((task) => task.responsible_person_id === searchParams.responsible);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <MainNav current="tarefas" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Tarefas</h1>
            <p className="mt-1 text-slate-600">{family.name}</p>
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

        <ExpandableCreateForm
          id="create-task"
          title="Cadastrar tarefa"
          buttonLabel="NOVA TAREFA"
          submitAction={createTask}
          outcome={searchParams.error ? "error" : searchParams.success ? "success" : null}
          formClassName="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
            <input name="title" required placeholder="Titulo" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="category" placeholder="Categoria" className="rounded-xl border border-slate-300 px-3 py-2" />
            <select name="responsible_person_id" className="rounded-xl border border-slate-300 px-3 py-2">
              <option value="">Responsavel</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>
              ))}
            </select>
            <select name="priority" defaultValue="Media" className="rounded-xl border border-slate-300 px-3 py-2">
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
            <select name="status" defaultValue="A fazer" className="rounded-xl border border-slate-300 px-3 py-2">
              {STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <input name="due_date" type="date" className="rounded-xl border border-slate-300 px-3 py-2" />
            <select name="related_person_id" className="rounded-xl border border-slate-300 px-3 py-2">
              <option value="">Pessoa relacionada</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>
              ))}
            </select>
            <select name="related_property_id" className="rounded-xl border border-slate-300 px-3 py-2">
              <option value="">Imovel relacionado</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>{property.title}</option>
              ))}
            </select>
            <select name="related_document_id" className="rounded-xl border border-slate-300 px-3 py-2">
              <option value="">Documento relacionado</option>
              {documents.map((document) => (
                <option key={document.id} value={document.id}>{document.title}</option>
              ))}
            </select>
            <select name="related_legal_case_id" className="rounded-xl border border-slate-300 px-3 py-2">
              <option value="">Processo relacionado</option>
              {legalCases.map((legalCase) => (
                <option key={legalCase.id} value={legalCase.id}>{legalCase.title}</option>
              ))}
            </select>
            <textarea name="description" rows={3} placeholder="Descricao" className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" />
            <div className="md:col-span-2">
              <SubmitButton
                label="Salvar tarefa"
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
              />
            </div>
        </ExpandableCreateForm>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Filtros</h2>
          <form className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <select name="responsible" defaultValue={searchParams.responsible ?? ""} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="">Todos responsaveis</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>
              ))}
            </select>
            <select name="status" defaultValue={searchParams.status ?? ""} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="">Todos status</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select name="priority" defaultValue={searchParams.priority ?? ""} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
              <option value="">Todas prioridades</option>
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>{priority}</option>
              ))}
            </select>
            <button type="submit" className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Aplicar filtros</button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Lista de tarefas</h2>
          {tasks.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-600">Nenhuma tarefa encontrada.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {tasks.map((task) => (
                <details
                  key={task.id}
                  className={`rounded-xl border p-4 ${isOverdue(task) ? "border-red-300 bg-red-50" : "border-slate-200"}`}
                >
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-slate-900">{task.title}</p>
                      <p className="text-sm text-slate-600">
                        {task.status} | {task.priority} | Prazo: {formatDate(task.due_date)}
                      </p>
                    </div>
                    {isOverdue(task) && <span className="text-xs font-medium text-red-700">Vencida</span>}
                  </summary>

                  <div className="mt-4 space-y-3">
                    <form action={updateTask} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input type="hidden" name="id" value={task.id} />
                      <input name="title" required defaultValue={task.title} className="rounded-xl border border-slate-300 px-3 py-2" />
                      <input name="category" defaultValue={task.category ?? ""} className="rounded-xl border border-slate-300 px-3 py-2" />
                      <select name="responsible_person_id" defaultValue={task.responsible_person_id ?? ""} className="rounded-xl border border-slate-300 px-3 py-2">
                        <option value="">Responsavel</option>
                        {people.map((person) => (
                          <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>
                        ))}
                      </select>
                      <select name="priority" defaultValue={task.priority} className="rounded-xl border border-slate-300 px-3 py-2">
                        {PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>{priority}</option>
                        ))}
                      </select>
                      <select name="status" defaultValue={task.status} className="rounded-xl border border-slate-300 px-3 py-2">
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                      <input name="due_date" type="date" defaultValue={task.due_date ?? ""} className="rounded-xl border border-slate-300 px-3 py-2" />
                      <select name="related_person_id" defaultValue={task.related_person_id ?? ""} className="rounded-xl border border-slate-300 px-3 py-2">
                        <option value="">Pessoa relacionada</option>
                        {people.map((person) => (
                          <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>
                        ))}
                      </select>
                      <select name="related_property_id" defaultValue={task.related_property_id ?? ""} className="rounded-xl border border-slate-300 px-3 py-2">
                        <option value="">Imovel relacionado</option>
                        {properties.map((property) => (
                          <option key={property.id} value={property.id}>{property.title}</option>
                        ))}
                      </select>
                      <select name="related_document_id" defaultValue={task.related_document_id ?? ""} className="rounded-xl border border-slate-300 px-3 py-2">
                        <option value="">Documento relacionado</option>
                        {documents.map((document) => (
                          <option key={document.id} value={document.id}>{document.title}</option>
                        ))}
                      </select>
                      <select name="related_legal_case_id" defaultValue={task.related_legal_case_id ?? ""} className="rounded-xl border border-slate-300 px-3 py-2">
                        <option value="">Processo relacionado</option>
                        {legalCases.map((legalCase) => (
                          <option key={legalCase.id} value={legalCase.id}>{legalCase.title}</option>
                        ))}
                      </select>
                      <textarea name="description" rows={2} defaultValue={task.description ?? ""} className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" />
                      <div className="md:col-span-2 flex flex-wrap gap-2">
                        <SubmitButton
                          label="Salvar alteracoes"
                          className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
                        />
                      </div>
                    </form>

                    <div className="flex flex-wrap gap-2">
                      <form action={toggleTaskStatus}>
                        <input type="hidden" name="id" value={task.id} />
                        <input type="hidden" name="action" value="complete" />
                        <SubmitButton
                          label="Concluir"
                          pendingLabel="Concluindo..."
                          className="rounded-xl border border-emerald-300 text-emerald-700 px-3 py-1 text-sm hover:bg-emerald-50 disabled:opacity-60"
                        />
                      </form>
                      <form action={toggleTaskStatus}>
                        <input type="hidden" name="id" value={task.id} />
                        <input type="hidden" name="action" value="reopen" />
                        <SubmitButton
                          label="Reabrir"
                          pendingLabel="Reabrindo..."
                          className="rounded-xl border border-amber-300 text-amber-700 px-3 py-1 text-sm hover:bg-amber-50 disabled:opacity-60"
                        />
                      </form>
                      {canAdminFamily(context) && (
                        <form action={deleteTask}>
                          <input type="hidden" name="id" value={task.id} />
                          <ConfirmSubmitButton
                            label="Excluir"
                            confirmMessage="Deseja realmente excluir esta tarefa?"
                            className="rounded-xl border border-red-300 text-red-700 px-3 py-1 text-sm hover:bg-red-50"
                          />
                        </form>
                      )}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
