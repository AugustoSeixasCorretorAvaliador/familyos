export type OcrProviderName = "openai" | "google" | "manual";

type OcrProviderEnvironment = {
  OCR_PROVIDER?: string;
  OPENAI_API_KEY?: string;
};

export function resolveOCRProviderName(env: OcrProviderEnvironment): OcrProviderName {
  const configured = env.OCR_PROVIDER?.trim().toLowerCase();

  if (!configured) {
    return env.OPENAI_API_KEY?.trim() ? "openai" : "manual";
  }
  if (configured === "google" || configured === "google_vision") return "google";
  if (configured === "manual") return "manual";
  if (configured === "openai") return "openai";
  return "manual";
}
