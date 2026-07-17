import { describe, expect, it } from "vitest";
import {
  OCR_FIELD_KEYS,
  parseOpenAIOcrPayload,
  payloadToSuggestion,
  type OpenAIOcrPayload,
} from "@/lib/ocr/schema";

function validPayload(): OpenAIOcrPayload {
  return {
    document_type: "CNH",
    raw_text: "CONTEUDO SANITIZADO",
    fields: Object.fromEntries(
      OCR_FIELD_KEYS.map((key) => [key, { value: null, confidence: null }])
    ) as OpenAIOcrPayload["fields"],
    warnings: [],
    requires_human_review: true,
    overall_confidence: 0.91,
  };
}

describe("OpenAI OCR structured response", () => {
  it("accepts a valid structured payload and preserves leading zeros", () => {
    const payload = validPayload();
    payload.fields.numero = { value: "03181137785", confidence: 0.98 };

    const parsed = parseOpenAIOcrPayload(JSON.stringify(payload));
    expect(parsed.fields.numero.value).toBe("03181137785");
    expect(payloadToSuggestion(parsed).fields.numero).toBe("03181137785");
  });

  it("keeps unreadable fields as null", () => {
    const parsed = parseOpenAIOcrPayload(JSON.stringify(validPayload()));
    expect(parsed.fields.cpf.value).toBeNull();
    expect(payloadToSuggestion(parsed).fields.cpf).toBeUndefined();
  });

  it("normalizes unambiguous Brazilian dates", () => {
    const payload = validPayload();
    payload.fields.data_emissao = { value: "05/10/2023", confidence: 0.96 };

    const parsed = parseOpenAIOcrPayload(JSON.stringify(payload));
    expect(parsed.fields.data_emissao.value).toBe("2023-10-05");
  });

  it("rejects invalid or non-structured output", () => {
    expect(() => parseOpenAIOcrPayload("not-json")).toThrowError(
      expect.objectContaining({ code: "invalid_response" })
    );
  });
});
