"use client";

import React, { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createDocument,
  finalizeArchivedPersonDocument,
} from "@/app/documentos/actions";
import { ExpandableCreateForm } from "@/app/components/expandable-create-form";
import { SubmitButton } from "@/app/components/submit-button";
import { getActionErrorMessage } from "@/lib/action-feedback";
import {
  MAX_PROPERTY_FILE_SIZE_BYTES,
  PROPERTY_DOCUMENT_MIME_TYPES,
  type UploadedPropertyDocument,
} from "@/lib/document-intake/property-files";
import { createClient } from "@/lib/supabase/client";

const DOCUMENTS_BUCKET = "family-documents";

type PersonOption = {
  id: string;
  first_name: string;
  last_name: string;
  family_role: string | null;
};

type DocumentUploadFormProps = {
  familyId: string;
  people: PersonOption[];
  documentTypes: string[];
  outcome: "success" | "error" | null;
};

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function safeFolderName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "documento-generico"
  );
}

function uploadId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function DocumentUploadForm({
  familyId,
  people,
  documentTypes,
  outcome,
}: DocumentUploadFormProps) {
  const router = useRouter();
  const [archiveWithoutOcr, setArchiveWithoutOcr] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!archiveWithoutOcr) return;

    event.preventDefault();
    setError(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    const title = String(formData.get("title") ?? "").trim();
    const documentType = String(
      formData.get("document_type") ?? ""
    ).trim();
    const ownerPersonId = String(
      formData.get("owner_person_id") ?? ""
    ).trim();

    if (!title || !documentType || !ownerPersonId) {
      setError(getActionErrorMessage("required_fields"));
      return;
    }
    if (!(file instanceof File) || file.size === 0) {
      setError(getActionErrorMessage("invalid_file"));
      return;
    }
    if (file.size > MAX_PROPERTY_FILE_SIZE_BYTES) {
      setError(getActionErrorMessage("file_too_large"));
      return;
    }
    if (!PROPERTY_DOCUMENT_MIME_TYPES.has(file.type)) {
      setError(getActionErrorMessage("unsupported_file_type"));
      return;
    }

    setUploading(true);
    setProgress(`Enviando ${file.name} ao armazenamento privado...`);

    const supabase = createClient();
    const storagePath = `${familyId}/${ownerPersonId}/${safeFolderName(
      documentType
    )}/${Date.now()}-${uploadId()}-${safeFileName(file.name)}`;
    const uploaded: UploadedPropertyDocument = {
      storagePath,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
    };
    let stored = false;

    try {
      const upload = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });
      if (upload.error) throw upload.error;
      stored = true;

      setProgress("Vinculando o arquivo à pessoa ou ao pet...");
      const finalData = new FormData();
      for (const field of [
        "title",
        "document_type",
        "owner_person_id",
        "document_number",
        "issuing_authority",
        "country",
        "issue_date",
        "expiration_date",
        "observacoes",
      ]) {
        finalData.set(field, String(formData.get(field) ?? ""));
      }
      finalData.set("uploaded_files", JSON.stringify([uploaded]));

      const finalized = await finalizeArchivedPersonDocument(finalData);
      if (!finalized.ok) {
        throw new Error(
          getActionErrorMessage(
            finalized.code,
            "requestId" in finalized ? finalized.requestId : undefined
          )
        );
      }
      stored = false;

      form.reset();
      setArchiveWithoutOcr(false);
      router.push("/documentos?success=archived");
      router.refresh();
    } catch (caught) {
      if (stored) {
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
      }
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : getActionErrorMessage("storage_failed")
      );
    } finally {
      setUploading(false);
      setProgress("");
    }
  }

  return (
    <ExpandableCreateForm
      id="create-document"
      title="Novo documento inteligente"
      buttonLabel="NOVO DOCUMENTO"
      submitAction={createDocument}
      encType="multipart/form-data"
      outcome={outcome}
      onSubmitCapture={handleSubmit}
      formClassName="grid grid-cols-1 gap-4 md:grid-cols-2"
    >
      <input
        name="file"
        type="file"
        required={archiveWithoutOcr}
        accept="application/pdf,image/png,image/jpeg,image/webp,image/tiff,image/tif"
        className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2"
      />
      <p className="text-xs text-slate-500 md:col-span-2">
        Envie ou fotografe primeiro para usar o OCR. Sem arquivo, informe ao
        menos o título e salve manualmente. Formatos: PDF, PNG, JPEG, WEBP,
        TIFF. Limite: 20 MB.
      </p>
      <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950 md:col-span-2">
        <input
          name="archive_without_ocr"
          type="checkbox"
          checked={archiveWithoutOcr}
          onChange={(event) => {
            setArchiveWithoutOcr(event.target.checked);
            setError(null);
          }}
          className="mt-0.5 h-4 w-4 rounded border-emerald-400"
        />
        <span>
          <strong className="block">Somente arquivar no histórico</strong>
          Marque antes de clicar em Enviar e guardar. O arquivo será enviado
          diretamente ao armazenamento privado e permanecerá vinculado à
          pessoa ou ao pet selecionado para consulta ou processamento
          posterior.
        </span>
      </label>
      <input
        name="title"
        required={archiveWithoutOcr}
        placeholder={
          archiveWithoutOcr
            ? "Título (obrigatório para arquivar)"
            : "Título (opcional antes do OCR)"
        }
        className="rounded-xl border border-slate-300 px-3 py-2"
      />
      <select
        name="document_type"
        required={archiveWithoutOcr}
        aria-label="Tipo do documento"
        className="rounded-xl border border-slate-300 px-3 py-2"
      >
        <option value="">
          {archiveWithoutOcr ? "Tipo (obrigatório)" : "Tipo"}
        </option>
        {documentTypes.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <select
        name="owner_person_id"
        required={archiveWithoutOcr}
        aria-label="Titular pessoa ou pet"
        className="rounded-xl border border-slate-300 px-3 py-2"
      >
        <option value="">
          {archiveWithoutOcr
            ? "Titular: pessoa ou pet (obrigatório)"
            : "Titular: pessoa ou pet"}
        </option>
        {people.map((person) => (
          <option key={person.id} value={person.id}>
            {person.first_name} {person.last_name}
            {person.family_role ? ` (${person.family_role})` : ""}
          </option>
        ))}
      </select>
      <input
        name="document_number"
        placeholder="Número"
        className="rounded-xl border border-slate-300 px-3 py-2"
      />
      <input
        name="issuing_authority"
        placeholder="Órgão emissor"
        className="rounded-xl border border-slate-300 px-3 py-2"
      />
      <input
        name="country"
        defaultValue="Brasil"
        placeholder="País"
        className="rounded-xl border border-slate-300 px-3 py-2"
      />
      <input
        name="issue_date"
        type="date"
        aria-label="Data de emissão"
        className="rounded-xl border border-slate-300 px-3 py-2"
      />
      <input
        name="expiration_date"
        type="date"
        aria-label="Data de validade"
        className="rounded-xl border border-slate-300 px-3 py-2"
      />
      <textarea
        name="observacoes"
        placeholder="Observações"
        className="rounded-xl border border-slate-300 px-3 py-2 md:col-span-2"
        rows={3}
      />
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2"
        >
          {error}
        </p>
      )}
      {progress && (
        <p
          role="status"
          className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 md:col-span-2"
        >
          {progress}
        </p>
      )}
      <div className="md:col-span-2">
        <SubmitButton
          label="Enviar e guardar"
          pendingLabel={
            archiveWithoutOcr
              ? "Arquivando documento..."
              : "Enviando documento..."
          }
          pendingOverride={uploading}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        />
      </div>
    </ExpandableCreateForm>
  );
}
