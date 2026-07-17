import type {
  DocumentSuggestion,
  DocumentSuggestionFields,
  SupportedDocumentType,
} from "@/lib/document-parser/types";
import { OcrOperationalError } from "@/lib/ocr/errors";

export const OCR_DOCUMENT_TYPES = [
  "RG",
  "CPF",
  "CNH",
  "Passaporte Brasileiro",
  "Passaporte Portugues",
  "Certidao de Nascimento",
  "Certidao de Casamento",
  "Escritura",
  "Matricula de Imovel",
  "IPTU",
  "Contrato",
  "Procuracao",
  "Laudo Medico",
  "Receita",
  "Exame",
  "Documento Generico",
] as const;

export const OCR_FIELD_KEYS = [
  "nome",
  "numero",
  "cpf",
  "rg",
  "orgao_emissor",
  "pais",
  "livro",
  "folha",
  "termo",
  "matricula",
  "cartorio",
  "data_emissao",
  "data_validade",
  "data_nascimento",
  "nacionalidade",
  "naturalidade",
  "filiacao",
  "valor_monetario",
  "observacoes",
] as const;

export type OcrFieldKey = (typeof OCR_FIELD_KEYS)[number];

type StructuredField = {
  value: string | null;
  confidence: number | null;
};

export type OpenAIOcrPayload = {
  document_type: (typeof OCR_DOCUMENT_TYPES)[number];
  raw_text: string;
  fields: Record<OcrFieldKey, StructuredField>;
  warnings: string[];
  requires_human_review: boolean;
  overall_confidence: number;
};

const fieldSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    value: { type: ["string", "null"] },
    confidence: { type: ["number", "null"], minimum: 0, maximum: 1 },
  },
  required: ["value", "confidence"],
};

export const OPENAI_OCR_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    document_type: { type: "string", enum: OCR_DOCUMENT_TYPES },
    raw_text: { type: "string" },
    fields: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(OCR_FIELD_KEYS.map((key) => [key, fieldSchema])),
      required: OCR_FIELD_KEYS,
    },
    warnings: { type: "array", items: { type: "string" } },
    requires_human_review: { type: "boolean" },
    overall_confidence: { type: "number", minimum: 0, maximum: 1 },
  },
  required: [
    "document_type",
    "raw_text",
    "fields",
    "warnings",
    "requires_human_review",
    "overall_confidence",
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

export function parseOpenAIOcrPayload(raw: string): OpenAIOcrPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new OcrOperationalError("invalid_response");
  }

  if (
    !isRecord(parsed) ||
    !OCR_DOCUMENT_TYPES.includes(parsed.document_type as (typeof OCR_DOCUMENT_TYPES)[number]) ||
    typeof parsed.raw_text !== "string" ||
    !isRecord(parsed.fields) ||
    !Array.isArray(parsed.warnings) ||
    !parsed.warnings.every((warning) => typeof warning === "string") ||
    typeof parsed.requires_human_review !== "boolean" ||
    typeof parsed.overall_confidence !== "number" ||
    parsed.overall_confidence < 0 ||
    parsed.overall_confidence > 1
  ) {
    throw new OcrOperationalError("invalid_response");
  }

  const fields = {} as Record<OcrFieldKey, StructuredField>;
  for (const key of OCR_FIELD_KEYS) {
    const field = parsed.fields[key];
    if (
      !isRecord(field) ||
      (field.value !== null && typeof field.value !== "string") ||
      (field.confidence !== null &&
        (typeof field.confidence !== "number" ||
          field.confidence < 0 ||
          field.confidence > 1))
    ) {
      throw new OcrOperationalError("invalid_response");
    }

    const value =
      typeof field.value === "string" && key.startsWith("data_")
        ? normalizeDate(field.value)
        : (field.value as string | null);
    fields[key] = { value, confidence: field.confidence as number | null };
  }

  return {
    document_type: parsed.document_type as OpenAIOcrPayload["document_type"],
    raw_text: parsed.raw_text,
    fields,
    warnings: parsed.warnings as string[],
    requires_human_review: parsed.requires_human_review,
    overall_confidence: parsed.overall_confidence,
  };
}

export function payloadToSuggestion(payload: OpenAIOcrPayload): DocumentSuggestion {
  const fields: DocumentSuggestionFields = {};
  const confidenceByField: Record<string, number> = {};

  for (const key of OCR_FIELD_KEYS) {
    const field = payload.fields[key];
    if (field.value !== null && field.value.trim() !== "") {
      fields[key] = field.value;
    }
    if (field.confidence !== null) {
      confidenceByField[key] = field.confidence;
    }
  }

  return {
    detectedType: payload.document_type as SupportedDocumentType,
    fields,
    confidenceByField,
    overallConfidence: payload.overall_confidence,
  };
}
