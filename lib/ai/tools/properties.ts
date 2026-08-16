import { redactSensitiveText } from "@/lib/ai/tools/privacy";

export type PropertyExecutiveOwner = {
  personId: string;
  name: string;
  ownershipPercentage: number | null;
};

export type PropertyExecutiveRecord = {
  id: string;
  name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  status: string | null;
  owners: PropertyExecutiveOwner[];
  fullEstimatedValue: number | null;
  valuationDate: string | null;
  valuationSource: string | null;
  familyOwnershipPercentage: number | null;
  familyProportionalValue: number | null;
  outstandingDebt: number | null;
  netFamilyEquity: number | null;
  monthlyRent: number | null;
  occupancyStatus: string | null;
  warnings: string[];
};

export type PropertyPortfolioSummary = {
  propertyCount: number;
  propertiesWithValue: number;
  propertiesWithoutValue: number;
  totalGrossEstimatedValue: number | null;
  totalFamilyProportionalValue: number | null;
  totalOutstandingDebt: number | null;
  totalNetFamilyEquity: number | null;
  propertiesWithMonthlyRentEstimate: number;
  propertiesWithPositiveRentEstimate: number;
  propertiesWithoutMonthlyRentEstimate: number;
  rentalPropertyCount: number;
  residencePropertyCount: number;
  totalEstimatedMonthlyRent: number | null;
  currency: "BRL";
  warnings: string[];
};

export type PropertyExecutiveInput = {
  id: string;
  title: unknown;
  address: unknown;
  city: unknown;
  state: unknown;
  status: unknown;
  metadata: Record<string, unknown> | null;
  owners: Array<{
    personId: string;
    firstName: unknown;
    lastName: unknown;
    ownershipPercentage: unknown;
  }>;
  outstandingDebt?: unknown;
  valuationDate?: unknown;
  valuationSource?: unknown;
};

function finiteNumber(value: unknown, options?: { min?: number; max?: number }) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) return null;
  if (options?.min !== undefined && parsed < options.min) return null;
  if (options?.max !== undefined && parsed > options.max) return null;
  return parsed;
}

function sumKnown(values: Array<number | null>) {
  const known = values.filter((value): value is number => value !== null);
  return known.length > 0
    ? Number(known.reduce((sum, value) => sum + value, 0).toFixed(2))
    : null;
}

