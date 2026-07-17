import { describe, expect, it } from "vitest";
import {
  mergeOcrSuggestions,
  suggestDocumentTitle,
} from "@/lib/document-intake/merge";

describe("mergeOcrSuggestions", () => {
  it("preenche campos vazios de um cadastro novo", () => {
    expect(
      mergeOcrSuggestions({
        currentValues: { numero: "", pais: null },
        suggestedValues: { numero: "001234", pais: "Brasil" },
        mode: "new",
      })
    ).toEqual({
      values: { numero: "001234", pais: "Brasil" },
      conflicts: [],
    });
  });

  it("preserva o valor digitado pelo usuario em cadastro novo", () => {
    expect(
      mergeOcrSuggestions({
        currentValues: { numero: "000111" },
        suggestedValues: { numero: "999999" },
        mode: "new",
      })
    ).toEqual({
      values: { numero: "000111" },
      conflicts: [],
    });
  });

  it("preserva e sinaliza conflito em documento existente", () => {
    expect(
      mergeOcrSuggestions({
        currentValues: { numero: "000111", pais: "" },
        suggestedValues: { numero: "999999", pais: "Brasil" },
        mode: "existing",
      })
    ).toEqual({
      values: { numero: "000111", pais: "Brasil" },
      conflicts: [
        {
          field: "numero",
          currentValue: "000111",
          suggestedValue: "999999",
        },
      ],
    });
  });

  it("nao inventa valor quando o OCR nao reconhece o campo", () => {
    expect(
      mergeOcrSuggestions({
        currentValues: { numero: "", cpf: null },
        suggestedValues: { numero: null },
        mode: "new",
      }).values
    ).toEqual({ numero: "", cpf: "" });
  });
});

describe("suggestDocumentTitle", () => {
  it("gera titulo editavel com tipo e nome", () => {
    expect(
      suggestDocumentTitle({
        documentType: "CNH",
        personName: "José Augusto",
        documentNumber: "00123",
      })
    ).toBe("CNH — José Augusto");
  });

  it("preserva zeros a esquerda no numero", () => {
    expect(
      suggestDocumentTitle({
        documentType: "Contrato",
        documentNumber: "00123",
      })
    ).toBe("Contrato 00123");
  });

  it("mantem vazio quando nao ha dados suficientes", () => {
    expect(
      suggestDocumentTitle({ documentType: "Documento Generico" })
    ).toBe("");
  });
});
