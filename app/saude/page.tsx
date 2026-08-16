import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { ExpandableCreateForm } from "@/app/components/expandable-create-form";
import { FieldLabel } from "@/app/components/field-label";
import { MainNav } from "@/app/components/main-nav";
import { SubmitButton } from "@/app/components/submit-button";
import {
  attachHealthExamDocument,
  createDoctor,
  createHealthExam,
  createMedication,
  deleteDoctor,
  deleteHealthExam,
  deleteMedication,
  updateDoctor,
  updateHealthExam,
  updateMedication,
} from "@/app/saude/actions";
import { getActionErrorMessage } from "@/lib/action-feedback";
import { canAdminFamily, canEditFamily, getFamilyContext } from "@/lib/family/context";
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

type DoctorRow = {
  id: string;
  doctor_name: string;
  specialty: string | null;
  clinic: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  patient_person_id: string | null;
  people: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
};

type MedicationRow = {
  id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  schedule: string | null;
  status: string;
  doctor_id: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  person_id: string | null;
  people: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
};

const MEDICATION_STATUSES = ["Em uso", "Suspenso", "Encerrado"];
const EXAM_STATUSES = ["A programar", "Agendado", "Realizado", "Resultado recebido", "Atrasado"];
const fieldClass = "block w-full rounded-xl border border-slate-300 px-3 py-2";

function DoctorFields({ doctor, people }: { doctor?: DoctorRow; people: PersonOption[] }) {
  return <>
    <FieldLabel label="Paciente" help="Pessoa da família acompanhada por este médico; permite organizar os profissionais por paciente."><select name="patient_person_id" defaultValue={doctor?.patient_person_id ?? ""} className={fieldClass}><option value="">Não informado</option>{people.map((person) => <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>)}</select></FieldLabel>
    <FieldLabel label="Nome do médico" help="Identificação principal usada nas listas e nos vínculos com medicamentos."><input name="doctor_name" required defaultValue={doctor?.doctor_name ?? ""} placeholder="Nome completo" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Especialidade" help="Área médica usada para reconhecer o tipo de atendimento prestado."><input name="specialty" defaultValue={doctor?.specialty ?? ""} placeholder="Ex.: Cardiologia" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Clínica" help="Local ou instituição onde o profissional atende."><input name="clinic" defaultValue={doctor?.clinic ?? ""} placeholder="Nome da clínica" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Telefone" help="Contato para agendamentos e consultas; não é usado para login."><input name="phone" type="tel" defaultValue={doctor?.phone ?? ""} placeholder="Telefone" className={fieldClass} /></FieldLabel>
    <FieldLabel label="E-mail" help="Contato eletrônico do médico ou clínica para comunicação e envio de documentos."><input name="email" type="email" defaultValue={doctor?.email ?? ""} placeholder="E-mail" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Endereço" help="Local de atendimento para referência em consultas e deslocamentos." className="md:col-span-2"><input name="address" defaultValue={doctor?.address ?? ""} placeholder="Endereço da clínica ou consultório" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Observações" help="Informações complementares sobre atendimento, convênio ou preferências; não alteram cálculos." className="md:col-span-2"><textarea name="notes" defaultValue={doctor?.notes ?? ""} placeholder="Observações opcionais" rows={2} className={fieldClass} /></FieldLabel>
  </>;
}

