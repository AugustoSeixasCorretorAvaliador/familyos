import { createHash } from "node:crypto";
import { strFromU8, unzipSync } from "fflate";

export const IMPORT_DATASETS = [
  "categories",
  "properties",
  "credit_cards",
  "lease_contracts",
  "rental_income",
  "rental_charges",
  "investment_assets",
  "investment_positions",
  "recurring_expenses",
  "installment_purchases",
  "card_purchases",
  "card_invoices",
  "financial_entries",
] as const;

export type ImportDatasetName = (typeof IMPORT_DATASETS)[number];
export type ImportRecord = Record<string, unknown> & { external_id?: unknown; review_required?: unknown };

export type ImportManifest = {
  package: string;
  version: number;
  currency: string;
  locale: string;
  competence: string;
  source: string;
  import_mode: string;
  rules: string[];
};

export type ImportReviewItem = {
  severity: "blocking" | "non_blocking";
  code: string;
  message: string;
};

export type FinanceImportPackage = {
  digest: string;
  readme: string;
  manifest: ImportManifest;
  review: { status: string; items: ImportReviewItem[] };
  datasets: Record<ImportDatasetName, ImportRecord[]>;
  sourceFiles: string[];
};

export type FinanceImportIssue = {
  severity: "blocking" | "non_blocking";
  code: string;
  message: string;
  dataset?: ImportDatasetName;
  externalId?: string;
  source?: "import_review" | "record" | "structural";
};

export type QuarantinedImportRecord = {
  dataset: ImportDatasetName;
  externalId: string;
  reason: string;
};

const OFFICIAL_QUARANTINE = new Map<string, string>([
  ["investment_assets/inv-unidentified-215k", "Investimento sem descrição confirmada."],
  ["investment_positions/pos-unidentified-215k-2026-08", "Posição vinculada ao investimento sem descrição confirmada."],
  ["rental_charges/charge-marte-iptu-2026-08", "Imóvel Marte não existe no cadastro patrimonial confirmado."],
]);

const REQUIRED_JSON = [
  "README.md",
  "manifest.json",
  "import_review.json",
  ...IMPORT_DATASETS.map((name) => `${name}.json`),
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeJson(raw: string, file: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`JSON inválido em ${file}.`);
  }
}

function basename(path: string) {
  return path.replaceAll("\\", "/").split("/").filter(Boolean).at(-1) ?? "";
}

export function parseFinanceImportZip(bytes: Uint8Array): FinanceImportPackage {
  if (!bytes.length) throw new Error("O arquivo ZIP está vazio.");
  let expandedBytes = 0;
  let fileCount = 0;
  const archive = unzipSync(bytes, { filter: (entry) => {
    if (entry.name.endsWith("/")) return false;
    fileCount += 1;
    expandedBytes += entry.originalSize;
    if (fileCount > 100 || expandedBytes > 20 * 1024 * 1024) throw new Error("O ZIP excede os limites seguros de extração.");
    return true;
  } });
  const byName = new Map<string, Uint8Array>();
  const sourceFiles: string[] = [];

  for (const [path, content] of Object.entries(archive)) {
    const normalized = path.replaceAll("\\", "/");
    if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
      throw new Error(`Caminho inseguro no ZIP: ${path}`);
    }
    sourceFiles.push(normalized);
    const name = basename(normalized);
    if (byName.has(name)) throw new Error(`Arquivo duplicado no ZIP: ${name}`);
    byName.set(name, content);
  }

  const missing = REQUIRED_JSON.filter((name) => !byName.has(name));
  if (missing.length) throw new Error(`Arquivos obrigatórios ausentes: ${missing.join(", ")}.`);

  const manifestValue = safeJson(strFromU8(byName.get("manifest.json")!), "manifest.json");
  const reviewValue = safeJson(strFromU8(byName.get("import_review.json")!), "import_review.json");
  const readme = strFromU8(byName.get("README.md")!).trim();
  if (!readme) throw new Error("README.md está vazio.");
  if (!isRecord(manifestValue)) throw new Error("manifest.json deve conter um objeto.");
  if (!isRecord(reviewValue) || !Array.isArray(reviewValue.items)) {
    throw new Error("import_review.json deve conter status e items.");
  }

  const datasets = {} as Record<ImportDatasetName, ImportRecord[]>;
  for (const name of IMPORT_DATASETS) {
    const value = safeJson(strFromU8(byName.get(`${name}.json`)!), `${name}.json`);
    if (!Array.isArray(value) || value.some((row) => !isRecord(row))) {
      throw new Error(`${name}.json deve conter uma lista de objetos.`);
    }
    datasets[name] = value as ImportRecord[];
  }

  return {
    digest: createHash("sha256").update(bytes).digest("hex"),
    readme,
    manifest: manifestValue as ImportManifest,
    review: reviewValue as FinanceImportPackage["review"],
    datasets,
    sourceFiles: sourceFiles.sort(),
  };
}

function referenceIssues(
  source: ImportDatasetName,
  field: string,
  target: ImportDatasetName,
  datasets: FinanceImportPackage["datasets"]
) {
  const targets = new Set(datasets[target].map((row) => row.external_id).filter((id): id is string => typeof id === "string"));
  const issues: FinanceImportIssue[] = [];
  for (const row of datasets[source]) {
    const reference = row[field];
    if (reference == null || reference === "") continue;
    if (typeof reference !== "string" || !targets.has(reference)) {
      issues.push({
        severity: "blocking",
        code: "BROKEN_REFERENCE",
        message: `${field}=${String(reference)} não existe em ${target}.`,
        dataset: source,
        externalId: typeof row.external_id === "string" ? row.external_id : undefined,
        source: "structural",
      });
    }
  }
  return issues;
}

