import { describe, expect, it } from "vitest";
import {
  MAX_DOCUMENT_SEARCH_LENGTH,
  buildDocumentSearchFilter,
  normalizeDocumentOwnerFilter,
  normalizeDocumentSearchTerm,
} from "@/lib/document-intake/search";

describe("document search", () => {
  it("gera busca livre nos campos descritivos do documento", () => {
    expect(buildDocumentSearchFilter("Exame")).toBe(
      [
        "title.ilike.%Exame%",
        "document_type.ilike.%Exame%",
        "document_number.ilike.%Exame%",
        "issuing_authority.ilike.%Exame%",
        "file_name.ilike.%Exame%",
      ].join(",")
    );
  });

  it("preserva letras acentuadas e normaliza espaços", () => {
    expect(normalizeDocumentSearchTerm("  Certidão   médica  ")).toBe(
      "Certidão médica"
    );
  });

  it("remove operadores que poderiam alterar a sintaxe PostgREST", () => {
    expect(
      normalizeDocumentSearchTerm("Exame),title.eq.segredo,%_('")
    ).toBe("Exame title eq segredo");
  });

  it("ignora busca vazia e limita entradas excessivas", () => {
    expect(buildDocumentSearchFilter(" ,%() ")).toBeNull();
    expect(normalizeDocumentSearchTerm("a".repeat(500))).toHaveLength(
      MAX_DOCUMENT_SEARCH_LENGTH
    );
  });

  it("aceita somente vinculo com UUID valido", () => {
    expect(
      normalizeDocumentOwnerFilter(
        "A3F45C10-9C5D-4F9A-8E2B-1234567890AB"
      )
    ).toBe("a3f45c10-9c5d-4f9a-8e2b-1234567890ab");
    expect(normalizeDocumentOwnerFilter("Bella")).toBe("");
  });
});
