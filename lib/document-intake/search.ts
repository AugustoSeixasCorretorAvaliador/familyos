const SEARCHABLE_DOCUMENT_COLUMNS = [
  "title",
  "document_type",
  "document_number",
  "issuing_authority",
  "file_name",
] as const;

export const MAX_DOCUMENT_SEARCH_LENGTH = 120;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeDocumentSearchTerm(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFKC")
    .replace(/[,;%()_*"'`\\.:{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DOCUMENT_SEARCH_LENGTH);
}

export function buildDocumentSearchFilter(
  value: string | null | undefined
) {
  const term = normalizeDocumentSearchTerm(value);
  if (!term) return null;

  return SEARCHABLE_DOCUMENT_COLUMNS.map(
    (column) => `${column}.ilike.%${term}%`
  ).join(",");
}

export function normalizeDocumentOwnerFilter(
  value: string | null | undefined
) {
  const ownerId = (value ?? "").trim();
  return UUID_PATTERN.test(ownerId) ? ownerId.toLowerCase() : "";
}