function MedicationFields({ medication, people, doctors }: { medication?: MedicationRow; people: PersonOption[]; doctors: DoctorRow[] }) {
  return <>
    <FieldLabel label="Pessoa" help="Pessoa da família que utiliza o medicamento e recebe o vínculo no histórico de saúde."><select name="person_id" defaultValue={medication?.person_id ?? ""} className={fieldClass}><option value="">Não informada</option>{people.map((person) => <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>)}</select></FieldLabel>
    <FieldLabel label="Médico responsável" help="Profissional que prescreveu ou acompanha o uso do medicamento."><select name="doctor_id" defaultValue={medication?.doctor_id ?? ""} className={fieldClass}><option value="">Não informado</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.doctor_name}</option>)}</select></FieldLabel>
    <FieldLabel label="Medicamento" help="Nome principal exibido na lista de tratamentos e no histórico de saúde."><input name="medication_name" required defaultValue={medication?.medication_name ?? ""} placeholder="Nome do medicamento" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Dosagem" help="Quantidade por administração, como 500 mg ou 10 ml; serve como orientação registrada."><input name="dosage" defaultValue={medication?.dosage ?? ""} placeholder="Ex.: 500 mg" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Frequência" help="Periodicidade de uso, como uma vez ao dia ou a cada oito horas."><input name="frequency" defaultValue={medication?.frequency ?? ""} placeholder="Ex.: 2 vezes ao dia" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Horário" help="Horários planejados de administração para consulta da rotina do tratamento."><input name="schedule" defaultValue={medication?.schedule ?? ""} placeholder="Ex.: 08:00 e 20:00" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Data de início" help="Início do período de uso do medicamento no histórico de saúde."><input name="start_date" type="date" defaultValue={medication?.start_date ?? ""} className={fieldClass} /></FieldLabel>
    <FieldLabel label="Data de término" help="Fim previsto ou efetivo do tratamento; pode permanecer vazio enquanto estiver em uso."><input name="end_date" type="date" defaultValue={medication?.end_date ?? ""} className={fieldClass} /></FieldLabel>
    <FieldLabel label="Status" help="Indica se o medicamento está em uso, suspenso ou encerrado e alimenta o resumo de tratamentos ativos."><select name="status" defaultValue={medication?.status ?? "Em uso"} className={fieldClass}>{MEDICATION_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></FieldLabel>
    <FieldLabel label="Observações" help="Registra instruções, reações ou informações adicionais sem substituir orientação médica." className="md:col-span-2"><textarea name="notes" defaultValue={medication?.notes ?? ""} placeholder="Observações opcionais" rows={2} className={fieldClass} /></FieldLabel>
  </>;
}

