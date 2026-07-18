import { describe, expect, it } from "vitest";
import { getDocumentProcessingLabel } from "@/lib/document-intake/status";

describe("getDocumentProcessingLabel", () => {
  it("exibe o arquivamento sem OCR a partir dos metadados", () => {
    expect(
      getDocumentProcessingLabel("Confirmado", {
        archived_without_ocr: true,
      })
    ).toBe("Arquivado sem OCR");
  });

  it("preserva o status normal do pipeline", () => {
    expect(
      getDocumentProcessingLabel("Aguardando conferencia", {
        archived_without_ocr: false,
      })
    ).toBe("Aguardando conferencia");
  });
});
