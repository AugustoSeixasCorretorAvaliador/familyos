export type OcrErrorCode =
  | "already_processing"
  | "file_too_large"
  | "invalid_response"
  | "openai_not_configured"
  | "provider_unavailable"
  | "rate_limit"
  | "timeout"
  | "unsupported_format";

const PUBLIC_MESSAGES: Record<OcrErrorCode, string> = {
  already_processing: "Este documento ja possui um OCR em processamento.",
  file_too_large: "O arquivo excede o limite configurado para OCR.",
  invalid_response:
    "O documento foi salvo, mas a resposta do OCR nao pôde ser validada. Tente reprocessar mais tarde ou preencha os campos manualmente.",
  openai_not_configured: "O provedor OpenAI OCR nao esta configurado neste ambiente.",
  provider_unavailable:
    "O documento foi salvo, mas nao foi possivel concluir o OCR. Tente reprocessar mais tarde ou preencha os campos manualmente.",
  rate_limit: "O servico de OCR esta temporariamente indisponivel por limite de uso.",
  timeout:
    "O documento foi salvo, mas o OCR excedeu o tempo limite. Tente reprocessar mais tarde ou preencha os campos manualmente.",
  unsupported_format:
    "O documento foi salvo, mas este formato ainda nao pode ser processado automaticamente. Preencha os campos manualmente.",
};

export class OcrOperationalError extends Error {
  readonly code: OcrErrorCode;
  readonly retryable: boolean;
  readonly requestId: string | null;

  constructor(
    code: OcrErrorCode,
    options?: { retryable?: boolean; requestId?: string | null }
  ) {
    super(PUBLIC_MESSAGES[code]);
    this.name = "OcrOperationalError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.requestId = options?.requestId ?? null;
  }
}

export function toOcrOperationalError(error: unknown) {
  if (error instanceof OcrOperationalError) return error;
  return new OcrOperationalError("provider_unavailable", { retryable: true });
}

export function getOcrPublicMessage(code: string | undefined) {
  return code && code in PUBLIC_MESSAGES
    ? PUBLIC_MESSAGES[code as OcrErrorCode]
    : PUBLIC_MESSAGES.provider_unavailable;
}