export function validateFinanceImportPackage(bundle: FinanceImportPackage): FinanceImportIssue[] {
  const issues: FinanceImportIssue[] = [];
  const manifest = bundle.manifest;
  if (manifest.version !== 1 || manifest.currency !== "BRL" || manifest.locale !== "pt-BR") {
    issues.push({ severity: "blocking", code: "UNSUPPORTED_MANIFEST", message: "Versão, moeda ou locale do manifesto não são suportados.", source: "structural" });
  }
  if (manifest.import_mode !== "preview_then_commit" || !/^\d{4}-\d{2}$/.test(manifest.competence ?? "")) {
    issues.push({ severity: "blocking", code: "INVALID_MANIFEST", message: "O manifesto não declara competência e modo preview_then_commit válidos.", source: "structural" });
  }

  for (const item of bundle.review.items) {
    issues.push({ severity: item.severity, code: item.code, message: item.message, source: "import_review" });
  }
  if (bundle.review.status !== "ready_for_commit" && !bundle.review.items.some((item) => item.severity === "blocking")) {
    issues.push({ severity: "blocking", code: "REVIEW_STATUS_BLOCKED", message: `import_review.json está com status ${bundle.review.status}.`, source: "import_review" });
  }

  const amountFields = new Set(["amount", "amount_brl", "planned_amount", "actual_amount", "base_monthly_amount", "installment_amount", "closed_amount"]);
  for (const dataset of IMPORT_DATASETS) {
    const seen = new Set<string>();
    for (const row of bundle.datasets[dataset]) {
      const externalId = row.external_id;
      if (typeof externalId !== "string" || externalId.length === 0) {
        issues.push({ severity: "blocking", code: "MISSING_EXTERNAL_ID", message: "Registro sem external_id válido.", dataset, source: "structural" });
        continue;
      }
      if (seen.has(externalId)) {
        issues.push({ severity: "blocking", code: "DUPLICATE_EXTERNAL_ID", message: `external_id duplicado: ${externalId}.`, dataset, externalId, source: "structural" });
      }
      seen.add(externalId);
      if (row.review_required === true) {
        issues.push({ severity: "blocking", code: "REVIEW_REQUIRED", message: "Registro marcado como review_required.", dataset, externalId, source: "record" });
      }
      for (const [field, value] of Object.entries(row)) {
        if (!amountFields.has(field) || value == null) continue;
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
          issues.push({ severity: "blocking", code: "INVALID_FINANCIAL_VALUE", message: `${field} deve ser um número não negativo.`, dataset, externalId, source: "structural" });
        }
      }
    }
  }

  issues.push(
    ...referenceIssues("lease_contracts", "property_external_id", "properties", bundle.datasets),
    ...referenceIssues("rental_income", "lease_external_id", "lease_contracts", bundle.datasets),
    ...referenceIssues("rental_charges", "property_external_id", "properties", bundle.datasets),
    ...referenceIssues("investment_positions", "asset_external_id", "investment_assets", bundle.datasets),
    ...referenceIssues("recurring_expenses", "card_external_id", "credit_cards", bundle.datasets),
    ...referenceIssues("recurring_expenses", "category_external_id", "categories", bundle.datasets),
    ...referenceIssues("installment_purchases", "card_external_id", "credit_cards", bundle.datasets),
    ...referenceIssues("card_purchases", "card_external_id", "credit_cards", bundle.datasets),
    ...referenceIssues("card_invoices", "card_external_id", "credit_cards", bundle.datasets),
    ...referenceIssues("financial_entries", "category_external_id", "categories", bundle.datasets)
  );
  return issues;
}

export function partitionSafeFinanceImport(bundle: FinanceImportPackage) {
  const quarantined: QuarantinedImportRecord[] = [];
  const datasets = {} as Record<ImportDatasetName, ImportRecord[]>;
  for (const dataset of IMPORT_DATASETS) {
    datasets[dataset] = bundle.datasets[dataset].filter((row) => {
      const externalId = typeof row.external_id === "string" ? row.external_id : "";
      const reason = OFFICIAL_QUARANTINE.get(`${dataset}/${externalId}`);
      if (!reason) return true;
      quarantined.push({ dataset, externalId, reason });
      return false;
    });
  }
  return { safeBundle: { ...bundle, datasets }, quarantined };
}

export function deterministicImportUuid(familyId: string, dataset: string, externalId: string) {
  const bytes = createHash("sha256").update(`hero-familyos-import-v1\0${familyId}\0${dataset}\0${externalId}`, "utf8").digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function importSourceKey(dataset: string, externalId: string) {
  return `familyos-import:v1:${dataset}:${externalId}`;
}

export function externalIdOf(row: ImportRecord) {
  if (typeof row.external_id !== "string" || !row.external_id) throw new Error("external_id inválido.");
  return row.external_id;
}

export function textField(row: ImportRecord, field: string, fallback = "") {
  const value = row[field];
  return typeof value === "string" ? value : fallback;
}

export function numberField(row: ImportRecord, field: string, fallback = 0) {
  const value = row[field];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function monthDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) throw new Error(`Competência inválida: ${String(value)}.`);
  return `${value}-01`;
}
