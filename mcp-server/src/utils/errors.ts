export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly retryable: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode = 400,
    code = "INTERNAL_ERROR",
    retryable = false,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Unexpected error";
}

export type StructuredError = {
  code: string;
  message: string;
  retryable: boolean;
  details?: Record<string, unknown>;
};

export function toStructuredError(error: unknown): StructuredError {
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(error.details ? { details: error.details } : {}),
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: process.env.NODE_ENV === "production" ? "Internal server error" : toErrorMessage(error),
    retryable: false,
  };
}
