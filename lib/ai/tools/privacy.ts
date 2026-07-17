const CPF_PATTERN = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const LONG_NUMBER_PATTERN = /\b\d{10,}\b/g;
const LABELED_IDENTIFIER_PATTERN =
  /\b(cpf|rg|passaporte|conta(?:\s+bancaria)?)\s*[:#-]?\s*[a-z0-9.-]{4,}/gi;

export function redactSensitiveText(value: unknown, maxLength = 180) {
  if (typeof value !== "string") return null;

  const compact = value
    .replace(LABELED_IDENTIFIER_PATTERN, "$1 [protegido]")
    .replace(CPF_PATTERN, "[documento protegido]")
    .replace(LONG_NUMBER_PATTERN, "[numero protegido]")
    .replace(/\s+/g, " ")
    .trim();

  if (!compact) return null;
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}…` : compact;
}

export function toDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}
