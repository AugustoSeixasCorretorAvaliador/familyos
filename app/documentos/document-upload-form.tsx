"use client";

import React, { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createDocument,
  finalizeArchivedPersonDocument,
} from "@/app/documentos/actions";
import { ExpandableCreateForm } from "@/app/components/expandable-create-form";
import { FieldLabel } from "@/app/components/field-label";
import { SubmitButton } from "@/app/components/submit-button";
import { getActionErrorMessage } from "@/lib/action-feedback";
import {
  MAX_PROPERTY_FILE_SIZE_BYTES,
  PROPERTY_DOCUMENT_MIME_TYPES,
  type UploadedPropertyDocument,
} from "@/lib/document-intake/property-files";
import { createClient } from "@/lib/supabase/client";

const DOCUMENTS_BUCKET = "family-documents";
const fieldClass = "block w-full rounded-xl border border-slate-300 px-3 py-2";

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
      <FieldLabel label="Arquivo" help="PDF ou imagem enviado ao armazenamento privado. Quando o OCR estiver ativo, o sistema tenta extrair os campos para revisão." className="md:col-span-2">
        <input name="file" type="file" required={archiveWithoutOcr} accept="application/pdf,image/png,image/jpeg,image/webp,image/tiff,image/tif" className={fieldClass} />
      </FieldLabel>
      <p className="text-xs text-slate-500 md:col-span-2">
        Envie ou fotografe primeiro para usar o OCR. Sem arquivo, informe ao
        menos o título e salve manualmente. Formatos: PDF, PNG, JPEG, WEBP,
        TIFF. Limite: 20 MB.
      </p>
      <FieldLabel label="Modo de processamento" help="Marcado: apenas arquiva o arquivo. Desmarcado: executa o fluxo inteligente de OCR e revisão." className="md:col-span-2">
        <span className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
          <input name="archive_without_ocr" type="checkbox" checked={archiveWithoutOcr} onChange={(event) => { setArchiveWithoutOcr(event.target.checked); setError(null); }} className="mt-0.5 h-4 w-4 rounded border-emerald-400" />
          <span><strong className="block">Somente arquivar no histórico</strong>O arquivo será guardado e vinculado à pessoa ou ao pet, sem leitura automática.</span>
        </span>
      </FieldLabel>
      <FieldLabel label="Título" help="Nome usado para localizar o documento nas listas, pesquisa, vínculos e timeline.">
        <input name="title" required={archiveWithoutOcr} placeholder={archiveWithoutOcr ? "Título (obrigatório)" : "Título (opcional antes do OCR)"} className={fieldClass} />
      </FieldLabel>
      <FieldLabel label="Tipo de documento" help="Classifica o arquivo e orienta organização, filtros, validações e extração inteligente.">
      <select name="document_type" aria-label="Tipo do documento" required={archiveWithoutOcr} className={fieldClass}>
        <option value="">
          {archiveWithoutOcr ? "Tipo (obrigatório)" : "Tipo"}
        </option>
        {documentTypes.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      </FieldLabel>
      <FieldLabel label="Titular: pessoa ou pet" help="Vincula o documento ao cadastro correspondente para aparecer no histórico e nos módulos relacionados.">
      <select name="owner_person_id" aria-label="Titular pessoa ou pet" required={archiveWithoutOcr} className={fieldClass}>
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
      </FieldLabel>
      <FieldLabel label="Número" help="Identificador oficial do documento usado para conferência e pesquisa."><input name="document_number" placeholder="Número do documento" className={fieldClass} /></FieldLabel>
      <FieldLabel label="Órgão emissor" help="Instituição que emitiu o documento, preservada para validação e consulta."><input name="issuing_authority" placeholder="Órgão emissor" className={fieldClass} /></FieldLabel>
      <FieldLabel label="País" help="País de emissão usado para contextualizar regras e identificação documental."><input name="country" defaultValue="Brasil" placeholder="País" className={fieldClass} /></FieldLabel>
      <FieldLabel label="Data de emissão" help="Data em que o documento passou a ser válido e referência para seu histórico."><input name="issue_date" type="date" className={fieldClass} /></FieldLabel>
      <FieldLabel label="Data de validade" help="Prazo usado para acompanhar vencimentos e alertas documentais."><input name="expiration_date" type="date" className={fieldClass} /></FieldLabel>
      <FieldLabel label="Observações" help="Informações complementares para consulta; não substituem o conteúdo do arquivo." className="md:col-span-2"><textarea name="observacoes" placeholder="Observações opcionais" className={fieldClass} rows={3} /></FieldLabel>
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