export function buildPropertyExecutiveRecord(
  input: PropertyExecutiveInput
): PropertyExecutiveRecord {
  const metadata = input.metadata ?? {};
  const warnings: string[] = [];
  const parsedEstimatedValue = finiteNumber(metadata.valor_estimado, { min: 0 });
  const fullEstimatedValue = parsedEstimatedValue !== null && parsedEstimatedValue > 0 ? parsedEstimatedValue : null;
  const monthlyRent = finiteNumber(metadata.renda_mensal, { min: 0 });
  const outstandingDebt = finiteNumber(input.outstandingDebt, { min: 0 });
  const owners = input.owners.map((owner) => {
    const firstName = redactSensitiveText(owner.firstName, 80) ?? "";
    const lastName = redactSensitiveText(owner.lastName, 80) ?? "";
    return {
      personId: owner.personId,
      name: `${firstName} ${lastName}`.trim() || "Nome não informado",
      ownershipPercentage: finiteNumber(owner.ownershipPercentage, {
        min: 0,
        max: 100,
      }),
    };
  });

  const ownerPercentages = owners.map((owner) => owner.ownershipPercentage);
  const hasCompleteOwnership =
    owners.length > 0 && ownerPercentages.every((percentage) => percentage !== null);
  const ownershipSum = hasCompleteOwnership
    ? sumKnown(ownerPercentages)
    : null;
  const familyOwnershipPercentage =
    ownershipSum !== null && ownershipSum <= 100 ? ownershipSum : null;

  if (fullEstimatedValue === null) {
    warnings.push("Valor estimado não cadastrado; imóvel excluído dos totais de valor.");
  }
  if (familyOwnershipPercentage === null) {
    warnings.push(
      owners.length === 0
        ? "Proprietários não cadastrados; participação familiar não calculada."
        : "Percentuais de propriedade incompletos ou inválidos; valor proporcional não calculado."
    );
  }
  if (ownershipSum !== null && ownershipSum > 100) {
    warnings.push("A soma dos percentuais de propriedade excede 100%.");
  }

  const familyProportionalValue =
    fullEstimatedValue !== null && familyOwnershipPercentage !== null
      ? Number(
          (
            fullEstimatedValue *
            (familyOwnershipPercentage / 100)
          ).toFixed(2)
        )
      : null;
  const netFamilyEquity =
    familyProportionalValue === null
      ? null
      : outstandingDebt === null
        ? familyProportionalValue
        : Number((familyProportionalValue - outstandingDebt).toFixed(2));

  if (familyProportionalValue !== null && outstandingDebt === null) {
    warnings.push(
      "Nenhuma dívida imobiliária está cadastrada; o patrimônio líquido coincide com o valor proporcional e não confirma inexistência de dívida."
    );
  }

  return {
    id: input.id,
    name: redactSensitiveText(input.title),
    address: redactSensitiveText(input.address),
    city: redactSensitiveText(input.city, 100),
    state: redactSensitiveText(input.state, 80),
    status: redactSensitiveText(input.status, 80),
    owners,
    fullEstimatedValue,
    valuationDate: redactSensitiveText(input.valuationDate, 20),
    valuationSource: redactSensitiveText(input.valuationSource, 160),
    familyOwnershipPercentage,
    familyProportionalValue,
    outstandingDebt,
    netFamilyEquity,
    monthlyRent,
    occupancyStatus: redactSensitiveText(metadata.situacao, 80),
    warnings,
  };
}

export function summarizePropertyPortfolio(
  properties: PropertyExecutiveRecord[]
): PropertyPortfolioSummary {
  const propertiesWithValue = properties.filter(
    (property) => property.fullEstimatedValue !== null
  ).length;
  const propertiesWithoutValue = properties.length - propertiesWithValue;
  const warnings: string[] = [];

  if (propertiesWithoutValue > 0) {
    warnings.push(
      `${propertiesWithoutValue} imóvel(is) sem valor informado foram excluídos do total bruto. O total é parcial.`
    );
  }
  const missingOwnership = properties.filter(
    (property) =>
      property.fullEstimatedValue !== null &&
      property.familyProportionalValue === null
  ).length;
  if (missingOwnership > 0) {
    warnings.push(
      `${missingOwnership} imóvel(is) com valor não entraram no total proporcional por falta de percentuais completos.`
    );
  }
  const knownMonthlyRents = properties
    .map((property) => property.monthlyRent)
    .filter((value): value is number => value !== null);
  const propertiesWithPositiveRentEstimate = knownMonthlyRents.filter((value) => value > 0).length;
  const propertiesWithoutMonthlyRentEstimate = properties.length - knownMonthlyRents.length;

  return {
    propertyCount: properties.length,
    propertiesWithValue,
    propertiesWithoutValue,
    totalGrossEstimatedValue: sumKnown(
      properties.map((property) => property.fullEstimatedValue)
    ),
    totalFamilyProportionalValue: sumKnown(
      properties.map((property) => property.familyProportionalValue)
    ),
    totalOutstandingDebt: sumKnown(
      properties.map((property) => property.outstandingDebt)
    ),
    totalNetFamilyEquity: sumKnown(
      properties.map((property) => property.netFamilyEquity)
    ),
    propertiesWithMonthlyRentEstimate: knownMonthlyRents.length,
    propertiesWithPositiveRentEstimate,
    propertiesWithoutMonthlyRentEstimate,
    rentalPropertyCount: propertiesWithPositiveRentEstimate,
    residencePropertyCount: properties.length - propertiesWithPositiveRentEstimate,
    totalEstimatedMonthlyRent: sumKnown(knownMonthlyRents),
    currency: "BRL",
    warnings,
  };
}
