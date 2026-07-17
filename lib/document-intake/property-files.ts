export const MAX_PROPERTY_ARCHIVE_FILES = 10;

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
