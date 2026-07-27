import type { Json, TablesInsert } from "@/lib/supabase/database.types";
import {
  deterministicImportUuid,
  externalIdOf,
  importSourceKey,
  monthDate,
  numberField,
  textField,
  type FinanceImportPackage,
  type ImportRecord,
} from "@/lib/finance/importer";

export type ImportPerson = { id: string; first_name: string; last_name: string };

export type FinanceImportPlan = {
  categories: TablesInsert<"financial_categories">[];
  properties: TablesInsert<"properties">[];
  cards: TablesInsert<"credit_cards">[];
  units: TablesInsert<"property_units">[];
  leases: TablesInsert<"lease_contracts">[];
  assets: TablesInsert<"investment_assets">[];
  positions: TablesInsert<"investment_positions">[];
  recurrences: TablesInsert<"recurrences">[];
  installments: TablesInsert<"installment_purchases">[];
  invoices: TablesInsert<"card_invoices">[];
  entries: TablesInsert<"financial_entries">[];
  idsByDataset: Record<string, string[]>;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
}

function resolvePerson(source: unknown, people: ImportPerson[]) {
  if (typeof source !== "string" || !source.trim()) return null;
  const candidates = source.split("/").map(normalize).filter((value) => value && value !== "casal");
  for (const candidate of candidates) {
    const matches = people.filter((person) => {
      const full = normalize(`${person.first_name} ${person.last_name}`);
      return full === candidate || normalize(person.first_name) === candidate;
    });
    if (matches.length === 1) return matches[0].id;
  }
  return null;
}

function addMonths(month: string, offset: number) {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + offset, 1));
  return date.toISOString().slice(0, 10);
}

function endOfMonth(month: string) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
}

function centsProduct(value: number, count: number) {
  return (Math.round(value * 100) * count) / 100;
}

function sourceMetadata(dataset: string, externalId: string, extra: Record<string, Json | undefined> = {}): Json {
  return { import_source: "HERO.FamilyOS", import_version: 1, dataset, external_id: externalId, ...extra };
}

function entryBase(
  familyId: string,
  userId: string,
  dataset: string,
  row: ImportRecord
): TablesInsert<"financial_entries"> {
  const externalId = externalIdOf(row);
  return {
    id: deterministicImportUuid(familyId, dataset, externalId),
    family_id: familyId,
    created_by: userId,
    updated_by: userId,
    description: textField(row, "description", externalId),
    competence: monthDate(row.competence),
    entry_type: "expense",
    cash_direction: "outflow",
    expected_amount: numberField(row, "planned_amount", numberField(row, "amount")),
    origin: "import",
    source_key: importSourceKey(dataset, externalId),
    metadata: sourceMetadata(dataset, externalId),
  };
}

