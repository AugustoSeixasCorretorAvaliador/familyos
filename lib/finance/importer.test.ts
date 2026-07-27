import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import {
  IMPORT_DATASETS,
  deterministicImportUuid,
  parseFinanceImportZip,
  validateFinanceImportPackage,
} from "@/lib/finance/importer";

function archive(overrides: Partial<Record<string, unknown>> = {}) {
  const files: Record<string, Uint8Array> = {
    "bundle/README.md": strToU8("Preview obrigatória."),
    "bundle/manifest.json": strToU8(JSON.stringify({ package: "Teste", version: 1, currency: "BRL", locale: "pt-BR", competence: "2026-08", source: "teste", import_mode: "preview_then_commit", rules: [] })),
    "bundle/import_review.json": strToU8(JSON.stringify({ status: "ready_for_commit", items: [] })),
  };
  for (const dataset of IMPORT_DATASETS) files[`bundle/${dataset}.json`] = strToU8(JSON.stringify(overrides[dataset] ?? []));
  for (const [name, value] of Object.entries(overrides)) {
    if (name.endsWith(".json")) files[`bundle/${name}`] = strToU8(JSON.stringify(value));
  }
  return zipSync(files);
}

describe("finance import package", () => {
  it("parses the documented ZIP without changing JSON records", () => {
    const categories = [{ external_id: "cat-1", name: "Receita", kind: "income" }];
    const bundle = parseFinanceImportZip(archive({ categories }));
    const before = JSON.stringify(bundle.datasets);
    expect(bundle.manifest.competence).toBe("2026-08");
    expect(bundle.datasets.categories).toEqual(categories);
    expect(validateFinanceImportPackage(bundle)).toEqual([]);
    expect(JSON.stringify(bundle.datasets)).toBe(before);
  });

  it("blocks duplicate IDs, broken references and review_required records", () => {
    const bundle = parseFinanceImportZip(archive({
      categories: [{ external_id: "cat-1", name: "A", kind: "income" }, { external_id: "cat-1", name: "B", kind: "income" }],
      lease_contracts: [{ external_id: "lease-1", property_external_id: "missing", review_required: true }],
    }));
    const codes = validateFinanceImportPackage(bundle).map((issue) => issue.code);
    expect(codes).toContain("DUPLICATE_EXTERNAL_ID");
    expect(codes).toContain("BROKEN_REFERENCE");
    expect(codes).toContain("REVIEW_REQUIRED");
  });

  it("derives stable family-scoped UUIDs from the exact external_id", () => {
    const first = deterministicImportUuid("family-a", "categories", "CAT-Á-001");
    expect(first).toBe(deterministicImportUuid("family-a", "categories", "CAT-Á-001"));
    expect(first).not.toBe(deterministicImportUuid("family-b", "categories", "CAT-Á-001"));
    expect(first).not.toBe(deterministicImportUuid("family-a", "categories", "cat-á-001"));
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("rejects archives missing an official dataset", () => {
    const files: Record<string, Uint8Array> = {
      "manifest.json": strToU8("{}"),
      "import_review.json": strToU8(JSON.stringify({ status: "ready_for_commit", items: [] })),
    };
    expect(() => parseFinanceImportZip(zipSync(files))).toThrow(/Arquivos obrigatórios ausentes/);
  });
});