function ExamFields({ exam, people, includeFile = false }: { exam?: ExamRow; people: PersonOption[]; includeFile?: boolean }) {
  return <>
    {includeFile && <FieldLabel label="Arquivo do exame" help="PDF ou imagem enviado ao fluxo de documento inteligente; o OCR tenta extrair dados para revisão." className="md:col-span-2"><input name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp,image/tiff,image/tif" className={fieldClass} /></FieldLabel>}
    <FieldLabel label="Pessoa" help="Pessoa da família a quem o exame pertence e que receberá o vínculo no histórico de saúde."><select name="person_id" defaultValue={exam?.person_id ?? ""} className={fieldClass}><option value="">Não informada</option>{people.map((person) => <option key={person.id} value={person.id}>{person.first_name} {person.last_name}</option>)}</select></FieldLabel>
    <FieldLabel label="Nome do exame" help="Identificação principal usada na lista, documentos e alertas; pode ser sugerida pelo OCR no envio inicial."><input name="exam_name" required={!includeFile} defaultValue={exam?.exam_name ?? ""} placeholder={includeFile ? "Opcional quando houver arquivo" : "Nome do exame"} className={fieldClass} /></FieldLabel>
    <FieldLabel label="Categoria" help="Agrupa exames por finalidade ou especialidade para facilitar organização e consulta."><input name="category" defaultValue={exam?.category ?? ""} placeholder="Ex.: Laboratorial, imagem" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Periodicidade" help="Intervalo recomendado de repetição, usado como referência junto à próxima data."><input name="periodicity" defaultValue={exam?.periodicity ?? ""} placeholder="Ex.: Anual" className={fieldClass} /></FieldLabel>
    <FieldLabel label="Data prevista" help="Prazo planejado usado para identificar exames pendentes ou atrasados."><input name="due_date" type="date" defaultValue={exam?.due_date ?? ""} className={fieldClass} /></FieldLabel>
    <FieldLabel label="Data de realização" help="Dia em que o exame foi realizado e referência temporal do histórico médico."><input name="performed_date" type="date" defaultValue={exam?.performed_date ?? ""} className={fieldClass} /></FieldLabel>
    <FieldLabel label="Próxima data" help="Data sugerida para repetição ou novo acompanhamento do exame."><input name="next_date" type="date" defaultValue={exam?.next_date ?? ""} className={fieldClass} /></FieldLabel>
    <FieldLabel label="Status" help="Determina se o exame está a programar, agendado, realizado, com resultado recebido ou atrasado."><select name="status" defaultValue={exam?.status ?? "A programar"} className={fieldClass}>{EXAM_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></FieldLabel>
    <FieldLabel label="Observações" help="Informações complementares para acompanhamento; não substituem o laudo anexado." className="md:col-span-2"><textarea name="notes" defaultValue={exam?.notes ?? ""} placeholder="Observações opcionais" rows={2} className={fieldClass} /></FieldLabel>
  </>;
}

type ExamRow = {
  id: string;
  exam_name: string;
  category: string | null;
  periodicity: string | null;
  due_date: string | null;
  performed_date: string | null;
  next_date: string | null;
  status: string;
  file_path: string | null;
  person_id: string | null;
  notes: string | null;
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

function getExamStatus(exam: ExamRow) {
  if (exam.status === "Realizado" || exam.status === "Resultado recebido") {
    return exam.status;
  }
  if (exam.due_date && new Date(exam.due_date).getTime() < new Date().setHours(0, 0, 0, 0)) {
    return "Atrasado";
  }
  return exam.status;
}

export default async function SaudePage({ searchParams }: PageProps) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const [peopleRes, doctorsRes, medsRes, examsRes] = await Promise.all([
    supabase
      .from("people")
      .select("id, first_name, last_name")
      .eq("family_id", family.id)
      .is("deleted_at", null)
      .order("first_name", { ascending: true }),
    supabase
      .from("doctors")
      .select("id, doctor_name, specialty, clinic, phone, email, address, notes, patient_person_id, people:patient_person_id(first_name, last_name)")
      .eq("family_id", family.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("medications")
      .select("id, medication_name, dosage, frequency, schedule, status, doctor_id, start_date, end_date, notes, person_id, people:person_id(first_name, last_name)")
      .eq("family_id", family.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("health_exams")
      .select("id, exam_name, category, periodicity, due_date, performed_date, next_date, status, file_path, notes, person_id, people:person_id(first_name, last_name)")
      .eq("family_id", family.id)
      .order("created_at", { ascending: false }),
  ]);

  const people = (peopleRes.data ?? []) as PersonOption[];
  const doctors = ((doctorsRes.data ?? []) as DoctorRow[]).map((row) => ({
    ...row,
    people: Array.isArray(row.people) ? row.people[0] ?? null : row.people,
  }));
  const medications = ((medsRes.data ?? []) as MedicationRow[]).map((row) => ({
    ...row,
    people: Array.isArray(row.people) ? row.people[0] ?? null : row.people,
  }));
  const exams = ((examsRes.data ?? []) as ExamRow[]).map((row) => ({
    ...row,
    people: Array.isArray(row.people) ? row.people[0] ?? null : row.people,
  }));
  const canEdit = canEditFamily(context);
  const canAdmin = canAdminFamily(context);

  const examsAtrasados = exams.filter((exam) => getExamStatus(exam) === "Atrasado").length;
  const examsPendentes = exams.filter((exam) => {
    const status = getExamStatus(exam);
    return status !== "Realizado" && status !== "Resultado recebido";
  }).length;

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <MainNav current="saude" />
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Saude</h1>
            <p className="mt-1 text-slate-600">{family.name}</p>
            <p className="mt-2 text-sm text-slate-500">
              Medicos: {doctors.length} | Medicamentos em uso: {medications.filter((m) => m.status === "Em uso").length} | Exames pendentes: {examsPendentes} | Exames atrasados: {examsAtrasados}
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
          <h2 className="text-lg font-semibold text-slate-900">Medicos</h2>
          <div className="mt-4">
            {canEdit && <ExpandableCreateForm
              id="create-doctor"
              title="Cadastrar médico"
              buttonLabel="NOVO MÉDICO"
              submitAction={createDoctor}
              outcome={
                searchParams.error
                  ? "error"
                  : searchParams.success === "doctor_created"
                    ? "success"
                    : null
              }
              formClassName="grid grid-cols-1 gap-3 md:grid-cols-2"
            >
            <DoctorFields people={people} />
            <div className="md:col-span-2">
              <SubmitButton
                label="Salvar medico"
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
              />
            </div>
            </ExpandableCreateForm>}
          </div>

          <div className="mt-4 space-y-2">
            {doctors.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-slate-600">Nenhum medico cadastrado.</p>
            ) : (
              doctors.map((doctor) => (
                <details key={doctor.id} className="rounded-xl border border-slate-200 p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div>
                    <p className="font-medium text-slate-900">{doctor.doctor_name}</p>
                    <p className="text-sm text-slate-600">
                      {doctor.specialty ?? "Sem especialidade"} | Paciente: {doctor.people ? `${doctor.people.first_name} ${doctor.people.last_name}` : "Nao informado"}
                    </p>
                    </div>
                    <span className="text-sm font-medium text-sky-700">Editar</span>
                  </summary>
                  {canEdit && <form action={updateDoctor} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input type="hidden" name="id" value={doctor.id} />
                    <DoctorFields doctor={doctor} people={people} />
                    <div className="md:col-span-2"><SubmitButton label="Salvar alterações" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white" /></div>
                  </form>}
                  {canAdmin && (
                    <form action={deleteDoctor}>
                      <input type="hidden" name="id" value={doctor.id} />
                      <ConfirmSubmitButton
                        label="Excluir"
                        confirmMessage="Deseja excluir este medico?"
                        className="rounded-xl border border-red-300 text-red-700 px-3 py-1 text-sm hover:bg-red-50"
                      />
                    </form>
                  )}
                </details>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Medicamentos</h2>
          <div className="mt-4">
            {canEdit && <ExpandableCreateForm
              id="create-medication"
              title="Cadastrar medicamento"
              buttonLabel="NOVO MEDICAMENTO"
              submitAction={createMedication}
              outcome={
                searchParams.error
                  ? "error"
                  : searchParams.success === "med_created"
                    ? "success"
                    : null
              }
              formClassName="grid grid-cols-1 gap-3 md:grid-cols-2"
            >
            <MedicationFields people={people} doctors={doctors} />
            <div className="md:col-span-2">
              <SubmitButton
                label="Salvar medicamento"
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
              />
            </div>
            </ExpandableCreateForm>}
          </div>

          <div className="mt-4 space-y-2">
            {medications.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-slate-600">Nenhum medicamento cadastrado.</p>
            ) : (
              medications.map((medication) => (
                <details key={medication.id} className="rounded-xl border border-slate-200 p-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div>
                    <p className="font-medium text-slate-900">{medication.medication_name}</p>
                    <p className="text-sm text-slate-600">
                      {medication.status} | Pessoa: {medication.people ? `${medication.people.first_name} ${medication.people.last_name}` : "Nao informado"}
                    </p>
                    </div>
                    <span className="text-sm font-medium text-sky-700">Editar</span>
                  </summary>
                  {canEdit && <form action={updateMedication} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input type="hidden" name="id" value={medication.id} />
                    <MedicationFields medication={medication} people={people} doctors={doctors} />
                    <div className="md:col-span-2"><SubmitButton label="Salvar alterações" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white" /></div>
                  </form>}
                  <div className="mt-3 flex gap-2">
                    {canAdmin && (
                      <form action={deleteMedication}>
                        <input type="hidden" name="id" value={medication.id} />
                        <ConfirmSubmitButton
                          label="Excluir"
                          confirmMessage="Deseja excluir este medicamento?"
                          className="rounded-xl border border-red-300 text-red-700 px-3 py-1 text-sm hover:bg-red-50"
                        />
                      </form>
                    )}
                  </div>
                </details>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Exames</h2>
          <div className="mt-4">
            {canEdit && <ExpandableCreateForm
              id="create-health-exam"
              title="Cadastrar exame"
              buttonLabel="NOVO EXAME"
              submitAction={createHealthExam}
              encType="multipart/form-data"
              outcome={
                searchParams.error
                  ? "error"
                  : searchParams.success === "exam_created"
                    ? "success"
                    : null
              }
              formClassName="grid grid-cols-1 gap-3 md:grid-cols-2"
            >
            <ExamFields people={people} includeFile />
            <p className="text-xs text-slate-500 md:col-span-2">
              Envie o PDF ou fotografe o exame primeiro. O OCR preenchera os dados possiveis para revisao; sem arquivo, informe ao menos o nome.
            </p>
            <div className="md:col-span-2">
              <SubmitButton
                label="Salvar exame"
                pendingLabel="Enviando e lendo documento..."
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
              />
            </div>
            </ExpandableCreateForm>}
          </div>

          <div className="mt-4 space-y-2">
            {exams.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-slate-600">Nenhum exame cadastrado.</p>
            ) : (
              exams.map((exam) => (
                <div key={exam.id} className="rounded-xl border border-slate-200 p-3 flex flex-col gap-2">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{exam.exam_name}</p>
                      <p className="text-sm text-slate-600">
                        {getExamStatus(exam)} | Pessoa: {exam.people ? `${exam.people.first_name} ${exam.people.last_name}` : "Nao informado"}
                      </p>
                    </div>
                    <div className="text-sm text-slate-600">Previsto: {formatDate(exam.due_date)}</div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {exam.file_path && (
                      <Link href={`/saude/exames/${exam.id}/download`} className="text-sm underline text-slate-700 hover:text-slate-900">
                        Baixar arquivo
                      </Link>
                    )}
                    {canEdit && <details className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <summary className="cursor-pointer font-medium text-sky-700">Editar dados do exame</summary>
                      <form action={updateHealthExam} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <input type="hidden" name="id" value={exam.id} />
                        <ExamFields exam={exam} people={people} />
                        <div className="md:col-span-2"><SubmitButton label="Salvar alterações" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white" /></div>
                      </form>
                    </details>}
                    {canEdit && <form
                      action={attachHealthExamDocument}
                      encType="multipart/form-data"
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="id" value={exam.id} />
                      <FieldLabel label="Arquivo do exame" help="Anexa ou substitui o documento inteligente e executa novamente a leitura OCR."><input name="file" type="file" required accept="application/pdf,image/png,image/jpeg,image/webp,image/tiff,image/tif" className="block max-w-xs rounded-xl border border-slate-300 px-2 py-1 text-sm" /></FieldLabel>
                      <SubmitButton
                        label={exam.file_path ? "Substituir e ler" : "Anexar e ler"}
                        pendingLabel="Lendo..."
                        className="rounded-xl border border-slate-300 px-3 py-1 text-sm disabled:opacity-60"
                      />
                    </form>}
                    {canAdmin && (
                      <form action={deleteHealthExam}>
                        <input type="hidden" name="id" value={exam.id} />
                        <ConfirmSubmitButton
                          label="Excluir"
                          confirmMessage="Deseja excluir este exame?"
                          className="rounded-xl border border-red-300 text-red-700 px-3 py-1 text-sm hover:bg-red-50"
                        />
                      </form>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
