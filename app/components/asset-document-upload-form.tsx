"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createAssetDocument,
  finalizeArchivedAssetDocuments,
} from "@/app/patrimonio-documentos/actions";
import { SubmitButton } from "@/app/components/submit-button";
import { getActionErrorMessage } from "@/lib/action-feedback";
import {
  MAX_PROPERTY_ARCHIVE_FILES,
  MAX_PROPERTY_FILE_SIZE_BYTES,
  PROPERTY_DOCUMENT_MIME_TYPES,
  type UploadedPropertyDocument,
} from "@/lib/document-intake/property-files";
import { createClient } from "@/lib/supabase/client";

const DOCUMENTS_BUCKET = "family-documents";

type AssetDocumentUploadFormProps = {
  familyId: string;
  entityId: string;
  entityType: "vehicle" | "insurance_policy";
  documentTypes: string[];
};

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function uploadId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function AssetDocumentUploadForm({
  familyId,
  entityId,
  entityType,
  documentTypes,
}: AssetDocumentUploadFormProps) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const route = entityType === "vehicle" ? "/automoveis" : "/seguros";
  const folder = entityType === "vehicle" ? "documento-automovel" : "apolice-seguro";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const initialData = new FormData(form);
    if (initialData.get("archive_without_ocr") !== "on") return;

    event.preventDefault();
    setError(null);
    const files = initialData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (files.length === 0) return setError(getActionErrorMessage("invalid_file"));
    if (files.length > MAX_PROPERTY_ARCHIVE_FILES) {
      return setError(getActionErrorMessage("too_many_files"));
    }
    if (files.some((file) => file.size > MAX_PROPERTY_FILE_SIZE_BYTES)) {
      return setError(getActionErrorMessage("file_too_large"));
    }
    if (files.some((file) => !PROPERTY_DOCUMENT_MIME_TYPES.has(file.type))) {
      return setError(getActionErrorMessage("unsupported_file_type"));
    }

    setUploading(true);
    const supabase = createClient();
    const uploaded: UploadedPropertyDocument[] = [];
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setProgress(`Enviando ${index + 1} de ${files.length}: ${file.name}`);
        const storagePath = `${familyId}/sem-titular/${folder}/${Date.now()}-${uploadId()}-${safeFileName(file.name)}`;
        const result = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .upload(storagePath, file, { contentType: file.type, upsert: false });
        if (result.error) throw result.error;
        uploaded.push({
          storagePath,
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
        });
      }

      setProgress("Registrando arquivos no histórico...");
      const finalData = new FormData();
      finalData.set("entity_type", entityType);
      finalData.set("entity_id", entityId);
      for (const field of [
        "document_type",
        "title",
        "issue_date",
        "expiration_date",
        "observacoes",
      ]) {
        finalData.set(field, String(initialData.get(field) ?? ""));
      }
      finalData.set("uploaded_files", JSON.stringify(uploaded));
      const finalized = await finalizeArchivedAssetDocuments(finalData);
      if (!finalized.ok) {
        throw new Error(
          getActionErrorMessage(
            finalized.code,
            "requestId" in finalized ? finalized.requestId : undefined
          )
        );
      }
      form.reset();
      router.push(`${route}?success=documents_archived&count=${finalized.count}`);
      router.refresh();
    } catch (caught) {
      if (uploaded.length > 0) {
        await supabase.storage.from(DOCUMENTS_BUCKET).remove(uploaded.map((file) => file.storagePath));
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
    <form action={createAssetDocument} onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
      <input type="hidden" name="entity_type" value={entityType} />
      <input type="hidden" name="entity_id" value={entityId} />
      <input
        name="files"
        type="file"
        multiple
        required
        accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,application/pdf,image/png,image/jpeg,image/webp,image/tiff"
        className="rounded-xl border border-slate-300 bg-white px-3 py-2 md:col-span-2"
      />
      <p className="text-xs text-slate-500 md:col-span-2">
        Um arquivo pode seguir para OCR. Para arquivar até 10 arquivos sem leitura automática, marque o X abaixo. Limite de 20 MB por arquivo.
      </p>
      <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900 md:col-span-2">
        <input name="archive_without_ocr" type="checkbox" className="mt-0.5 h-4 w-4 rounded border-emerald-400" />
        <span>
          <strong className="block">Somente arquivar no histórico</strong>
          Marque o X para guardar o PDF privado usando apenas o título e os atributos básicos informados.
        </span>
      </label>
      <select name="document_type" className="rounded-xl border border-slate-300 bg-white px-3 py-2">
        <option value="">Tipo do documento</option>
        {documentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
      </select>
      <input name="title" placeholder="Título do documento" className="rounded-xl border border-slate-300 bg-white px-3 py-2" />
      <label className="text-sm text-slate-600">Emissão<input name="issue_date" type="date" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" /></label>
      <label className="text-sm text-slate-600">Validade<input name="expiration_date" type="date" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" /></label>
      <textarea name="observacoes" rows={2} placeholder="Observações" className="rounded-xl border border-slate-300 bg-white px-3 py-2 md:col-span-2" />
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 md:col-span-2">{error}</p>}
      {progress && <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 md:col-span-2">{progress}</p>}
      <div className="md:col-span-2">
        <SubmitButton label="Enviar e guardar" pendingLabel="Enviando arquivos..." pendingOverride={uploading} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60" />
      </div>
    </form>
  );
}
