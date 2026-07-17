import { GoogleVisionOCRProvider } from "@/lib/ocr/google";
import { ManualOCRProvider } from "@/lib/ocr/manual";
import { OpenAIOcrProvider } from "@/lib/ocr/openai";
import { resolveOCRProviderName } from "@/lib/ocr/selection";
import type { OCRProvider } from "@/lib/ocr/types";

export function getOCRProvider(): OCRProvider {
  const provider = resolveOCRProviderName({
    OCR_PROVIDER: process.env.OCR_PROVIDER,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  });

  switch (provider) {
    case "openai":
      return new OpenAIOcrProvider();
    case "google":
      return new GoogleVisionOCRProvider();
    case "manual":
    default:
      return new ManualOCRProvider();
  }
}
