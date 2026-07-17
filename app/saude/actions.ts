"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  intakeDocumentFile,
  processDocumentPipeline,
} from "@/app/documentos/actions";
import type { ActionErrorCode } from "@/lib/action-feedback";
import { errorRedirectPath, reportActionError } from "@/lib/action-error";
import { canAdminFamily, getFamilyContext } from "@/lib/family/context";
import { createClient } from "@/lib/supabase/server";
import { logTimelineEvent } from "@/lib/timeline/log-event";

const EXAMS_BUCKET = "family-health";
const DOCUMENTS_BUCKET = "family-documents";
const MAX_EXAM_FILE_SIZE = 20 * 1024 * 1024;

function failHealth(
  error: unknown,
  userId: string,
  familyId: string,
  action: string,
  fallback: ActionErrorCode
): never {
  const result = reportActionError({
    error,
    userId,
    familyId,
    module: "saude",
    action,
    fallback,
  });
  redirect(errorRedirectPath("/saude", result));
}

export async function createDoctor(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
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

  if (error) failHealth(error, user.id, family.id, "create_doctor", "create_failed");

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
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canAdminFamily(context)) redirect("/saude?error=permission_denied");

  const id = formData.get("id") as string | null;
  if (!id) redirect("/saude?error=missing_id");

  const { data, error } = await supabase
    .from("doctors")
    .delete()
    .eq("id", id)
    .eq("family_id", family.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    failHealth(
      error ?? { code: "PGRST116", message: "doctor_not_found" },
      user.id,
      family.id,
      "delete_doctor",
      "delete_failed"
    );
  }

  revalidatePath("/saude");
  redirect("/saude?success=doctor_deleted");
}

export async function createMedication(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
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

  if (error) failHealth(error, user.id, family.id, "create_medication", "create_failed");

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
  const context = await getFamilyContext();
  const { user, family } = context;
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

  const { data, error } = await supabase
    .from("medications")
    .update(payload)
    .eq("id", id)
    .eq("family_id", family.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    failHealth(
      error ?? { code: "PGRST116", message: "medication_not_found" },
      user.id,
      family.id,
      "update_medication",
      "update_failed"
    );
  }

  revalidatePath("/saude");
  revalidatePath("/dashboard");
  redirect("/saude?success=med_updated");
}

export async function deleteMedication(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canAdminFamily(context)) redirect("/saude?error=permission_denied");

  const id = formData.get("id") as string | null;
  if (!id) redirect("/saude?error=missing_id");

  const { data, error } = await supabase
    .from("medications")
    .delete()
    .eq("id", id)
    .eq("family_id", family.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    failHealth(
      error ?? { code: "PGRST116", message: "medication_not_found" },
      user.id,
      family.id,
      "delete_medication",
      "delete_failed"
    );
  }

  revalidatePath("/saude");
  redirect("/saude?success=med_deleted");
}