export function buildFinanceImportPlan(
  bundle: FinanceImportPackage,
  familyId: string,
  userId: string,
  people: ImportPerson[]
): FinanceImportPlan {
  const id = (dataset: string, externalId: string) => deterministicImportUuid(familyId, dataset, externalId);
  const idsByDataset: Record<string, string[]> = {};
  const remember = (dataset: string, rows: Array<{ id?: string }>) => {
    idsByDataset[dataset] = rows.map((row) => row.id).filter((value): value is string => Boolean(value));
  };

  const categories = bundle.datasets.categories.map((row): TablesInsert<"financial_categories"> => {
    const externalId = externalIdOf(row);
    return { id: id("categories", externalId), family_id: familyId, created_by: userId, updated_by: userId, name: textField(row, "name"), category_type: textField(row, "kind") };
  });
  const categoryIds = new Map(bundle.datasets.categories.map((row) => [externalIdOf(row), id("categories", externalIdOf(row))]));

  const properties = bundle.datasets.properties.map((row): TablesInsert<"properties"> => {
    const externalId = externalIdOf(row);
    const sourceStatus = textField(row, "status", "active");
    const status = sourceStatus === "active" ? "active" : sourceStatus === "vacant" ? "pending" : "inactive";
    return {
      id: id("properties", externalId), family_id: familyId, created_by: userId, updated_by: userId,
      title: textField(row, "name"), address: textField(row, "address"), registry_number: textField(row, "registry_number") || null,
      municipal_registration: textField(row, "property_tax_registration_1") || null, status,
      metadata: sourceMetadata("properties", externalId, {
        source_status: sourceStatus, economic_owner: textField(row, "economic_owner"), registry_office: textField(row, "registry_office"),
        property_tax_registration_2: textField(row, "property_tax_registration_2") || undefined, notes: textField(row, "notes") || undefined,
        sold_at: textField(row, "sold_at") || undefined,
      }),
    };
  });
  const propertyIds = new Map(bundle.datasets.properties.map((row) => [externalIdOf(row), id("properties", externalIdOf(row))]));

  const cards = bundle.datasets.credit_cards.map((row): TablesInsert<"credit_cards"> => {
    const externalId = externalIdOf(row);
    return {
      id: id("credit_cards", externalId), family_id: familyId, created_by: userId, updated_by: userId,
      name: textField(row, "name"), institution: textField(row, "issuer"), last_four: textField(row, "last4") || null,
      active: textField(row, "status") === "active", metadata: sourceMetadata("credit_cards", externalId),
    };
  });
  const cardIds = new Map(bundle.datasets.credit_cards.map((row) => [externalIdOf(row), id("credit_cards", externalIdOf(row))]));

  const unitSource = new Map<string, { propertyExternalId: string; name: string; status: string }>();
  for (const lease of bundle.datasets.lease_contracts) {
    const propertyExternalId = textField(lease, "property_external_id");
    const name = textField(lease, "unit");
    if (propertyExternalId && name) unitSource.set(`${propertyExternalId}\0${name}`, { propertyExternalId, name, status: textField(lease, "status") });
  }
  const units = Array.from(unitSource.values()).map((unit): TablesInsert<"property_units"> => {
    const externalId = `${unit.propertyExternalId}:${unit.name}`;
    const status = unit.status === "active" ? "active" : unit.status === "vacant" ? "vacant" : unit.status === "ended" ? "closed" : "inactive";
    return { id: id("property_units", externalId), family_id: familyId, created_by: userId, updated_by: userId, property_id: propertyIds.get(unit.propertyExternalId)!, code: unit.name, name: unit.name, status };
  });
  const unitIds = new Map(Array.from(unitSource.values()).map((unit) => [`${unit.propertyExternalId}\0${unit.name}`, id("property_units", `${unit.propertyExternalId}:${unit.name}`)]));

  const rentByLease = new Map<string, string[]>();
  for (const row of bundle.datasets.rental_income) {
    const lease = textField(row, "lease_external_id");
    const competence = textField(row, "competence");
    if (lease && competence) rentByLease.set(lease, [...(rentByLease.get(lease) ?? []), competence].sort());
  }
  const leases = bundle.datasets.lease_contracts.map((row): TablesInsert<"lease_contracts"> => {
    const externalId = externalIdOf(row);
    const propertyExternalId = textField(row, "property_external_id");
    const unitName = textField(row, "unit");
    const sourceStatus = textField(row, "status");
    const status = sourceStatus === "ended" ? "closed" : sourceStatus;
    const firstCompetence = rentByLease.get(externalId)?.[0] ?? bundle.manifest.competence;
    const tenant = textField(row, "tenant_name");
    const notes = [textField(row, "notes"), tenant ? `Locatário na fonte: ${tenant}` : "", `external_id: ${externalId}`].filter(Boolean).join("\n");
    return {
      id: id("lease_contracts", externalId), family_id: familyId, created_by: userId, updated_by: userId,
      property_id: propertyIds.get(propertyExternalId)!, unit_id: unitIds.get(`${propertyExternalId}\0${unitName}`) ?? null,
      principal_owner_person_id: resolvePerson(row.tax_owner, people), base_rent: numberField(row, "base_monthly_amount"),
      start_date: monthDate(firstCompetence), status, notes,
    };
  });
  const leaseIds = new Map(bundle.datasets.lease_contracts.map((row) => [externalIdOf(row), id("lease_contracts", externalIdOf(row))]));

  const assets = bundle.datasets.investment_assets.map((row): TablesInsert<"investment_assets"> => {
    const externalId = externalIdOf(row);
    const sourceType = textField(row, "asset_type");
    return {
      id: id("investment_assets", externalId), family_id: familyId, created_by: userId, updated_by: userId,
      name: textField(row, "name"), institution: textField(row, "institution", "Não informada"),
      asset_type: sourceType === "currency" ? "foreign_currency" : sourceType, currency: textField(row, "currency", "BRL"),
    };
  });
  const assetIds = new Map(bundle.datasets.investment_assets.map((row) => [externalIdOf(row), id("investment_assets", externalIdOf(row))]));
  const positions = bundle.datasets.investment_positions.map((row): TablesInsert<"investment_positions"> => {
    const externalId = externalIdOf(row);
    return { id: id("investment_positions", externalId), family_id: familyId, created_by: userId, updated_by: userId, asset_id: assetIds.get(textField(row, "asset_external_id"))!, position_date: textField(row, "as_of_date"), market_value: numberField(row, "amount_brl") };
  });

  const recurrences = bundle.datasets.recurring_expenses.map((row): TablesInsert<"recurrences"> => {
    const externalId = externalIdOf(row);
    return {
      id: id("recurring_expenses", externalId), family_id: familyId, created_by: userId, updated_by: userId,
      description: textField(row, "description"), expected_amount: numberField(row, "amount"), frequency: textField(row, "frequency"),
      start_date: monthDate(row.start_competence), next_occurrence: monthDate(row.start_competence), entry_type: "expense",
      card_id: cardIds.get(textField(row, "card_external_id")) ?? null, category_id: categoryIds.get(textField(row, "category_external_id")) ?? null,
      active: textField(row, "status") === "active", rule: sourceMetadata("recurring_expenses", externalId, { variable: row.variable === true }),
    };
  });

  const installments = bundle.datasets.installment_purchases.map((row): TablesInsert<"installment_purchases"> => {
    const externalId = externalIdOf(row);
    const installmentAmount = numberField(row, "installment_amount");
    const count = numberField(row, "total_installments");
    const current = numberField(row, "current_installment", 1);
    const imported = textField(row, "first_imported_competence");
    return {
      id: id("installment_purchases", externalId), family_id: familyId, created_by: userId, updated_by: userId,
      card_id: cardIds.get(textField(row, "card_external_id")) ?? null, description: textField(row, "description"),
      total_amount: centsProduct(installmentAmount, count), installment_count: count,
      first_competence: addMonths(imported, -(current - 1)), status: textField(row, "status"),
    };
  });
  const installmentIds = new Map(bundle.datasets.installment_purchases.map((row) => [externalIdOf(row), id("installment_purchases", externalIdOf(row))]));

  const invoices = bundle.datasets.card_invoices.map((row): TablesInsert<"card_invoices"> => {
    const externalId = externalIdOf(row);
    const competence = textField(row, "competence");
    return {
      id: id("card_invoices", externalId), family_id: familyId, created_by: userId, updated_by: userId,
      card_id: cardIds.get(textField(row, "card_external_id"))!, competence: monthDate(competence), due_date: endOfMonth(competence),
      expected_amount: numberField(row, "planned_amount"), closed_amount: typeof row.closed_amount === "number" ? row.closed_amount : null,
      status: textField(row, "status"), notes: `external_id: ${externalId}`,
    };
  });
  const invoiceIds = new Map(bundle.datasets.card_invoices.map((row) => [textField(row, "card_external_id"), id("card_invoices", externalIdOf(row))]));

  const entries: TablesInsert<"financial_entries">[] = [];
  for (const row of bundle.datasets.rental_income) {
    const base = entryBase(familyId, userId, "rental_income", row);
    const leaseExternalId = textField(row, "lease_external_id");
    entries.push({ ...base, entry_type: "income", cash_direction: "inflow", expected_amount: numberField(row, "planned_amount"), actual_amount: typeof row.actual_amount === "number" ? row.actual_amount : null, status: textField(row, "status") === "realized" ? "received" : "planned", lease_contract_id: leaseIds.get(leaseExternalId), property_id: propertyIds.get(textField(bundle.datasets.lease_contracts.find((lease) => externalIdOf(lease) === leaseExternalId) ?? {}, "property_external_id")) });
  }
  for (const row of bundle.datasets.rental_charges) {
    const base = entryBase(familyId, userId, "rental_charges", row);
    entries.push({ ...base, entry_type: "expense", cash_direction: "outflow", expected_amount: numberField(row, "amount"), status: "payable", property_id: propertyIds.get(textField(row, "property_external_id")), description: textField(row, "type") + (textField(row, "unit") ? ` · ${textField(row, "unit")}` : "") });
  }
  for (const row of bundle.datasets.card_purchases) {
    const base = entryBase(familyId, userId, "card_purchases", row);
    const cardExternalId = textField(row, "card_external_id");
    entries.push({ ...base, expected_amount: numberField(row, "amount"), status: "payable", purchase_kind: "one_off", card_id: cardIds.get(cardExternalId), card_invoice_id: invoiceIds.get(cardExternalId) });
  }
  for (const row of bundle.datasets.financial_entries) {
    const base = entryBase(familyId, userId, "financial_entries", row);
    const income = textField(row, "kind") === "income";
    entries.push({ ...base, entry_type: income ? "income" : "expense", cash_direction: income ? "inflow" : "outflow", actual_amount: typeof row.actual_amount === "number" ? row.actual_amount : null, status: textField(row, "status") === "realized" ? (income ? "received" : "paid") : "planned", category_id: categoryIds.get(textField(row, "category_external_id")) });
  }
  for (const row of bundle.datasets.recurring_expenses) {
    const externalId = externalIdOf(row);
    const competence = textField(row, "start_competence");
    entries.push({
      id: id("recurring_entries", `${externalId}:${competence}`), family_id: familyId, created_by: userId, updated_by: userId,
      description: textField(row, "description"), competence: monthDate(competence), entry_type: "expense", cash_direction: "outflow",
      expected_amount: numberField(row, "amount"), status: "payable", origin: "recurrence", purchase_kind: "recurring",
      recurrence_id: id("recurring_expenses", externalId), card_id: cardIds.get(textField(row, "card_external_id")),
      category_id: categoryIds.get(textField(row, "category_external_id")), source_key: importSourceKey("recurring_entries", `${externalId}:${competence}`),
      metadata: sourceMetadata("recurring_entries", externalId),
    });
  }
  for (const row of bundle.datasets.installment_purchases) {
    const externalId = externalIdOf(row);
    const current = numberField(row, "current_installment", 1);
    const count = numberField(row, "total_installments");
    const imported = textField(row, "first_imported_competence");
    for (let number = current; number <= count; number += 1) {
      const occurrenceId = `${externalId}:${number}`;
      entries.push({
        id: id("installment_entries", occurrenceId), family_id: familyId, created_by: userId, updated_by: userId,
        description: textField(row, "description"), competence: addMonths(imported, number - current), entry_type: "expense", cash_direction: "outflow",
        expected_amount: numberField(row, "installment_amount"), status: "payable", origin: "installment", purchase_kind: "installment",
        installment_purchase_id: installmentIds.get(externalId), installment_number: number, installment_count: count,
        card_id: cardIds.get(textField(row, "card_external_id")), source_key: importSourceKey("installment_entries", occurrenceId),
        metadata: sourceMetadata("installment_entries", externalId),
      });
    }
  }

  remember("categories", categories); remember("properties", properties); remember("credit_cards", cards); remember("property_units", units);
  remember("lease_contracts", leases); remember("investment_assets", assets); remember("investment_positions", positions);
  remember("recurring_expenses", recurrences); remember("installment_purchases", installments); remember("card_invoices", invoices);
  idsByDataset.financial_operations = entries.map((row) => row.id!);
  return { categories, properties, cards, units, leases, assets, positions, recurrences, installments, invoices, entries, idsByDataset };
}
