const SENSITIVE_KEYS = /token|secret|password|authorization|cookie|cpf|document_number|account|key|contentBase64|rawText|extracted_text/i;

function maskString(value: string) {
  if (value.length <= 6) return "[masked]";
  if (/^Bearer\s+/i.test(value)) return "Bearer [masked]";
  if (/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/.test(value)) return value.replace(/\d(?=\d{2})/g, "*");
  return `${value.slice(0, 3)}...[masked]`;
}

export function redactSensitive(input: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (input === null || input === undefined) return input;
  if (typeof input === "string") return input.length > 256 ? `${input.slice(0, 128)}...[truncated]` : input;
  if (typeof input !== "object") return input;
  if (Array.isArray(input)) return input.slice(0, 20).map((item) => redactSensitive(item, depth + 1));

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.test(key)) {
      output[key] = typeof value === "string" ? maskString(value) : "[masked]";
      continue;
    }
    output[key] = redactSensitive(value, depth + 1);
  }
  return output;
}

export function summarizeInput(input: unknown) {
  return redactSensitive(input) as Record<string, unknown>;
}

export function summarizeResult(result: unknown) {
  return redactSensitive(result) as Record<string, unknown>;
}
