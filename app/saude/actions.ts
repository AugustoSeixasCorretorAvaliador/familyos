"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline/log-event";

const EXAMS_BUCKET = "family-health";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

export async function createDoctor(formData: FormData) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const doctorName = (formData.get("doctor_name") as string | null)?.trim();
  if (!doctorName) redirect("/saude?error=required_fields");

  const { error } = await supabase.from("doctors").insert({
    family_id: family.id,
    patient_person_id: (formData.get("patient_person_id") as string | null) || null,
    doctor_name: doctorName,
    specialty: (formData.get("specialty") as string | null)?.trim() || null,
    clinic: (formData.get("clinic") as string | null)?.trim() || null,
    phone: (formData.get("phone") as string | null)?.trim() || null,
    email: (formData.get("email") as string | null)?.trim() || null,
    address: (formData.get("address") as string | null)?.trim() || null,
    notes: (formData.get("notes") as string | null)?.trim() || null,
    status: "active",
  });

  if (error) redirect("/saude?error=create_failed");

  await logTimelineEvent({
    familyId: family.id,
    eventType: "doctor_created",
    affectedEntityType: "doctors",
    source: "saude.actions",
  });

  revalidatePath("/saude");
  revalidatePath("/dashboard");
  redirect("/saude?success=doctor_created");
}

export async function deleteDoctor(formData: FormData) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const id = formData.get("id") as string | null;
  if (!id) redirect("/saude?error=missing_id");

  await supabase.from("doctors").delete().eq("id", id).eq("family_id", family.id);

  revalidatePath("/saude");
  redirect("/saude?success=doctor_deleted");
}

export async function createMedication(formData: FormData) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const medicationName = (formData.get("medication_name") as string | null)?.trim();
  if (!medicationName) redirect("/saude?error=required_fields");

  const { error } = await supabase.from("medications").insert({
    family_id: family.id,
    person_id: (formData.get("person_id") as string | null) || null,
    doctor_id: (formData.get("doctor_id") as string | null) || null,
    medication_name: medicationName,
    dosage: (formData.get("dosage") as string | null)?.trim() || null,
    frequency: (formData.get("frequency") as string | null)?.trim() || null,
    schedule: (formData.get("schedule") as string | null)?.trim() || null,
    start_date: (formData.get("start_date") as string | null) || null,
    end_date: (formData.get("end_date") as string | null) || null,
    status: (formData.get("status") as string | null) || "Em uso",
    notes: (formData.get("notes") as string | null)?.trim() || null,
  });

  if (error) redirect("/saude?error=create_failed");

  await logTimelineEvent({
    familyId: family.id,
    eventType: "medication_created",
    affectedEntityType: "medications",
    source: "saude.actions",
  });

  revalidatePath("/saude");
  revalidatePath("/dashboard");
  redirect("/saude?success=med_created");
}

export async function updateMedicationStatus(formData: FormData) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const id = formData.get("id") as string | null;
  const status = formData.get("status") as string | null;
  if (!id || !status) redirect("/saude?error=missing_id");

  const payload: { status: string; end_date?: string } = { status };
  if (status === "Encerrado") {
    payload.end_date = new Date().toISOString().slice(0, 10);
  }

  await supabase.from("medications").update(payload).eq("id", id).eq("family_id", family.id);

  revalidatePath("/saude");
  revalidatePath("/dashboard");
  redirect("/saude?success=med_updated");
}

export async function deleteMedication(formData: FormData) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const id = formData.get("id") as string | null;
  if (!id) redirect("/saude?error=missing_id");

  await supabase.from("medications").delete().eq("id", id).eq("family_id", family.id);

  revalidatePath("/saude");
  redirect("/saude?success=med_deleted");
}

export async function createHealthExam(formData: FormData) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const examName = (formData.get("exam_name") as string | null)?.trim();
  if (!examName) redirect("/saude?error=required_fields");

  const { data: insertedExam, error: insertError } = await supabase
    .from("health_exams")
    .insert({
      family_id: family.id,
      person_id: (formData.get("person_id") as string | null) || null,
      exam_name: examName,
      category: (formData.get("category") as string | null)?.trim() || null,
      periodicity: (formData.get("periodicity") as string | null)?.trim() || null,
      due_date: (formData.get("due_date") as string | null) || null,
      performed_date: (formData.get("performed_date") as string | null) || null,
      next_date: (formData.get("next_date") as string | null) || null,
      status: (formData.get("status") as string | null) || "A programar",
      notes: (formData.get("notes") as string | null)?.trim() || null,
      file_path: null,
      file_name: null,
      mime_type: null,
    })
    .select("id")
    .single();

  if (insertError || !insertedExam) redirect("/saude?error=create_failed");

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const fileName = `${Date.now()}-${randomUUID()}-${sanitizeFileName(file.name)}`;
    const path = `${family.id}/${insertedExam.id}/${fileName}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage.from(EXAMS_BUCKET).upload(path, arrayBuffer, {
      contentType: file.type || "application/pdf",
      upsert: false,
    });

    if (uploadError) {
      await supabase.from("health_exams").delete().eq("id", insertedExam.id);
      redirect("/saude?error=upload_failed");
    }

    await supabase
      .from("health_exams")
      .update({ file_path: path, file_name: file.name, mime_type: file.type || "application/pdf" })
      .eq("id", insertedExam.id)
      .eq("family_id", family.id);
  }

  await logTimelineEvent({
    familyId: family.id,
    eventType: "health_exam_created",
    affectedEntityType: "health_exams",
    affectedEntityId: insertedExam.id,
    source: "saude.actions",
  });

  revalidatePath("/saude");
  revalidatePath("/dashboard");
  redirect("/saude?success=exam_created");
}

export async function updateHealthExamStatus(formData: FormData) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const id = formData.get("id") as string | null;
  const status = formData.get("status") as string | null;
  if (!id || !status) redirect("/saude?error=missing_id");

  await supabase.from("health_exams").update({ status }).eq("id", id).eq("family_id", family.id);

  if (status === "Realizado" || status === "Resultado recebido") {
    await logTimelineEvent({
      familyId: family.id,
      eventType: "health_exam_completed",
      affectedEntityType: "health_exams",
      affectedEntityId: id,
      source: "saude.actions",
    });
  }

  revalidatePath("/saude");
  revalidatePath("/dashboard");
  redirect("/saude?success=exam_updated");
}

export async function deleteHealthExam(formData: FormData) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const id = formData.get("id") as string | null;
  if (!id) redirect("/saude?error=missing_id");

  const { data: exam } = await supabase
    .from("health_exams")
    .select("file_path")
    .eq("id", id)
    .eq("family_id", family.id)
    .maybeSingle();

  if (exam?.file_path) {
    await supabase.storage.from(EXAMS_BUCKET).remove([exam.file_path]);
  }

  await supabase.from("health_exams").delete().eq("id", id).eq("family_id", family.id);

  revalidatePath("/saude");
  revalidatePath("/dashboard");
  redirect("/saude?success=exam_deleted");
}
