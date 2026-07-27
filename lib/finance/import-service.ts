import "server-only";
import { buildFinanceImportPlan } from "@/lib/finance/import-plan";
import {
  parseFinanceImportZip,
  partitionSafeFinanceImport,
  validateFinanceImportPackage,
  type FinanceImportIssue,
  type QuarantinedImportRecord,
} from "@/lib/finance/importer";
import { createClient } from "@/lib/supabase/server";

export type ImportPreviewCount = { dataset: string; total: number; new: number; updated: number };

export type FinanceImportPreview = {
  digest: string;
  packageName: string;
  competence: string;
  currency: string;
  sourceFiles: string[];
  counts: ImportPreviewCount[];
  issues: FinanceImportIssue[];
  reviewRequired: Array<{ dataset: string; externalId: string }>;
  sourceSummary: { total: number; safe: number; quarantined: number };
  quarantined: QuarantinedImportRecord[];
  canImportSafe: boolean;
};

export type FinanceImportCommitResult = {
  digest: string;
  counts: ImportPreviewCount[];
  written: number;
  created: number;
  updated: number;
  quarantined: QuarantinedImportRecord[];
  integrity: {
    expected: number;
    confirmed: number;
    duplicates: number;
    referencesValid: boolean;
    familyIsolation: boolean;
    valid: boolean;
  };
};

export class FinanceImportBlockedError extends Error {
  constructor(public readonly issues: FinanceImportIssue[]) {
    super("A importação foi bloqueada pela revisão obrigatória.");
  }
}

function withMappingWarnings(issues: FinanceImportIssue[]): FinanceImportIssue[] {
  return [
    ...issues,
    { severity: "non_blocking", code: "DERIVED_INVOICE_DUE_DATE", message: "A data de vencimento das faturas será derivada como o último dia da competência, pois não existe no pacote." },
    { severity: "non_blocking", code: "DERIVED_LEASE_START_DATE", message: "O início dos contratos será derivado da primeira competência de aluguel disponível." },
    { severity: "non_blocking", code: "STATUS_COMPATIBILITY_MAPPING", message: "Status patrimoniais serão mapeados para os enums existentes e o valor original será preservado nos metadados quando disponíveis." },
  ];
}

function count(existing: Set<string>, dataset: string, ids: string[]): ImportPreviewCount {
  const updated = ids.filter((id) => existing.has(id)).length;
  return { dataset, total: ids.length, updated, new: ids.length - updated };
}

function idsOf(result: { data: Array<{ id: string }> | null; error: { message: string } | null }, scope: string) {
  if (result.error) throw new Error(`Falha ao consultar ${scope}: ${result.error.message}`);
  return new Set((result.data ?? []).map((row) => row.id));
}

export async function previewFinanceImportArchive(
  familyId: string,
  userId: string,
  bytes: Uint8Array
): Promise<FinanceImportPreview> {
  const bundle = parseFinanceImportZip(bytes);
  const { safeBundle, quarantined } = partitionSafeFinanceImport(bundle);
  const db = createClient();
  const { data: people, error: peopleError } = await db.from("people").select("id,first_name,last_name").eq("family_id", familyId).is("deleted_at", null);
  if (peopleError) throw new Error(`Falha ao resolver pessoas da família: ${peopleError.message}`);
  const plan = buildFinanceImportPlan(safeBundle, familyId, userId, people ?? []);
  const i = plan.idsByDataset;

  const [categories, properties, cards, units, leases, assets, positions, recurrences, installments, invoices, entries] = await Promise.all([
    db.from("financial_categories").select("id").eq("family_id", familyId).in("id", i.categories),
    db.from("properties").select("id").eq("family_id", familyId).in("id", i.properties),
    db.from("credit_cards").select("id").eq("family_id", familyId).in("id", i.credit_cards),
    db.from("property_units").select("id").eq("family_id", familyId).in("id", i.property_units),
    db.from("lease_contracts").select("id").eq("family_id", familyId).in("id", i.lease_contracts),
    db.from("investment_assets").select("id").eq("family_id", familyId).in("id", i.investment_assets),
    db.from("investment_positions").select("id").eq("family_id", familyId).in("id", i.investment_positions),
    db.from("recurrences").select("id").eq("family_id", familyId).in("id", i.recurring_expenses),
    db.from("installment_purchases").select("id").eq("family_id", familyId).in("id", i.installment_purchases),
    db.from("card_invoices").select("id").eq("family_id", familyId).in("id", i.card_invoices),
    db.from("financial_entries").select("id").eq("family_id", familyId).in("id", i.financial_operations),
  ]);

  const counts = [
    count(idsOf(categories, "categorias"), "categories", i.categories),
    count(idsOf(properties, "imóveis"), "properties", i.properties),
    count(idsOf(cards, "cartões"), "credit_cards", i.credit_cards),
    count(idsOf(units, "unidades"), "property_units", i.property_units),
    count(idsOf(leases, "contratos"), "lease_contracts", i.lease_contracts),
    count(idsOf(assets, "ativos"), "investment_assets", i.investment_assets),
    count(idsOf(positions, "posições"), "investment_positions", i.investment_positions),
    count(idsOf(recurrences, "recorrências"), "recurring_expenses", i.recurring_expenses),
    count(idsOf(installments, "parcelamentos"), "installment_purchases", i.installment_purchases),
    count(idsOf(invoices, "faturas"), "card_invoices", i.card_invoices),
    count(idsOf(entries, "lançamentos"), "financial_operations", i.financial_operations),
  ];
  const issues = withMappingWarnings(validateFinanceImportPackage(bundle));
  const reviewRequired = Object.entries(bundle.datasets).flatMap(([dataset, rows]) => rows
    .filter((row) => row.review_required === true)
    .map((row) => ({ dataset, externalId: String(row.external_id) })));
  const safeIssues = validateFinanceImportPackage(safeBundle);
  const safeBlockers = safeIssues.filter((issue) => issue.severity === "blocking" && issue.source !== "import_review");
  const total = Object.values(bundle.datasets).reduce((sum, rows) => sum + rows.length, 0);
  return {
    digest: bundle.digest,
    packageName: bundle.manifest.package,
    competence: bundle.manifest.competence,
    currency: bundle.manifest.currency,
    sourceFiles: bundle.sourceFiles,
    counts,
    issues,
    reviewRequired,
    sourceSummary: { total, safe: total - quarantined.length, quarantined: quarantined.length },
    quarantined,
    canImportSafe: safeBlockers.length === 0,
  };
}

