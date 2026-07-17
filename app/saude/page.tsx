import Link from "next/link";
import { redirect } from "next/navigation";
import { ConfirmSubmitButton } from "@/app/components/confirm-submit-button";
import { MainNav } from "@/app/components/main-nav";
import { SubmitButton } from "@/app/components/submit-button";
import {
  createDoctor,
  createHealthExam,
  createMedication,
  deleteDoctor,
  deleteHealthExam,
  deleteMedication,
  updateHealthExamStatus,
  updateMedicationStatus,
} from "@/app/saude/actions";
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

type DoctorRow = {
  id: string;
  doctor_name: string;
  specialty: string | null;
  clinic: string | null;
  phone: string | null;
  email: string | null;
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
  person_id: string | null;
  people: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
};

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
      .select("id, doctor_name, specialty, clinic, phone, email, patient_person_id, people:patient_person_id(first_name, last_name)")
      .eq("family_id", family.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("medications")
      .select("id, medication_name, dosage, frequency, schedule, status, person_id, people:person_id(first_name, last_name)")
      .eq("family_id", family.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("health_exams")
      .select("id, exam_name, category, periodicity, due_date, performed_date, next_date, status, file_path, person_id, people:person_id(first_name, last_name)")
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
          <form action={createDoctor} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <select name="patient_person_id" className="rounded-xl border border-slate-300 px-3 py-2">
              <option value="">Paciente</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.first_name} {person.last_name}
                </option>
              ))}
            </select>
            <input name="doctor_name" required placeholder="Nome do medico" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="specialty" placeholder="Especialidade" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="clinic" placeholder="Clinica" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="phone" placeholder="Telefone" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="email" placeholder="E-mail" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="address" placeholder="Endereco" className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" />
            <textarea name="notes" placeholder="Observacoes" rows={2} className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" />
            <div className="md:col-span-2">
              <SubmitButton
                label="Salvar medico"
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
              />
            </div>
          </form>

          <div className="mt-4 space-y-2">
            {doctors.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-slate-600">Nenhum medico cadastrado.</p>
            ) : (
              doctors.map((doctor) => (
                <div key={doctor.id} className="rounded-xl border border-slate-200 p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{doctor.doctor_name}</p>
                    <p className="text-sm text-slate-600">
                      {doctor.specialty ?? "Sem especialidade"} | Paciente: {doctor.people ? `${doctor.people.first_name} ${doctor.people.last_name}` : "Nao informado"}
                    </p>
                  </div>
                  {canAdminFamily(context) && (
                    <form action={deleteDoctor}>
                      <input type="hidden" name="id" value={doctor.id} />
                      <ConfirmSubmitButton
                        label="Excluir"
                        confirmMessage="Deseja excluir este medico?"
                        className="rounded-xl border border-red-300 text-red-700 px-3 py-1 text-sm hover:bg-red-50"
                      />
                    </form>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Medicamentos</h2>
          <form action={createMedication} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <select name="person_id" className="rounded-xl border border-slate-300 px-3 py-2">
              <option value="">Pessoa</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.first_name} {person.last_name}
                </option>
              ))}
            </select>
            <select name="doctor_id" className="rounded-xl border border-slate-300 px-3 py-2">
              <option value="">Medico responsavel</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.doctor_name}
                </option>
              ))}
            </select>
            <input name="medication_name" required placeholder="Medicamento" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="dosage" placeholder="Dosagem" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="frequency" placeholder="Frequencia" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="schedule" placeholder="Horario" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="start_date" type="date" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="end_date" type="date" className="rounded-xl border border-slate-300 px-3 py-2" />
            <select name="status" className="rounded-xl border border-slate-300 px-3 py-2">
              <option>Em uso</option>
              <option>Suspenso</option>
              <option>Encerrado</option>
            </select>
            <textarea name="notes" placeholder="Observacoes" rows={2} className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" />
            <div className="md:col-span-2">
              <SubmitButton
                label="Salvar medicamento"
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
              />
            </div>
          </form>

          <div className="mt-4 space-y-2">
            {medications.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-4 text-slate-600">Nenhum medicamento cadastrado.</p>
            ) : (
              medications.map((medication) => (
                <div key={medication.id} className="rounded-xl border border-slate-200 p-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{medication.medication_name}</p>
                    <p className="text-sm text-slate-600">
                      {medication.status} | Pessoa: {medication.people ? `${medication.people.first_name} ${medication.people.last_name}` : "Nao informado"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={updateMedicationStatus}>
                      <input type="hidden" name="id" value={medication.id} />
                      <select name="status" defaultValue={medication.status} className="rounded-xl border border-slate-300 px-2 py-1 text-sm">
                        <option>Em uso</option>
                        <option>Suspenso</option>
                        <option>Encerrado</option>
                      </select>
                      <SubmitButton
                        label="Atualizar"
                        pendingLabel="Atualizando..."
                        className="ml-2 rounded-xl border border-slate-300 px-3 py-1 text-sm disabled:opacity-60"
                      />
                    </form>
                    {canAdminFamily(context) && (
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
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Exames</h2>
          <form action={createHealthExam} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3" encType="multipart/form-data">
            <select name="person_id" className="rounded-xl border border-slate-300 px-3 py-2">
              <option value="">Pessoa</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.first_name} {person.last_name}
                </option>
              ))}
            </select>
            <input name="exam_name" required placeholder="Nome do exame" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="category" placeholder="Categoria" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="periodicity" placeholder="Periodicidade" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="due_date" type="date" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="performed_date" type="date" className="rounded-xl border border-slate-300 px-3 py-2" />
            <input name="next_date" type="date" className="rounded-xl border border-slate-300 px-3 py-2" />
            <select name="status" className="rounded-xl border border-slate-300 px-3 py-2">
              <option>A programar</option>
              <option>Agendado</option>
              <option>Realizado</option>
              <option>Resultado recebido</option>
              <option>Atrasado</option>
            </select>
            <input name="file" type="file" accept="application/pdf" className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" />
            <textarea name="notes" placeholder="Observacoes" rows={2} className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2" />
            <div className="md:col-span-2">
              <SubmitButton
                label="Salvar exame"
                className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60"
              />
            </div>
          </form>

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
                        Baixar PDF
                      </Link>
                    )}
                    <form action={updateHealthExamStatus}>
                      <input type="hidden" name="id" value={exam.id} />
                      <select name="status" defaultValue={exam.status} className="rounded-xl border border-slate-300 px-2 py-1 text-sm">
                        <option>A programar</option>
                        <option>Agendado</option>
                        <option>Realizado</option>
                        <option>Resultado recebido</option>
                        <option>Atrasado</option>
                      </select>
                      <SubmitButton
                        label="Atualizar"
                        pendingLabel="Atualizando..."
                        className="ml-2 rounded-xl border border-slate-300 px-3 py-1 text-sm disabled:opacity-60"
                      />
                    </form>
                    {canAdminFamily(context) && (
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
