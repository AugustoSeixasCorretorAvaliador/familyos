import { GoogleVisionOCRProvider } from "@/lib/ocr/google";
import type { OCRProvider } from "@/lib/ocr/types";

export function getOCRProvider(): OCRProvider {
  const provider = (process.env.OCR_PROVIDER ?? "google").toLowerCase();

  switch (provider) {
    case "google":
    case "google_vision":
    default:
      return new GoogleVisionOCRProvider();
  }
}
