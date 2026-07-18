import { describe, expect, it } from "vitest";
import {
  getPropertyDocumentFiles,
  getPropertyDocumentTitle,
  isArchiveWithoutOcr,
  validateUploadedPropertyDocuments,
} from "@/lib/document-intake/property-files";

describe("property document archive intake", () => {
  it("aceita varios arquivos para o pool patrimonial", () => {
    const formData = new FormData();
    formData.append("files", new File(["rgi"], "rgi.pdf", { type: "application/pdf" }));
    formData.append("files", new File(["iptu"], "iptu-2026.pdf", { type: "application/pdf" }));

    expect(getPropertyDocumentFiles(formData).map((file) => file.name)).toEqual([
      "rgi.pdf",
      "iptu-2026.pdf",
    ]);
  });

  it("identifica o modo de arquivamento sem OCR", () => {
    const formData = new FormData();
    formData.set("archive_without_ocr", "on");

    expect(isArchiveWithoutOcr(formData)).toBe(true);
  });

  it("gera um titulo individual a partir de cada arquivo", () => {
    expect(
      getPropertyDocumentTitle({
        requestedTitle: "Documentos do imovel",
        fileName: "promessa-compra_venda.pdf",
        totalFiles: 2,
      })
    ).toBe("Documentos do imovel - promessa compra venda");
  });

  it("aceita somente uploads previamente gravados dentro da familia", () => {
    const result = validateUploadedPropertyDocuments(
      [
        {
          storagePath: "family-1/sem-titular/documento/arquivo.pdf",
          fileName: "arquivo.pdf",
          mimeType: "application/pdf",
          size: 1024,
        },
      ],
      "family-1"
    );

    expect(result).toEqual({
      ok: true,
      files: [
        {
          storagePath: "family-1/sem-titular/documento/arquivo.pdf",
          fileName: "arquivo.pdf",
          mimeType: "application/pdf",
          size: 1024,
        },
      ],
    });
  });

  it("rejeita caminho de outra familia", () => {
    expect(
      validateUploadedPropertyDocuments(
        [
          {
            storagePath: "family-2/sem-titular/documento/arquivo.pdf",
            fileName: "arquivo.pdf",
            mimeType: "application/pdf",
            size: 1024,
          },
        ],
        "family-1"
      )
    ).toEqual({ ok: false, code: "invalid_file" });
  });
});
