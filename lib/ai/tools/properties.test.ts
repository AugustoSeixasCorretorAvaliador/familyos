import { describe, expect, it } from "vitest";
import {
  buildPropertyExecutiveRecord,
  summarizePropertyPortfolio,
  type PropertyExecutiveInput,
} from "@/lib/ai/tools/properties";

function property(
  overrides: Partial<PropertyExecutiveInput> = {}
): PropertyExecutiveInput {
  return {
    id: "property-1",
    title: "Edifício Diamond",
    address: "Rua Exemplo, 100",
    city: "Niterói",
    state: "RJ",
    status: "active",
    metadata: { valor_estimado: 2_000_000, situacao: "Próprio" },
    owners: [
      {
        personId: "person-1",
        firstName: "Augusto",
        lastName: "Seixas",
        ownershipPercentage: 50,
      },
    ],
    ...overrides,
  };
}

describe("property executive calculations", () => {
  it("mantém separados valor integral e valor proporcional", () => {
    const record = buildPropertyExecutiveRecord(property());

    expect(record.fullEstimatedValue).toBe(2_000_000);
    expect(record.familyOwnershipPercentage).toBe(50);
    expect(record.familyProportionalValue).toBe(1_000_000);
  });

  it("subtrai somente dívida efetivamente cadastrada", () => {
    const record = buildPropertyExecutiveRecord(
      property({ outstandingDebt: 250_000 })
    );

    expect(record.outstandingDebt).toBe(250_000);
    expect(record.netFamilyEquity).toBe(750_000);
  });

  it("não transforma dívida ausente em zero", () => {
    const record = buildPropertyExecutiveRecord(property());

    expect(record.outstandingDebt).toBeNull();
    expect(record.netFamilyEquity).toBe(1_000_000);
    expect(record.warnings.join(" ")).toContain("não confirma inexistência");
  });

  it("mantém imóvel sem valor na lista e fora da soma", () => {
    const valued = buildPropertyExecutiveRecord(property());
    const unvalued = buildPropertyExecutiveRecord(
      property({
        id: "property-2",
        metadata: { valor_estimado: null },
      })
    );
    const summary = summarizePropertyPortfolio([valued, unvalued]);

    expect(summary.propertyCount).toBe(2);
    expect(summary.propertiesWithoutValue).toBe(1);
    expect(summary.totalGrossEstimatedValue).toBe(2_000_000);
    expect(summary.warnings.join(" ")).toContain("total é parcial");
  });

  it("não calcula participação com percentuais incompletos", () => {
    const record = buildPropertyExecutiveRecord(
      property({
        owners: [
          {
            personId: "person-1",
            firstName: "Augusto",
            lastName: "Seixas",
            ownershipPercentage: null,
          },
        ],
      })
    );

    expect(record.familyOwnershipPercentage).toBeNull();
    expect(record.familyProportionalValue).toBeNull();
  });
});
