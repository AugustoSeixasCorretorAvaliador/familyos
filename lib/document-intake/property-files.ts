export const MAX_PROPERTY_ARCHIVE_FILES = 10;
export const MAX_PROPERTY_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const PROPERTY_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/tiff",
  "image/tif",
]);

export type UploadedPropertyDocument = {
  storagePath: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export type UploadedPropertyDocumentsResult =
  | { ok: true; files: UploadedPropertyDocument[] }
  | {
      ok: false;
      code:
        | "invalid_file"
        | "file_too_large"
        | "unsupported_file_type"
        | "too_many_files";
    };

export function validateUploadedPropertyDocuments(
  value: unknown,
  familyId: string
): UploadedPropertyDocumentsResult {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, code: "invalid_file" };
  }
  if (value.length > MAX_PROPERTY_ARCHIVE_FILES) {
    return { ok: false, code: "too_many_files" };
  }

  const files: UploadedPropertyDocument[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return { ok: false, code: "invalid_file" };
    }
    const candidate = entry as Record<string, unknown>;
    const storagePath =
      typeof candidate.storagePath === "string" ? candidate.storagePath : "";
    const fileName =
      typeof candidate.fileName === "string" ? candidate.fileName.trim() : "";
    const mimeType =
      typeof candidate.mimeType === "string" ? candidate.mimeType : "";
    const size =
      typeof candidate.size === "number" && Number.isFinite(candidate.size)
        ? candidate.size
        : 0;

    if (
      !storagePath.startsWith(`${familyId}/`) ||
      storagePath.includes("..") ||
      !fileName ||
      fileName.length > 255 ||
      size <= 0
    ) {
      return { ok: false, code: "invalid_file" };
    }
    if (size > MAX_PROPERTY_FILE_SIZE_BYTES) {
      return { ok: false, code: "file_too_large" };
    }
    if (!PROPERTY_DOCUMENT_MIME_TYPES.has(mimeType)) {
      return { ok: false, code: "unsupported_file_type" };
    }
    files.push({ storagePath, fileName, mimeType, size });
  }

  return { ok: true, files };
}

export function getPropertyDocumentFiles(formData: FormData) {
  const entries = [
    ...formData.getAll("files"),
    ...formData.getAll("file"),
  ];

  return entries.filter(
    (entry): entry is File => entry instanceof File && entry.size > 0
  );
}

export function isArchiveWithoutOcr(formData: FormData) {
  return formData.get("archive_without_ocr") === "on";
}

export function getPropertyDocumentTitle(input: {
  requestedTitle: string | null;
  fileName: string;
  totalFiles: number;
}) {
  if (input.requestedTitle && input.totalFiles === 1) {
    return input.requestedTitle;
  }

  const fileTitle =
    input.fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Documento patrimonial";

  return input.requestedTitle
    ? `${input.requestedTitle} - ${fileTitle}`
    : fileTitle;
}
