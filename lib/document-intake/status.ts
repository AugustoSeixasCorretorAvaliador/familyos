export function getDocumentProcessingLabel(
  processingStatus: string,
  metadata: Record<string, unknown> | null | undefined
) {
  return metadata?.archived_without_ocr === true
    ? "Arquivado sem OCR"
    : processingStatus;
}
