import { describe, expect, it } from "vitest";
import { parseDocumentText } from "@/lib/document-parser/parser";

describe("vehicle and insurance document parser", () => {
  it("recognizes CRLV and extracts labelled vehicle identifiers", () => {
    const result = parseDocumentText(`
      CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEICULO - CRLV
      Placa: ABC1D23
      RENAVAM: 00123456789
      Chassi: 9BWZZZ377VT004251
    `);

    expect(result.detectedType).toBe("CRLV");
    expect(result.fields.placa).toBe("ABC1D23");
    expect(result.fields.renavam).toBe("00123456789");
    expect(result.fields.chassi).toBe("9BWZZZ377VT004251");
  });

  it("recognizes an insurance policy and extracts its main labels", () => {
    const result = parseDocumentText(`
      APOLICE DE SEGURO
      Apolice nº: AUTO-00123
      Seguradora: Seguros Exemplo S.A.
      Valor segurado: R$ 150.000,00
      Franquia: R$ 4.500,00
    `);

    expect(result.detectedType).toBe("Apolice de Seguro");
    expect(result.fields.numero_apolice).toBe("AUTO-00123");
    expect(result.fields.valor_segurado).toBe("R$ 150.000,00");
    expect(result.fields.franquia).toBe("R$ 4.500,00");
  });
});
