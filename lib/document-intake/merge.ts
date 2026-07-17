export type DocumentIntakeMode = "new" | "existing";

export type IntakeFieldValue = string | null | undefined;

export type MergeOcrSuggestionsInput = {
  currentValues: Record<string, IntakeFieldValue>;
  suggestedValues: Record<string, IntakeFieldValue>;
  mode: DocumentIntakeMode;
};

export type OcrSuggestionConflict = {
  field: string;
  currentValue: string;
  suggestedValue: string;
};

export type MergeOcrSuggestionsResult = {
  values: Record<string, string>;
  conflicts: OcrSuggestionConflict[];
};

function normalized(value: IntakeFieldValue) {
  return typeof value === "string" ? value.trim() : "";
}

export function mergeOcrSuggestions({
  currentValues,
  suggestedValues,
  mode,
}: MergeOcrSuggestionsInput): MergeOcrSuggestionsResult {
  const values: Record<string, string> = {};
  const conflicts: OcrSuggestionConflict[] = [];
  const keys = new Set([
    ...Object.keys(currentValues),
    ...Object.keys(suggestedValues),
  ]);

  for (const field of Array.from(keys)) {
    const currentValue = normalized(currentValues[field]);
    const suggestedValue = normalized(suggestedValues[field]);

    if (currentValue) {
      values[field] = currentValue;
      if (
        mode === "existing" &&
        suggestedValue &&
        currentValue !== suggestedValue
      ) {
        conflicts.push({ field, currentValue, suggestedValue });
      }
      continue;
    }

    values[field] = suggestedValue;
  }

  return { values, conflicts };
}

export function suggestDocumentTitle(input: {
  documentType?: IntakeFieldValue;
  personName?: IntakeFieldValue;
  documentNumber?: IntakeFieldValue;
  registryNumber?: IntakeFieldValue;
  issueDate?: IntakeFieldValue;
}) {
  const documentType = normalized(input.documentType);
  const personName = normalized(input.personName);
  const documentNumber = normalized(input.documentNumber);
  const registryNumber = normalized(input.registryNumber);
  const issueDate = normalized(input.issueDate);

  if (!documentType) return "";
  if (personName) return `${documentType} — ${personName}`;
  if (registryNumber) return `${documentType} ${registryNumber}`;
  if (documentNumber) return `${documentType} ${documentNumber}`;
  if (issueDate) return `${documentType} — ${issueDate}`;
  return documentType === "Documento Generico" ? "" : documentType;
}
