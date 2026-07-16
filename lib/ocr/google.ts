import type { OCRInput, OCRProvider, OCRResult } from "@/lib/ocr/types";

type GoogleVisionBatchResponse = {
  responses?: Array<{
    fullTextAnnotation?: {
      text?: string;
      pages?: Array<{
        confidence?: number;
      }>;
    };
    error?: {
      message?: string;
    };
  }>;
};

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export class GoogleVisionOCRProvider implements OCRProvider {
  readonly name = "google_vision";

  async extractText(input: OCRInput): Promise<OCRResult> {
    const startedAt = Date.now();

    // Lightweight fallback for digital PDFs so OCR layer can still process PDFs.
    if (input.mimeType === "application/pdf") {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: input.bytes });
      const parsed = await parser.getText();
      await parser.destroy();
      return {
        provider: this.name,
        text: parsed.text?.trim() ?? "",
        confidence: parsed.text?.trim() ? 0.88 : 0.0,
        durationMs: Date.now() - startedAt,
      };
    }

    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_VISION_API_KEY nao configurada.");
    }

    const endpoint = `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`;
    const body = {
      requests: [
        {
          image: {
            content: toBase64(input.bytes),
          },
          features: [
            {
              type: "DOCUMENT_TEXT_DETECTION",
            },
          ],
        },
      ],
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Falha na chamada Google Vision OCR.");
    }

    const payload = (await response.json()) as GoogleVisionBatchResponse;
    const first = payload.responses?.[0];

    if (first?.error?.message) {
      throw new Error(first.error.message);
    }

    const text = first?.fullTextAnnotation?.text?.trim() ?? "";
    const pageConfidences = (first?.fullTextAnnotation?.pages ?? [])
      .map((page) => page.confidence)
      .filter((value): value is number => typeof value === "number");

    return {
      provider: this.name,
      text,
      confidence: pageConfidences.length > 0 ? average(pageConfidences) : text ? 0.85 : 0,
      durationMs: Date.now() - startedAt,
    };
  }
}
