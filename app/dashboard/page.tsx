import Image from "next/image";
import Link from "next/link";
import { MainNav } from "@/app/components/main-nav";
import { bootstrapSeixasFamily } from "@/app/dashboard/actions";
import { getGoogleCalendarIntegrationStatus } from "@/lib/calendar/status";
import { getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type AlertRow = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  severity: string;
};

type TaskRow = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  priority: string | null;
};

type EventRow = {
  id: string;
  event_type: string;
  affected_entity_type: string;
  occurred_at: string;
};

type PersonPreviewRow = {
  id: string;
  first_name: string;
  last_name: string;
  family_role: string | null;
};

type DocumentStatusRow = {
  expiration_date: string | null;
};

type IntelligentDocumentRow = {
  id: string;
  title: string;
  processing_status: string;
  created_at: string;
};

type OCRJobMetricRow = {
  status: string;
};

type AccountMetricRow = {
  metadata: Record<string, unknown> | null;
};

type HealthExamMetricRow = {
  due_date: string | null;
  status: string;
};

type MedicationMetricRow = {
  status: string;
};

type LegalCaseMetricRow = {
  status: string;
  expected_value: number | null;
};

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatToday() {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function formatDueDate(date: string | null) {
  if (!date) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function computeDocumentStatus(rows: DocumentStatusRow[]) {
  const today = startOfToday();
  let valid = 0;
  let dueSoon = 0;
  let expired = 0;
  let noExpiry = 0;

  for (const row of rows) {
    if (!row.expiration_date) {
      noExpiry += 1;
      continue;
    }

    const expiration = new Date(row.expiration_date);
    const diffDays = Math.floor((expiration.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      expired += 1;
    } else if (diffDays <= 90) {
      dueSoon += 1;
    } else {
      valid += 1;
    }
  }

  return { valid, dueSoon, expired, noExpiry };
}

function getSeverityClass(severity: string) {
  if (severity === "critical") return "text-red-700 bg-red-50 border-red-200";
  if (severity === "high") return "text-orange-700 bg-orange-50 border-orange-200";
  if (severity === "medium") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-emerald-700 bg-emerald-50 border-emerald-200";
}

function eventLabel(event: EventRow) {
  return `${event.event_type} - ${event.affected_entity_type}`;
}

export default async function DashboardPage() {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) {
    redirect("/login");
  }

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split("@")[0] ||
    "usuário";

  const familyId = family?.id;

  let peopleCount = 0;
  let propertiesCount = 0;
  let documentsCount = 0;
  let openTasksCount = 0;
  let overdueTasksCount = 0;
  let waitingThirdPartyCount = 0;
  let accountsCount = 0;
  let consolidatedBalance = 0;
  let lastBalanceUpdate: string | null = null;
  let doctorsCount = 0;
  let medicationsInUse = 0;
  let examsPending = 0;
  let examsDelayed = 0;
  let activeLegalCasesCount = 0;
  let expectedLegalValue = 0;
  let calendarConnected = false;
  let calendarMessage = "Integracao Google Calendar ainda nao conectada.";
  let documentStatus = { valid: 0, dueSoon: 0, expired: 0, noExpiry: 0 };
  let documentsAwaitingReview = 0;
  let ocrPendingJobs = 0;
  let recentIntelligentDocuments: IntelligentDocumentRow[] = [];
  let peoplePreview: PersonPreviewRow[] = [];
  let upcomingTasks: TaskRow[] = [];
  let timelineEvents: EventRow[] = [];

  const calendarStatus = await getGoogleCalendarIntegrationStatus();
  calendarConnected = calendarStatus.connected;
  calendarMessage = calendarStatus.message;

  if (familyId) {
    const [
      { count: pCount },
      { count: prCount },
      { count: dCount },
      { data: docsMetricData },
      { data: recentDocsData },
      { data: ocrJobsData },
      { data: peopleData },
      { data: accountsData },
      { count: drCount },
      { data: medsData },
      { data: examsData },
      { data: tasksData },
      { data: eventsData },
      legalCasesResult,
    ] = await Promise.all([
      supabase
        .from("people")
        .select("id", { count: "exact", head: true })
        .eq("family_id", familyId)
        .is("deleted_at", null),
      supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("family_id", familyId)
        .is("deleted_at", null),
      supabase
        .from("documents")
        .select("id", { count: "exact", head: true })
        .eq("family_id", familyId)
        .eq("status", "active"),
      supabase
        .from("documents")
        .select("expiration_date")
        .eq("family_id", familyId)
        .eq("status", "active"),
      supabase
        .from("documents")
        .select("id, title, processing_status, created_at")
        .eq("family_id", familyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("document_ocr_jobs")
        .select("status")
        .eq("family_id", familyId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("people")
        .select("id, first_name, last_name, family_role")
        .eq("family_id", familyId)
        .is("deleted_at", null)
        .order("first_name", { ascending: true })
        .limit(4),
      supabase
        .from("accounts")
        .select("id, metadata")
        .eq("family_id", familyId)
        .is("deleted_at", null),
      supabase
        .from("doctors")
        .select("id", { count: "exact", head: true })
        .eq("family_id", familyId),
      supabase
        .from("medications")
        .select("id, status")
        .eq("family_id", familyId),
      supabase
        .from("health_exams")
        .select("id, due_date, status")
        .eq("family_id", familyId),
      supabase
        .from("family_tasks")
        .select("id, title, status, due_date, priority")
        .eq("family_id", familyId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(10),
      supabase
        .from("events")
        .select("id, event_type, affected_entity_type, occurred_at")
        .eq("family_id", familyId)
        .order("occurred_at", { ascending: false })
        .limit(5),
      supabase
        .from("legal_cases")
        .select("status, expected_value")
        .eq("family_id", familyId),
    ]);

    peopleCount = pCount ?? 0;
    propertiesCount = prCount ?? 0;
    documentsCount = dCount ?? 0;
    documentStatus = computeDocumentStatus((docsMetricData ?? []) as DocumentStatusRow[]);
    recentIntelligentDocuments = (recentDocsData ?? []) as IntelligentDocumentRow[];
    documentsAwaitingReview = recentIntelligentDocuments.filter(
      (document) => document.processing_status === "Aguardando conferencia"
    ).length;
    ocrPendingJobs = ((ocrJobsData ?? []) as OCRJobMetricRow[]).filter(
      (job) => job.status === "pending" || job.status === "processing"
    ).length;
    peoplePreview = (peopleData ?? []) as PersonPreviewRow[];

    const accounts = (accountsData ?? []) as AccountMetricRow[];
    accountsCount = accounts.length;
    consolidatedBalance = accounts.reduce((sum, account) => {
      const amount = account.metadata?.saldo_atual;
      return sum + (typeof amount === "number" ? amount : 0);
    }, 0);
    lastBalanceUpdate = accounts
      .map((account) => account.metadata?.data_atualizacao)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .sort()
      .at(-1) ?? null;

    doctorsCount = drCount ?? 0;
    medicationsInUse = ((medsData ?? []) as MedicationMetricRow[]).filter(
      (med) => med.status === "Em uso"
    ).length;

    const exams = (examsData ?? []) as HealthExamMetricRow[];
    examsDelayed = exams.filter((exam) => {
      if (exam.status === "Realizado" || exam.status === "Resultado recebido") {
        return false;
      }
      if (!exam.due_date) {
        return false;
      }
      return new Date(exam.due_date).getTime() < new Date().setHours(0, 0, 0, 0);
    }).length;
    examsPending = exams.filter((exam) => {
      return exam.status !== "Realizado" && exam.status !== "Resultado recebido";
    }).length;

    upcomingTasks = (tasksData ?? []) as TaskRow[];
    const today = startOfToday().getTime();
    openTasksCount = upcomingTasks.filter(
      (task) => task.status !== "completed" && task.status !== "Concluida" && task.status !== "Cancelada"
    ).length;
    overdueTasksCount = upcomingTasks.filter((task) => {
      if (!task.due_date) return false;
      if (task.status === "completed" || task.status === "Concluida" || task.status === "Cancelada") {
        return false;
      }
      return new Date(task.due_date).getTime() < today;
    }).length;
    waitingThirdPartyCount = upcomingTasks.filter(
      (task) => task.status === "Aguardando terceiro"
    ).length;

    timelineEvents = (eventsData ?? []) as EventRow[];

    if (!legalCasesResult.error) {
      const legalCases = (legalCasesResult.data ?? []) as LegalCaseMetricRow[];
      activeLegalCasesCount = legalCases.filter((legalCase) => legalCase.status === "Ativo").length;
      expectedLegalValue = legalCases.reduce(
        (sum, legalCase) => sum + (legalCase.expected_value ?? 0),
        0
      );
    }
  }

  const { data: alertsData } = await supabase
    .from("alerts")
    .select("id, title, description, due_date, severity")
    .eq("status", "pending")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(5);

  const alerts = (alertsData ?? []) as AlertRow[];

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-br from-white via-blue-50/40 to-violet-50/50 px-4 py-3 sm:px-6">
            <Image
              src="/brand/hero-familyos-horizontal.png"
              alt="HERO.FamilyOS — O Sistema Operacional da Família"
              width={1774}
              height={887}
              priority
              sizes="(max-width: 768px) 100vw, 960px"
              className="mx-auto h-auto max-h-56 w-full object-contain"
            />
          </div>
          <div className="p-6">
            <div className="mb-5">
              <MainNav current="dashboard" />
            </div>
            <p className="text-sm capitalize text-slate-500">{formatToday()}</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900 md:text-3xl">
              Bom dia, {fullName}.
            </h1>
            <p className="mt-1 text-slate-600">{family?.name ?? "Sem familia vinculada"}</p>
          </div>
        </header>

        {!familyId && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-amber-900">Inicializacao do SeixasOS MVP 0.1</h2>
            <p className="mt-2 text-amber-800">
              Nenhuma familia vinculada ainda. Clique abaixo para criar a Familia Seixas e vincular seu usuario.
            </p>
            <form action={bootstrapSeixasFamily} className="mt-4">
              <button
                type="submit"
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800"
              >
                Criar e vincular Familia Seixas
              </button>
            </form>
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-[#061638] via-[#083f86] to-[#6b2fcf] p-6 text-white shadow-sm sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">
                Inteligência familiar segura
              </p>
              <h2 className="mt-2 text-2xl font-semibold">AI Executive</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-blue-50">
                Consulte riscos, pendências e próximos passos com base apenas nos dados autorizados da sua família.
              </p>
              <Link
                href="/ai-executive"
                className="mt-5 inline-flex rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-[#075fc7] shadow-sm transition hover:bg-blue-50"
              >
                Abrir AI Executive
              </Link>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-sm font-medium text-white">Experimente perguntar:</p>
              <ul className="mt-3 space-y-2 text-sm text-blue-50">
                <li>Como está minha família hoje?</li>
                <li>Quais pendências são urgentes?</li>
                <li>Quais documentos vencem em breve?</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <article className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Visao Geral</h2>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                <p className="text-xs text-slate-500">Pessoas</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{peopleCount}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                <p className="text-xs text-slate-500">Imoveis</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{propertiesCount}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                <p className="text-xs text-slate-500">Documentos</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{documentsCount}</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                <p className="text-xs text-slate-500">Tarefas abertas</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">{openTasksCount}</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-medium text-slate-900">Alertas e Pendencias</h3>
                {alerts.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">Sem alertas abertos no momento.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {alerts.map((alert) => (
                      <li
                        key={alert.id}
                        className={`rounded-lg border px-3 py-2 text-sm ${getSeverityClass(alert.severity)}`}
                      >
                        <p className="font-medium">{alert.title}</p>
                        <p className="text-xs mt-1">{formatDueDate(alert.due_date)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h3 className="font-medium text-slate-900">Proximos Compromissos</h3>
                {upcomingTasks.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-600">Sem tarefas programadas.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {upcomingTasks.slice(0, 5).map((task) => (
                      <li key={task.id} className="rounded-lg bg-slate-50 px-3 py-2 border border-slate-200">
                        <p className="text-sm font-medium text-slate-900">{task.title}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Prazo: {formatDueDate(task.due_date)} | Status: {task.status}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Resumo Financeiro</h2>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <p className="text-sm text-emerald-700">Saldo consolidado</p>
              <p className="text-2xl font-semibold text-emerald-800 mt-1">
                {formatCurrency(consolidatedBalance)}
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                Atualizado em {lastBalanceUpdate ? formatDueDate(lastBalanceUpdate) : "-"}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-sm text-slate-600">Contas cadastradas</p>
              <p className="text-xl font-semibold text-slate-900">{accountsCount}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
              <p className="text-sm text-slate-600">Aguardando terceiros</p>
              <p className="text-xl font-semibold text-slate-900">{waitingThirdPartyCount}</p>
            </div>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Modulos</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/pessoas" className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              Pessoas
            </Link>
            <Link href="/imoveis" className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              Imoveis
            </Link>
            <Link href="/documentos" className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              Documentos
            </Link>
            <Link href="/financas" className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              Financas
            </Link>
            <Link href="/saude" className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              Saude
            </Link>
            <Link href="/agenda" className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              Agenda
            </Link>
            <Link href="/tarefas" className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              Tarefas
            </Link>
            <Link href="/processos" className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              Processos
            </Link>
            <Link href="/timeline" className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              Timeline
            </Link>
            <Link href="/relacionamentos" className="rounded-xl border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
              Relacionamentos
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Agenda</h2>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">Integracao Google Calendar</p>
            <p className="mt-1 font-medium text-amber-900">{calendarConnected ? "Conectado" : "Nao conectado"}</p>
            <p className="mt-1 text-sm text-amber-800">{calendarMessage}</p>
            <Link href="/agenda" className="mt-3 inline-flex text-sm font-medium text-amber-900 underline">
              Abrir modulo Agenda
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Documentos</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <span className="text-slate-600">Validos</span>
                <strong className="text-emerald-700">{documentStatus.valid}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <span className="text-slate-600">Vencem em breve</span>
                <strong className="text-amber-700">{documentStatus.dueSoon}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <span className="text-slate-600">Vencidos</span>
                <strong className="text-red-700">{documentStatus.expired}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <span className="text-slate-600">Sem validade</span>
                <strong className="text-slate-900">{documentStatus.noExpiry}</strong>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Financas</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <span className="text-slate-600">Contas</span>
                <strong className="text-slate-900">{accountsCount}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <span className="text-slate-600">Saldo consolidado</span>
                <strong className="text-slate-900">
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(consolidatedBalance)}
                </strong>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Saude</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <span className="text-slate-600">Medicos cadastrados</span>
                <strong className="text-slate-900">{doctorsCount}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <span className="text-slate-600">Medicamentos em uso</span>
                <strong className="text-slate-900">{medicationsInUse}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <span className="text-slate-600">Exames pendentes</span>
                <strong className="text-slate-900">{examsPending}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <span className="text-slate-600">Exames atrasados</span>
                <strong className="text-slate-900">{examsDelayed}</strong>
              </div>
            </div>
          </article>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Tarefas e Processos</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <span className="text-slate-600">Tarefas atrasadas</span>
                <strong className="text-red-700">{overdueTasksCount}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <span className="text-slate-600">Processos ativos</span>
                <strong className="text-slate-900">{activeLegalCasesCount}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <span className="text-slate-600">Valor esperado total</span>
                <strong className="text-slate-900">{formatCurrency(expectedLegalValue)}</strong>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>
            {timelineEvents.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-600">Sem eventos recentes.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {timelineEvents.map((event) => (
                  <li key={event.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                    <p className="text-sm font-medium text-slate-900">{eventLabel(event)}</p>
                    <p className="text-xs text-slate-500 mt-1">{formatDateTime(event.occurred_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">OCR e Conferencia</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <span className="text-slate-600">Documentos aguardando conferencia</span>
                <strong className="text-amber-700">{documentsAwaitingReview}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <span className="text-slate-600">OCR pendentes</span>
                <strong className="text-slate-900">{ocrPendingJobs}</strong>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 flex items-center justify-between">
                <span className="text-slate-600">Documentos vencidos</span>
                <strong className="text-red-700">{documentStatus.expired}</strong>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Ultimos documentos enviados</h2>
            {recentIntelligentDocuments.length === 0 ? (
              <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-600">Nenhum documento enviado recentemente.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {recentIntelligentDocuments.map((document) => (
                  <li key={document.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-medium text-slate-900">{document.title}</p>
                    <p className="text-xs text-slate-500 mt-1">Status: {document.processing_status}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Fluxo Sistemico</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <p className="text-sm font-medium text-slate-900">Entrada</p>
              <p className="text-xs text-slate-600 mt-2">Login Google, cadastro e upload de documentos/exames.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <p className="text-sm font-medium text-slate-900">Processamento</p>
              <p className="text-xs text-slate-600 mt-2">Dados no Supabase com RLS, validacoes de prazo e acompanhamento operacional.</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
              <p className="text-sm font-medium text-slate-900">Saida</p>
              <p className="text-xs text-slate-600 mt-2">Alertas, dashboard executivo, timeline de eventos e modulos de gestao familiar.</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Pessoas da Familia</h2>
          {peoplePreview.length === 0 ? (
            <p className="mt-4 rounded-xl bg-slate-50 p-4 text-slate-600">Nenhuma pessoa cadastrada.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {peoplePreview.map((person) => (
                <div key={person.id} className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                  <p className="font-medium text-slate-900">
                    {person.first_name} {person.last_name}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{person.family_role ?? "Sem papel"}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
