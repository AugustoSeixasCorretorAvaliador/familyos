import "server-only";

export const DEFAULT_OPENAI_OCR_MODEL = "gpt-5-mini";
export const DEFAULT_OCR_MAX_RETRIES = 3;
export const DEFAULT_OCR_TIMEOUT_MS = 60_000;
export const DEFAULT_OCR_MAX_FILE_SIZE_MB = 20;
export const DEFAULT_OCR_CONFIDENCE_REVIEW_THRESHOLD = 0.8;

function numberInRange(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

export function getOcrConfig() {
  const maxFileSizeMb = numberInRange(
    process.env.OCR_MAX_FILE_SIZE_MB,
    DEFAULT_OCR_MAX_FILE_SIZE_MB,
    1,
    50
  );

  return {
    openAIModel: process.env.OPENAI_OCR_MODEL?.trim() || DEFAULT_OPENAI_OCR_MODEL,
    maxRetries: Math.floor(
      numberInRange(process.env.OCR_MAX_RETRIES, DEFAULT_OCR_MAX_RETRIES, 0, 5)
    ),
    timeoutMs: Math.floor(
      numberInRange(process.env.OCR_TIMEOUT_MS, DEFAULT_OCR_TIMEOUT_MS, 5_000, 120_000)
    ),
    maxFileSizeMb,
    maxFileSizeBytes: Math.floor(maxFileSizeMb * 1024 * 1024),
    reviewThreshold: numberInRange(
      process.env.OCR_CONFIDENCE_REVIEW_THRESHOLD,
      DEFAULT_OCR_CONFIDENCE_REVIEW_THRESHOLD,
      0,
      1
    ),
  };
}
