export class FinanceValidationError extends Error {
  constructor(public readonly code: string) { super(code); }
}

export const ENTRY_TYPES = ["income", "expense", "transfer", "investment_application", "investment_redemption", "investment_yield", "adjustment", "reversal"] as const;
export const ENTRY_STATUSES = ["planned", "confirmed", "payable", "paid", "receivable", "received", "partially_paid", "partially_received", "overdue", "cancelled", "reversed", "pending_confirmation"] as const;
export const CATEGORY_TYPES = ["income", "expense", "investment", "transfer", "adjustment"] as const;

export function textValue(value: FormDataEntryValue | null, required = false) {
  const valueAsText = typeof value === "string" ? value.trim() : "";
  if (required && !valueAsText) throw new FinanceValidationError("required_fields");
  return valueAsText || null;
}

export function moneyValue(value: FormDataEntryValue | null, required = false) {
  const raw = textValue(value, required);
  if (raw === null) return null;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    throw new FinanceValidationError("invalid_amount");
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new FinanceValidationError("invalid_amount");
  }
  return parsed;
}

export function integerValue(value: FormDataEntryValue | null, options: { min: number; max: number; required?: boolean }) {
  const raw = textValue(value, options.required);
  if (raw === null) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < options.min || parsed > options.max) {
    throw new FinanceValidationError("invalid_number");
  }
  return parsed;
}

export function dateValue(value: FormDataEntryValue | null, required = false) {
  const raw = textValue(value, required);
  if (raw === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) {
    throw new FinanceValidationError("invalid_date");
  }
  return raw;
}

export function competenceValue(value: FormDataEntryValue | null) {
  const raw = textValue(value, true)!;
  const normalized = /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : raw;
  const date = dateValue(normalized, true)!;
  if (!date.endsWith("-01")) throw new FinanceValidationError("invalid_competence");
  return date;
}

export function oneOf<T extends readonly string[]>(value: FormDataEntryValue | null, allowed: T) {
  const raw = textValue(value, true)!;
  if (!allowed.includes(raw)) throw new FinanceValidationError("invalid_option");
  return raw as T[number];
}

export function optionalId(formData: FormData, field: string) {
  return textValue(formData.get(field));
}

export function assertNoClientFamilyId(formData: FormData) {
  if (formData.has("family_id")) throw new FinanceValidationError("invalid_family_context");
}

export function validatePercentage(value: FormDataEntryValue | null) {
  const amount = moneyValue(value, true)!;
  if (amount > 100) throw new FinanceValidationError("invalid_percentage");
  return amount;
}
