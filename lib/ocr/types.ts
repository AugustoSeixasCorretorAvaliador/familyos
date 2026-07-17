import type { DocumentSuggestion } from "@/lib/document-parser/types";

export type OCRInput = {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
  documentTypeHint?: string | null;
};

export type OCRResult = {
  provider: string;
  model: string | null;
  rawText: string;
  suggestion: DocumentSuggestion;
  confidence: number;
  confidenceKind: "provider" | "model_estimate" | "rule_estimate";
  warnings: string[];
  requiresHumanReview: boolean;
  durationMs: number;
  requestId: string | null;
  extractedFieldsCount: number;
};

export interface OCRProvider {
  readonly name: string;
  process(input: OCRInput): Promise<OCRResult>;
}
