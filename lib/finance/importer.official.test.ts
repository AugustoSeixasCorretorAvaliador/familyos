import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFinanceImportZip, partitionSafeFinanceImport, validateFinanceImportPackage } from "@/lib/finance/importer";
import { buildFinanceImportPlan } from "@/lib/finance/import-plan";

const officialZip = process.env.FAMILYOS_IMPORT_ZIP;

describe.skipIf(!officialZip)("official finance import attachment", () => {
  it("parses every JSON and reports the official blockers before commit", () => {
    const bundle = parseFinanceImportZip(new Uint8Array(readFileSync(officialZip!)));
    const issues = validateFinanceImportPackage(bundle);
    const codes = new Set(issues.map((issue) => issue.code));
    expect(bundle.manifest.competence).toBe("2026-08");
    expect(codes).not.toContain("BROKEN_REFERENCE");
    expect(codes).not.toContain("DUPLICATE_EXTERNAL_ID");
    for (const expected of [
      "UNKNOWN_INVESTMENT_215K",
      "C6_UNNAMED_PURCHASES",
      "CHECKMARK_WITHOUT_AMOUNT",
      "LT469_TER_STATUS_CONFLICT",
      "SR38_REAL_SERIES_AMBIGUOUS",
      "AMERICO_SOLD_WITH_INCOME",
      "MARTE_PROPERTY_MISSING",
      "OWNER_SHARES_NOT_PERCENTUAL",
      "REVIEW_REQUIRED",
    ]) expect(codes).toContain(expected);
    expect(issues.filter((issue) => issue.code === "REVIEW_REQUIRED").map((issue) => issue.externalId).sort()).toEqual([
      "charge-marte-iptu-2026-08",
      "inv-unidentified-215k",
      "pos-unidentified-215k-2026-08",
    ]);

    const plan = buildFinanceImportPlan(bundle, "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", []);
    const allIds = Object.values(plan.idsByDataset).flat();
    expect(plan.entries).toHaveLength(236);
    expect(allIds).toHaveLength(338);
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(plan.entries.find((entry) => entry.source_key === "familyos-import:v1:financial_entries:income-inss-aug")).toMatchObject({
      expected_amount: 5313,
      actual_amount: 5313,
    });
    expect(plan.positions.find((position) => position.id === plan.idsByDataset.investment_positions[0])).toMatchObject({ market_value: 70000 });

    const { safeBundle, quarantined } = partitionSafeFinanceImport(bundle);
    expect(quarantined.map((item) => `${item.dataset}/${item.externalId}`).sort()).toEqual([
      "investment_assets/inv-unidentified-215k",
      "investment_positions/pos-unidentified-215k-2026-08",
      "rental_charges/charge-marte-iptu-2026-08",
    ]);
    expect(Object.values(safeBundle.datasets).flat()).toHaveLength(187);
    const safePlan = buildFinanceImportPlan(safeBundle, "00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002", []);
    expect(Object.values(safePlan.idsByDataset).flat()).toHaveLength(335);
    expect(safePlan.assets.some((asset) => asset.name === "Investimento não identificado")).toBe(false);
    expect(safePlan.entries.some((entry) => entry.source_key === "familyos-import:v1:rental_charges:charge-marte-iptu-2026-08")).toBe(false);
  });
});