function assertWrite(result: { error: { message: string } | null }, scope: string) {
  if (result.error) throw new Error(`Falha ao importar ${scope}: ${result.error.message}`);
}

export async function commitFinanceImportArchive(
  familyId: string,
  userId: string,
  bytes: Uint8Array,
  expectedDigest: string
): Promise<FinanceImportCommitResult> {
  const preview = await previewFinanceImportArchive(familyId, userId, bytes);
  if (preview.digest !== expectedDigest) {
    throw new FinanceImportBlockedError([{ severity: "blocking", code: "ARCHIVE_CHANGED", message: "O ZIP mudou depois da Preview. Gere uma nova prévia." }]);
  }
  if (!preview.canImportSafe) {
    throw new FinanceImportBlockedError(preview.issues.filter((issue) => issue.severity === "blocking" && issue.source !== "import_review"));
  }

  const bundle = parseFinanceImportZip(bytes);
  const { safeBundle } = partitionSafeFinanceImport(bundle);
  const db = createClient();
  const { data: people, error: peopleError } = await db.from("people").select("id,first_name,last_name").eq("family_id", familyId).is("deleted_at", null);
  if (peopleError) throw new Error(`Falha ao resolver pessoas da família: ${peopleError.message}`);
  const plan = buildFinanceImportPlan(safeBundle, familyId, userId, people ?? []);

  assertWrite(await db.from("financial_categories").upsert(plan.categories, { onConflict: "id" }), "categorias");
  assertWrite(await db.from("properties").upsert(plan.properties, { onConflict: "id" }), "imóveis");
  assertWrite(await db.from("credit_cards").upsert(plan.cards, { onConflict: "id" }), "cartões");
  assertWrite(await db.from("property_units").upsert(plan.units, { onConflict: "id" }), "unidades");
  assertWrite(await db.from("lease_contracts").upsert(plan.leases, { onConflict: "id" }), "contratos");
  assertWrite(await db.from("investment_assets").upsert(plan.assets, { onConflict: "id" }), "ativos");
  assertWrite(await db.from("investment_positions").upsert(plan.positions, { onConflict: "id" }), "posições");
  assertWrite(await db.from("recurrences").upsert(plan.recurrences, { onConflict: "id" }), "recorrências");
  assertWrite(await db.from("installment_purchases").upsert(plan.installments, { onConflict: "id" }), "parcelamentos");
  assertWrite(await db.from("card_invoices").upsert(plan.invoices, { onConflict: "id" }), "faturas");
  assertWrite(await db.from("financial_entries").upsert(plan.entries, { onConflict: "id" }), "lançamentos");

  const postCommit = await previewFinanceImportArchive(familyId, userId, bytes);
  const expected = Object.values(plan.idsByDataset).reduce((total, values) => total + values.length, 0);
  const confirmed = postCommit.counts.reduce((total, item) => total + item.updated, 0);
  const created = preview.counts.reduce((total, item) => total + item.new, 0);
  const updated = preview.counts.reduce((total, item) => total + item.updated, 0);
  const uniqueIds = new Set(Object.values(plan.idsByDataset).flat()).size;
  const duplicates = expected - uniqueIds;
  return {
    digest: preview.digest,
    counts: preview.counts,
    written: expected,
    created,
    updated,
    quarantined: preview.quarantined,
    integrity: {
      expected,
      confirmed,
      duplicates,
      referencesValid: confirmed === expected,
      familyIsolation: confirmed === expected,
      valid: confirmed === expected && duplicates === 0,
    },
  };
}