export async function createHealthExam(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const file = formData.get("file");
  const providedExamName = (formData.get("exam_name") as string | null)?.trim();
  if (
    !providedExamName &&
    (!(file instanceof File) || file.size === 0)
  ) {
    redirect("/saude?error=required_fields");
  }
  const examName = providedExamName || "Exame em revisao";

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_EXAM_FILE_SIZE) redirect("/saude?error=file_too_large");
    if (
      ![
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp",
        "image/tiff",
        "image/tif",
      ].includes(file.type)
    ) {
      redirect("/saude?error=unsupported_file_type");
    }
  }

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

  if (insertError || !insertedExam) {
    failHealth(
      insertError ?? new Error("exam_not_returned"),
      user.id,
      family.id,
      "create_health_exam",
      "create_failed"
    );
  }

  if (file instanceof File && file.size > 0) {
    let documentId = "";
    try {
      const intake = await intakeDocumentFile({
        familyId: family.id,
        userId: user.id,
        file,
        ownerPersonId:
          (formData.get("person_id") as string | null) || null,
        documentType: "Exame",
        title: providedExamName || null,
        issueDate:
          (formData.get("performed_date") as string | null) || null,
        expirationDate:
          (formData.get("next_date") as string | null) || null,
        country: "Brasil",
        metadata: {
          health_exam_id: insertedExam.id,
          observacoes:
            (formData.get("notes") as string | null)?.trim() || null,
        },
        source: "saude.actions",
      });
      documentId = intake.documentId;
    } catch (error) {
      failHealth(
        error,
        user.id,
        family.id,
        "intake_health_exam",
        "storage_failed"
      );
    }

    const { error: updateFileError } = await supabase
      .from("health_exams")
      .update({
        file_path: `document:${documentId}`,
        file_name: file.name,
        mime_type: file.type || "application/pdf",
      })
      .eq("id", insertedExam.id)
      .eq("family_id", family.id);
    if (updateFileError) {
      failHealth(updateFileError, user.id, family.id, "link_health_exam_file", "update_failed");
    }

    await logTimelineEvent({
      familyId: family.id,
      eventType: "health_exam_created",
      affectedEntityType: "health_exams",
      affectedEntityId: insertedExam.id,
      source: "saude.actions",
    });

    const ocrResult = await processDocumentPipeline({
      familyId: family.id,
      documentId,
    });
    revalidatePath("/saude");
    revalidatePath("/documentos");
    revalidatePath("/dashboard");
    if (!ocrResult.ok) {
      redirect(
        `/documentos/${documentId}/revisar?success=uploaded&warning=ocr_failed&reason=${encodeURIComponent(
          ocrResult.error.code
        )}`
      );
    }
    redirect(
      `/documentos/${documentId}/revisar?success=${
        ocrResult.outcome === "manual" ? "uploaded_manual" : "uploaded_ocr"
      }`
    );
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

export async function attachHealthExamDocument(formData: FormData) {
  const { user, family } = await getFamilyContext();
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const examId = formData.get("id") as string | null;
  const file = formData.get("file");
  if (!examId || !(file instanceof File) || file.size === 0) {
    redirect("/saude?error=required_fields");
  }

  const { data: exam, error: examError } = await supabase
    .from("health_exams")
    .select("id, person_id, exam_name, performed_date, next_date, notes, file_path")
    .eq("id", examId)
    .eq("family_id", family.id)
    .maybeSingle();
  if (examError || !exam) {
    failHealth(
      examError ?? new Error("health_exam_not_found"),
      user.id,
      family.id,
      "attach_exam_read",
      "not_found"
    );
  }

  let documentId = "";
  try {
    const intake = await intakeDocumentFile({
      familyId: family.id,
      userId: user.id,
      file,
      documentId: exam.file_path?.startsWith("document:")
        ? exam.file_path.slice("document:".length)
        : null,
      ownerPersonId: exam.person_id,
      documentType: "Exame",
      title: exam.exam_name,
      issueDate: exam.performed_date,
      expirationDate: exam.next_date,
      country: "Brasil",
      metadata: {
        health_exam_id: exam.id,
        observacoes: exam.notes,
      },
      source: "saude.actions",
    });
    documentId = intake.documentId;
  } catch (error) {
    failHealth(
      error,
      user.id,
      family.id,
      "attach_exam_intake",
      "storage_failed"
    );
  }

  const { error: linkError } = await supabase
    .from("health_exams")
    .update({
      file_path: `document:${documentId}`,
      file_name: file.name,
      mime_type: file.type || "application/octet-stream",
    })
    .eq("id", examId)
    .eq("family_id", family.id);
  if (linkError) {
    failHealth(
      linkError,
      user.id,
      family.id,
      "attach_exam_link",
      "update_failed"
    );
  }

  const ocrResult = await processDocumentPipeline({
    familyId: family.id,
    documentId,
  });
  revalidatePath("/saude");
  revalidatePath("/documentos");
  revalidatePath("/dashboard");
  if (!ocrResult.ok) {
    redirect(
      `/documentos/${documentId}/revisar?success=uploaded&warning=ocr_failed&reason=${encodeURIComponent(
        ocrResult.error.code
      )}`
    );
  }
  redirect(
    `/documentos/${documentId}/revisar?success=${
      ocrResult.outcome === "manual" ? "uploaded_manual" : "uploaded_ocr"
    }`
  );
}

export async function updateHealthExamStatus(formData: FormData) {
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");

  const id = formData.get("id") as string | null;
  const status = formData.get("status") as string | null;
  if (!id || !status) redirect("/saude?error=missing_id");

  const { data, error } = await supabase
    .from("health_exams")
    .update({ status })
    .eq("id", id)
    .eq("family_id", family.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    failHealth(
      error ?? { code: "PGRST116", message: "health_exam_not_found" },
      user.id,
      family.id,
      "update_health_exam",
      "update_failed"
    );
  }

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
  const context = await getFamilyContext();
  const { user, family } = context;
  const supabase = createClient();

  if (!user) redirect("/login");
  if (!family) redirect("/dashboard?setup=required");
  if (!canAdminFamily(context)) redirect("/saude?error=permission_denied");

  const id = formData.get("id") as string | null;
  if (!id) redirect("/saude?error=missing_id");

  const { data: exam } = await supabase
    .from("health_exams")
    .select("file_path")
    .eq("id", id)
    .eq("family_id", family.id)
    .maybeSingle();

  if (exam?.file_path) {
    if (exam.file_path.startsWith("document:")) {
      const documentId = exam.file_path.slice("document:".length);
      const { data: document } = await supabase
        .from("documents")
        .select("storage_path")
        .eq("id", documentId)
        .eq("family_id", family.id)
        .maybeSingle();
      const { error: documentDeleteError } = await supabase
        .from("documents")
        .delete()
        .eq("id", documentId)
        .eq("family_id", family.id);
      if (documentDeleteError) {
        failHealth(
          documentDeleteError,
          user.id,
          family.id,
          "delete_health_exam_document",
          "delete_failed"
        );
      }
      if (document?.storage_path && document.storage_path !== "pending") {
        const { error: storageError } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .remove([document.storage_path]);
        if (storageError) {
          reportActionError({
            error: storageError,
            userId: user.id,
            familyId: family.id,
            module: "saude",
            action: "delete_health_exam_document_file_after_record",
            fallback: "storage_failed",
          });
        }
      }
    } else {
      const { error: storageError } = await supabase.storage
        .from(EXAMS_BUCKET)
        .remove([exam.file_path]);
      if (storageError) {
        failHealth(
          storageError,
          user.id,
          family.id,
          "delete_health_exam_file",
          "storage_failed"
        );
      }
    }
  }

  const { data, error } = await supabase
    .from("health_exams")
    .delete()
    .eq("id", id)
    .eq("family_id", family.id)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    failHealth(
      error ?? { code: "PGRST116", message: "health_exam_not_found" },
      user.id,
      family.id,
      "delete_health_exam",
      "delete_failed"
    );
  }

  revalidatePath("/saude");
  revalidatePath("/dashboard");
  redirect("/saude?success=exam_deleted");
}
