import type { OCRProvider, OCRResult } from "@/lib/ocr/types";

export class ManualOCRProvider implements OCRProvider {
  readonly name = "manual";

  async process(): Promise<OCRResult> {
    return {
      provider: this.name,
      model: null,
      rawText: "",
      suggestion: {
        detectedType: "Documento Generico",
        fields: {},
        confidenceByField: {},
        overallConfidence: 0,
      },
      confidence: 0,
      confidenceKind: "rule_estimate",
      warnings: ["Processamento automatico desativado; revisao manual necessaria."],
      requiresHumanReview: true,
      durationMs: 0,
      requestId: null,
      extractedFieldsCount: 0,
    };
  }
}
