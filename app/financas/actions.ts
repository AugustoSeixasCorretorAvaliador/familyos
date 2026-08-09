"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { reportActionError } from "@/lib/action-error";
import { canAdminFamily, canEditFamily, getFamilyContext } from "@/lib/family/context";
import { findCardCategoryId } from "@/lib/finance/card-category";
import { generateMonthlyOccurrences, splitInstallments } from "@/lib/finance/domain";
import { dayBeforeCompetence, recurrenceActivationPatch } from "@/lib/finance/recurrence";
import { assertNoClientFamilyId, CATEGORY_TYPES, competenceValue, dateValue, ENTRY_STATUSES, ENTRY_TYPES, FinanceValidationError, integerValue, moneyValue, oneOf, optionalId, textValue, validatePercentage } from "@/lib/finance/validation";
import { createClient } from "@/lib/supabase/server";
import type { FinancialEntryInsert } from "@/lib/finance/types";

type Context = Awaited<ReturnType<typeof getFamilyContext>> & { user: NonNullable<Awaited<ReturnType<typeof getFamilyContext>>["user"]>; family: NonNullable<Awaited<ReturnType<typeof getFamilyContext>>["family"]> };

async function requireEditor(): Promise<Context> {
  const context = await getFamilyContext();
  if (!context.user) redirect("/login");
  if (!context.family) redirect("/dashboard?setup=required");
  if (!canEditFamily(context)) redirect("/financas?error=permission_denied");
  return context as Context;
}

type RedirectValues = Record<string, string | undefined>;

function financeUrl(view: string, values: RedirectValues = {}) {
  const params = new URLSearchParams({ view });
  for (const [key, value] of Object.entries(values)) if (value) params.set(key, value);
  return `/financas?${params.toString()}`;
}

function preserveSelectedCompetence(values: RedirectValues) {
  if (values.competence) return values;
  const referer = headers().get("referer");
  if (!referer) return values;
  try {
    const competence = new URL(referer).searchParams.get("competence")?.slice(0, 7);
    return competence ? { ...values, competence } : values;
  } catch {
    return values;
  }
}

function feedback(view: string, success: string, values: RedirectValues = {}) {
  revalidatePath("/financas");
  revalidatePath("/dashboard");
  redirect(financeUrl(view, preserveSelectedCompetence({ ...values, success })));
}

function actionFailure(error: unknown, context: Context, action: string, view: string, values: RedirectValues = {}) {
  if (error instanceof FinanceValidationError) redirect(financeUrl(view, preserveSelectedCompetence({ ...values, error: error.code })));
  const result = reportActionError({ error, userId: context.user.id, familyId: context.family.id, module: "financas", action, fallback: "unknown" });
  redirect(financeUrl(view, preserveSelectedCompetence({ ...values, error: result.code, request_id: result.requestId })));
}

async function installmentCategories(familyId: string, cardId: string | null, selectedCategoryId: string | null) {
  if (!cardId) return { categoryId: selectedCategoryId, classificationCategoryId: null };
  const db = createClient();
  const [{ data: card, error: cardError }, { data: categories, error: categoriesError }] = await Promise.all([
    db.from("credit_cards").select("name").eq("id", cardId).eq("family_id", familyId).is("deleted_at", null).maybeSingle(),
    db.from("financial_categories").select("id,name").eq("family_id", familyId).eq("active", true).is("deleted_at", null),
  ]);
  if (cardError || !card) throw cardError ?? new FinanceValidationError("not_found");
  if (categoriesError) throw categoriesError;
  const cardCategoryId = findCardCategoryId(card.name, categories ?? []);
  if (!cardCategoryId) return { categoryId: selectedCategoryId, classificationCategoryId: null };
  return {
    categoryId: cardCategoryId,
    classificationCategoryId: selectedCategoryId && selectedCategoryId !== cardCategoryId ? selectedCategoryId : null,
  };
}

export async function createAccount(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData);
    const db = createClient();
    const { error } = await db.from("accounts").insert({
      family_id: context.family.id, created_by: context.user.id,
      institution: textValue(formData.get("institution"), true)!, account_type: textValue(formData.get("account_type"), true)!,
      account_identifier: textValue(formData.get("account_identifier")), owner_person_id: optionalId(formData, "owner_person_id"),
      opening_balance: moneyValue(formData.get("opening_balance")) ?? 0, opening_balance_date: dateValue(formData.get("opening_balance_date")),
      currency: "BRL", status: "active", metadata: {},
    });
    if (error) throw error;
  } catch (error) { actionFailure(error, context, "create_account", "accounts"); }
  feedback("accounts", "created");
}

export async function updateAccount(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData);
    const id = textValue(formData.get("id"), true)!;
    const { data, error } = await createClient().from("accounts").update({
      institution: textValue(formData.get("institution"), true)!, account_type: textValue(formData.get("account_type"), true)!,
      account_identifier: textValue(formData.get("account_identifier")), owner_person_id: optionalId(formData, "owner_person_id"),
      opening_balance: moneyValue(formData.get("opening_balance")) ?? 0, opening_balance_date: dateValue(formData.get("opening_balance_date")), updated_by: context.user.id,
    }).eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).select("id").maybeSingle();
    if (error || !data) throw error ?? new Error("not_found");
  } catch (error) { actionFailure(error, context, "update_account", "accounts"); }
  feedback("accounts", "updated");
}

export async function createCategory(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData);
    const { error } = await createClient().from("financial_categories").insert({ family_id: context.family.id, created_by: context.user.id,
      name: textValue(formData.get("name"), true)!, category_type: oneOf(formData.get("category_type"), CATEGORY_TYPES), parent_id: optionalId(formData, "parent_id"),
      color: textValue(formData.get("color")), icon: textValue(formData.get("icon")), active: true });
    if (error) throw error;
  } catch (error) { actionFailure(error, context, "create_category", "categories"); }
  feedback("categories", "created");
}

export async function updateCategory(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData); const id = textValue(formData.get("id"), true)!;
    const { data, error } = await createClient().from("financial_categories").update({ name: textValue(formData.get("name"), true)!, category_type: oneOf(formData.get("category_type"), CATEGORY_TYPES), parent_id: optionalId(formData, "parent_id"), color: textValue(formData.get("color")), icon: textValue(formData.get("icon")), updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).select("id").maybeSingle();
    if (error || !data) throw error ?? new Error("not_found");
  } catch (error) { actionFailure(error, context, "update_category", "categories"); }
  feedback("categories", "updated");
}

export async function createCard(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData);
    const { error } = await createClient().from("credit_cards").insert({ family_id: context.family.id, created_by: context.user.id,
      name: textValue(formData.get("name"), true)!, institution: textValue(formData.get("institution"), true)!, brand: textValue(formData.get("brand")),
      last_four: textValue(formData.get("last_four")), credit_limit: moneyValue(formData.get("credit_limit")),
      closing_day: integerValue(formData.get("closing_day"), { min: 1, max: 31 }), due_day: integerValue(formData.get("due_day"), { min: 1, max: 31 }),
      best_purchase_day: integerValue(formData.get("best_purchase_day"), { min: 1, max: 31 }), payment_account_id: optionalId(formData, "payment_account_id") });
    if (error) throw error;
  } catch (error) { actionFailure(error, context, "create_card", "cards"); }
  feedback("cards", "created");
}

export async function updateCard(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData); const id = textValue(formData.get("id"), true)!;
    const { data, error } = await createClient().from("credit_cards").update({ name: textValue(formData.get("name"), true)!, institution: textValue(formData.get("institution"), true)!, brand: textValue(formData.get("brand")), last_four: textValue(formData.get("last_four")), credit_limit: moneyValue(formData.get("credit_limit")), closing_day: integerValue(formData.get("closing_day"), { min: 1, max: 31 }), due_day: integerValue(formData.get("due_day"), { min: 1, max: 31 }), best_purchase_day: integerValue(formData.get("best_purchase_day"), { min: 1, max: 31 }), payment_account_id: optionalId(formData, "payment_account_id"), updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).select("id").maybeSingle();
    if (error || !data) throw error ?? new Error("not_found");
  } catch (error) { actionFailure(error, context, "update_card", "cards"); }
  feedback("cards", "updated");
}

function entryFromForm(formData: FormData, context: Context): FinancialEntryInsert {
  assertNoClientFamilyId(formData);
  const entryType = oneOf(formData.get("entry_type"), ENTRY_TYPES);
  const actualAmount = moneyValue(formData.get("actual_amount"));
  const status = oneOf(formData.get("status") ?? (actualAmount === null ? "planned" : entryType === "income" ? "received" : "paid"), ENTRY_STATUSES);
  const direction = entryType === "income" || entryType === "investment_redemption" || entryType === "investment_yield" ? "inflow" : entryType === "transfer" || entryType === "adjustment" || entryType === "reversal" ? "none" : "outflow";
  return {
    family_id: context.family.id, created_by: context.user.id, description: textValue(formData.get("description"), true)!,
    competence: competenceValue(formData.get("competence")), entry_type: entryType, cash_direction: direction,
    expected_amount: moneyValue(formData.get("expected_amount"), true)!, actual_amount: actualAmount,
    expected_date: dateValue(formData.get("expected_date")), due_date: dateValue(formData.get("due_date")), effective_date: dateValue(formData.get("effective_date")),
    status, category_id: optionalId(formData, "category_id"), classification_category_id: optionalId(formData, "classification_category_id"), account_id: optionalId(formData, "account_id"), card_id: optionalId(formData, "card_id"),
    responsible_person_id: optionalId(formData, "responsible_person_id"), property_id: optionalId(formData, "property_id"), property_unit_id: optionalId(formData, "property_unit_id"),
    lease_contract_id: optionalId(formData, "lease_contract_id"), investment_asset_id: optionalId(formData, "investment_asset_id"), notes: textValue(formData.get("notes")), origin: "manual",
  };
}

export async function createEntry(formData: FormData) {
  const context = await requireEditor();
  const returnValues = { competence: textValue(formData.get("competence"))?.slice(0, 7) };
  try { const { error } = await createClient().from("financial_entries").insert(entryFromForm(formData, context)); if (error) throw error; }
  catch (error) { actionFailure(error, context, "create_entry", "movements", returnValues); }
  feedback("movements", "created", returnValues);
}

function addCompetenceMonths(competence: string, months: number) {
  const date = new Date(`${competence}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 7) + "-01";
}

function dateForDay(competence: string, day: number | null) {
  if (!day) return null;
  const [year, month] = competence.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${competence.slice(0, 7)}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

export async function createMonthlyProjection(formData: FormData) {
  const context = await requireEditor();
  const returnValues = { competence: textValue(formData.get("competence"))?.slice(0, 7) };
  try {
    assertNoClientFamilyId(formData);
    const entryType = oneOf(formData.get("entry_type"), ["income", "expense"] as const);
    const competence = competenceValue(formData.get("competence"));
    const expectedAmount = moneyValue(formData.get("expected_amount"), true)!;
    const monthsAhead = integerValue(formData.get("months_ahead") ?? "12", { min: 0, max: 24, required: true })!;
    const description = textValue(formData.get("description"), true)!;
    const seriesId = crypto.randomUUID();
    const db = createClient();
    const categoryId = optionalId(formData, "category_id");
    const classificationCategoryId = optionalId(formData, "classification_category_id");
    const accountId = optionalId(formData, "account_id");
    const propertyId = optionalId(formData, "property_id");
    const responsiblePersonId = optionalId(formData, "responsible_person_id");
    const { data: recurrence, error: recurrenceError } = await db.from("recurrences").insert({
      family_id: context.family.id,
      created_by: context.user.id,
      description,
      entry_type: entryType,
      expected_amount: expectedAmount,
      frequency: "monthly",
      interval_value: 1,
      day_of_month: 1,
      start_date: competence,
      next_occurrence: addCompetenceMonths(competence, monthsAhead + 1),
      category_id: categoryId,
      account_id: accountId,
      responsible_person_id: responsiblePersonId,
      rule: { projection_series_id: seriesId, classification_category_id: classificationCategoryId, property_id: propertyId },
      active: true,
    }).select("id").single();
    if (recurrenceError) throw recurrenceError;
    const rows: FinancialEntryInsert[] = Array.from({ length: monthsAhead + 1 }, (_, index) => {
      const month = addCompetenceMonths(competence, index);
      return {
        family_id: context.family.id,
        created_by: context.user.id,
        description,
        competence: month,
        entry_type: entryType,
        cash_direction: entryType === "income" ? "inflow" : "outflow",
        expected_amount: expectedAmount,
        status: entryType === "income" ? "receivable" : "payable",
        category_id: categoryId,
        classification_category_id: classificationCategoryId,
        account_id: accountId,
        property_id: propertyId,
        responsible_person_id: responsiblePersonId,
        origin: "manual",
        purchase_kind: "recurring",
        recurrence_id: recurrence.id,
        source_key: `monthly-plan:${seriesId}:${month}`,
        metadata: { projection_series_id: seriesId, projection_source_competence: competence, projected: index > 0 },
      };
    });
    const { error } = await db.from("financial_entries").insert(rows);
    if (error) throw error;
  } catch (error) { actionFailure(error, context, "create_monthly_projection", "overview", returnValues); }
  feedback("overview", "projection_created", returnValues);
}

export async function saveCardBalance(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData);
    const cardId = textValue(formData.get("card_id"), true)!;
    const competence = competenceValue(formData.get("competence"));
    const expectedAmount = moneyValue(formData.get("expected_amount"), true)!;
    const db = createClient();
    const { data: card, error: cardError } = await db.from("credit_cards").select("id,name,due_day").eq("id", cardId).eq("family_id", context.family.id).is("deleted_at", null).maybeSingle();
    if (cardError || !card) throw cardError ?? new Error("not_found");

    const months = Array.from({ length: 13 }, (_, index) => addCompetenceMonths(competence, index));
    const sourceKeys = months.map((month) => `card-balance:${card.id}:${month}`);
    const { data: existing, error: existingError } = await db.from("financial_entries").select("source_key").eq("family_id", context.family.id).in("source_key", sourceKeys).is("deleted_at", null);
    if (existingError) throw existingError;
    const existingKeys = new Set((existing ?? []).map((entry) => entry.source_key));
    const missing: FinancialEntryInsert[] = months.filter((month) => !existingKeys.has(`card-balance:${card.id}:${month}`)).map((month) => ({
      family_id: context.family.id,
      created_by: context.user.id,
      description: `Fatura consolidada · ${card.name}`,
      competence: month,
      entry_type: "expense",
      cash_direction: "outflow",
      expected_amount: expectedAmount,
      expected_date: dateForDay(month, card.due_day),
      due_date: dateForDay(month, card.due_day),
      status: "payable",
      card_id: card.id,
      origin: "manual",
      purchase_kind: "recurring",
      source_key: `card-balance:${card.id}:${month}`,
      metadata: { consolidated_card_balance: true, projection_source_competence: competence, projected: month !== competence },
    }));
    if (missing.length) {
      const { error } = await db.from("financial_entries").insert(missing);
      if (error) throw error;
    }
    const { error: updateError } = await db.from("financial_entries").update({ expected_amount: expectedAmount, description: `Fatura consolidada · ${card.name}`, updated_by: context.user.id }).eq("family_id", context.family.id).eq("source_key", `card-balance:${card.id}:${competence}`).is("deleted_at", null);
    if (updateError) throw updateError;
  } catch (error) { actionFailure(error, context, "save_card_balance", "cards"); }
  feedback("cards", "balance_saved");
}

export async function updateEntry(formData: FormData) {
  const context = await requireEditor();
  const returnView = formData.get("return_view") === "overview" ? "overview" : "movements";
  const returnValues = {
    competence: textValue(formData.get("return_competence"))?.slice(0, 7),
    income_order: textValue(formData.get("income_order")) ?? undefined,
    expense_order: textValue(formData.get("expense_order")) ?? undefined,
  };
  try {
    const id = textValue(formData.get("id"), true)!;
    const payload = entryFromForm(formData, context);
    const db = createClient();
    const { data: existing, error: readError } = await db.from("financial_entries")
      .select("id,competence,source_key,installment_purchase_id,recurrence_id,metadata")
      .eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).maybeSingle();
    if (readError || !existing) throw readError ?? new Error("not_found");
    const { data, error } = await db.from("financial_entries").update({ ...payload, family_id: undefined, created_by: undefined, updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).select("id").maybeSingle();
    if (error || !data) throw error ?? new Error("not_found");

    const sharedFuturePayload = {
      entry_type: payload.entry_type,
      cash_direction: payload.cash_direction,
      expected_amount: payload.expected_amount,
      category_id: payload.category_id,
      classification_category_id: payload.classification_category_id,
      account_id: payload.account_id,
      card_id: payload.card_id,
      responsible_person_id: payload.responsible_person_id,
      property_id: payload.property_id,
      property_unit_id: payload.property_unit_id,
      lease_contract_id: payload.lease_contract_id,
      investment_asset_id: payload.investment_asset_id,
      notes: payload.notes,
      updated_by: context.user.id,
    };
    const projectionSeriesId = typeof existing.metadata === "object" && existing.metadata && !Array.isArray(existing.metadata)
      ? String(existing.metadata.projection_series_id ?? "")
      : "";

    if (projectionSeriesId) {
      const { error: futureError } = await db.from("financial_entries")
        .update({ ...sharedFuturePayload, description: payload.description })
        .eq("family_id", context.family.id)
        .gt("competence", existing.competence)
        .contains("metadata", { projection_series_id: projectionSeriesId })
        .is("actual_amount", null)
        .is("deleted_at", null);
      if (futureError) throw futureError;
    } else if (existing.installment_purchase_id) {
      const { error: futureError } = await db.from("financial_entries")
        .update(sharedFuturePayload)
        .eq("family_id", context.family.id)
        .eq("installment_purchase_id", existing.installment_purchase_id)
        .gt("competence", existing.competence)
        .is("actual_amount", null)
        .is("deleted_at", null);
      if (futureError) throw futureError;
    } else if (existing.recurrence_id) {
      const { error: futureError } = await db.from("financial_entries")
        .update({ ...sharedFuturePayload, description: payload.description })
        .eq("family_id", context.family.id)
        .eq("recurrence_id", existing.recurrence_id)
        .gt("competence", existing.competence)
        .is("actual_amount", null)
        .is("deleted_at", null);
      if (futureError) throw futureError;
    }

    if (existing.recurrence_id) {
      const { data: recurrence, error: recurrenceReadError } = await db.from("recurrences").select("rule")
        .eq("id", existing.recurrence_id).eq("family_id", context.family.id).is("deleted_at", null).maybeSingle();
      if (recurrenceReadError || !recurrence) throw recurrenceReadError ?? new Error("not_found");
      const recurrenceRule = typeof recurrence.rule === "object" && recurrence.rule && !Array.isArray(recurrence.rule)
        ? recurrence.rule as Record<string, unknown>
        : {};
      const { error: recurrenceError } = await db.from("recurrences").update({
        description: payload.description,
        entry_type: payload.entry_type,
        expected_amount: payload.expected_amount,
        category_id: payload.category_id,
        account_id: payload.account_id,
        card_id: payload.card_id,
        responsible_person_id: payload.responsible_person_id,
        rule: {
          ...recurrenceRule,
          classification_category_id: payload.classification_category_id,
          property_id: payload.property_id,
          property_unit_id: payload.property_unit_id,
          lease_contract_id: payload.lease_contract_id,
          investment_asset_id: payload.investment_asset_id,
          notes: payload.notes,
        },
        updated_by: context.user.id,
      }).eq("id", existing.recurrence_id).eq("family_id", context.family.id).is("deleted_at", null);
      if (recurrenceError) throw recurrenceError;
    }
  } catch (error) { actionFailure(error, context, "update_entry", returnView, returnValues); }
  feedback(returnView, "updated", returnValues);
}

export async function toggleEntrySettlement(formData: FormData) {
  const context = await requireEditor();
  const competence = textValue(formData.get("competence"))?.slice(0, 7);
  const returnValues = {
    competence,
    income_order: textValue(formData.get("income_order")) ?? undefined,
    expense_order: textValue(formData.get("expense_order")) ?? undefined,
  };
  try {
    assertNoClientFamilyId(formData);
    const id = textValue(formData.get("id"), true)!;
    const settled = formData.get("settled") === "true";
    const db = createClient();
    const { data: entry, error: readError } = await db.from("financial_entries")
      .select("id,entry_type,expected_amount")
      .eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).maybeSingle();
    if (readError || !entry) throw readError ?? new Error("not_found");
    if (!["income", "investment_yield", "expense"].includes(entry.entry_type)) throw new FinanceValidationError("invalid_entry_type");
    const isIncome = entry.entry_type === "income" || entry.entry_type === "investment_yield";
    const { data, error } = await db.from("financial_entries").update({
      actual_amount: settled ? entry.expected_amount : null,
      effective_date: settled ? new Date().toISOString().slice(0, 10) : null,
      status: settled ? (isIncome ? "received" : "paid") : (isIncome ? "receivable" : "payable"),
      updated_by: context.user.id,
    }).eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).select("id").maybeSingle();
    if (error || !data) throw error ?? new Error("not_found");
  } catch (error) { actionFailure(error, context, "toggle_entry_settlement", "overview", returnValues); }
  feedback("overview", "settlement_updated", returnValues);
}

export async function toggleCardSettlement(formData: FormData) {
  const context = await requireEditor();
  const competence = textValue(formData.get("competence"))?.slice(0, 7);
  const returnValues = {
    competence,
    income_order: textValue(formData.get("income_order")) ?? undefined,
    expense_order: textValue(formData.get("expense_order")) ?? undefined,
  };
  try {
    assertNoClientFamilyId(formData);
    const cardId = textValue(formData.get("card_id"), true)!;
    const month = competenceValue(formData.get("competence"));
    const settled = formData.get("settled") === "true";
    const db = createClient();
    const [{ data: entries, error: readError }, { data: invoice, error: invoiceError }, { data: card, error: cardError }] = await Promise.all([
      db.from("financial_entries").select("id,expected_amount,source_key").eq("family_id", context.family.id).eq("card_id", cardId).eq("competence", month).eq("entry_type", "expense").is("deleted_at", null).neq("status", "cancelled"),
      db.from("card_invoices").select("id,closed_amount,expected_amount,closing_date,payment_account_id,status").eq("family_id", context.family.id).eq("card_id", cardId).eq("competence", month).is("deleted_at", null).maybeSingle(),
      db.from("credit_cards").select("payment_account_id").eq("family_id", context.family.id).eq("id", cardId).is("deleted_at", null).maybeSingle(),
    ]);
    if (readError || invoiceError || cardError) throw readError ?? invoiceError ?? cardError;
    const paymentAccountId = invoice?.payment_account_id ?? card?.payment_account_id ?? null;
    if (settled && invoice && !paymentAccountId) throw new FinanceValidationError("payment_account_required");
    const individualEntries = (entries ?? []).filter((entry) => !entry.source_key?.startsWith("card-balance:"));
    const effectiveDate = settled ? new Date().toISOString().slice(0, 10) : null;
    // Limita a concorrência para cartões com muitos lançamentos e evita repetir
    // a tempestade de requisições que anteriormente causava timeout em Finanças.
    for (let index = 0; index < individualEntries.length; index += 8) {
      const updates = await Promise.all(individualEntries.slice(index, index + 8).map((entry) => db.from("financial_entries").update({
        actual_amount: settled ? entry.expected_amount : null,
        effective_date: effectiveDate,
        status: settled ? "paid" : "payable",
        updated_by: context.user.id,
      }).eq("id", entry.id).eq("family_id", context.family.id).is("deleted_at", null)));
      const failed = updates.find((result) => result.error);
      if (failed?.error) throw failed.error;
    }
    if (invoice) {
      const sourceKey = `invoice-payment:${invoice.id}`;
      const { data: payment, error: paymentReadError } = await db.from("financial_entries").select("id").eq("family_id", context.family.id).eq("source_key", sourceKey).is("deleted_at", null).maybeSingle();
      if (paymentReadError) throw paymentReadError;
      const amount = invoice.closed_amount ?? invoice.expected_amount;
      if (settled) {
        const paymentValues = { description: "Pagamento de fatura", competence: month, entry_type: "transfer" as const, cash_direction: "outflow" as const, expected_amount: amount, actual_amount: amount, effective_date: effectiveDate, status: "paid" as const, origin: "system" as const, account_id: paymentAccountId, card_id: cardId, card_invoice_id: invoice.id, updated_by: context.user.id };
        const paymentResult = payment
          ? await db.from("financial_entries").update(paymentValues).eq("id", payment.id).eq("family_id", context.family.id)
          : await db.from("financial_entries").insert({ ...paymentValues, family_id: context.family.id, created_by: context.user.id, source_key: sourceKey });
        if (paymentResult.error) throw paymentResult.error;
        const { error: updateInvoiceError } = await db.from("card_invoices").update({ status: "paid", paid_amount: amount, payment_date: effectiveDate, payment_account_id: paymentAccountId, updated_by: context.user.id }).eq("id", invoice.id).eq("family_id", context.family.id);
        if (updateInvoiceError) throw updateInvoiceError;
      } else {
        if (payment) {
          const { error: paymentError } = await db.from("financial_entries").update({ actual_amount: null, effective_date: null, status: "planned", updated_by: context.user.id }).eq("id", payment.id).eq("family_id", context.family.id);
          if (paymentError) throw paymentError;
        }
        const { error: updateInvoiceError } = await db.from("card_invoices").update({ status: invoice.closing_date ? "closed" : "open", paid_amount: null, payment_date: null, updated_by: context.user.id }).eq("id", invoice.id).eq("family_id", context.family.id);
        if (updateInvoiceError) throw updateInvoiceError;
      }
    }
  } catch (error) { actionFailure(error, context, "toggle_card_settlement", "overview", returnValues); }
  feedback("overview", "card_settlement_updated", returnValues);
}

export async function markEntryPaid(formData: FormData) {
  const context = await requireEditor();
  const returnValues = { competence: textValue(formData.get("return_competence"))?.slice(0, 7) };
  try {
    assertNoClientFamilyId(formData); const id = textValue(formData.get("id"), true)!; const actual = moneyValue(formData.get("actual_amount"), true)!; const effective = dateValue(formData.get("effective_date"), true)!;
    const db = createClient(); const { data: entry, error: readError } = await db.from("financial_entries").select("entry_type").eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).maybeSingle();
    if (readError || !entry) throw readError ?? new Error("not_found");
    const status = ["income", "investment_redemption", "investment_yield"].includes(entry.entry_type) ? "received" : "paid";
    const { error } = await db.from("financial_entries").update({ actual_amount: actual, effective_date: effective, status, updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id); if (error) throw error;
  } catch (error) { actionFailure(error, context, "mark_entry_paid", "movements", returnValues); }
  feedback("movements", "paid", returnValues);
}

export async function undoEntryPayment(formData: FormData) {
  const context = await requireEditor();
  const returnValues = { competence: textValue(formData.get("return_competence"))?.slice(0, 7) };
  try { assertNoClientFamilyId(formData); const id = textValue(formData.get("id"), true)!; const { error } = await createClient().from("financial_entries").update({ actual_amount: null, effective_date: null, status: "planned", updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id).is("deleted_at", null); if (error) throw error; }
  catch (error) { actionFailure(error, context, "undo_payment", "movements", returnValues); }
  feedback("movements", "payment_undone", returnValues);
}

export async function createTransfer(formData: FormData) {
  const context = await requireEditor();
  const returnValues = { competence: textValue(formData.get("competence"))?.slice(0, 7) };
  try {
    assertNoClientFamilyId(formData); const from = optionalId(formData, "from_account_id"); const to = optionalId(formData, "to_account_id"); if (!from || !to || from === to) throw new FinanceValidationError("invalid_transfer");
    const amount = moneyValue(formData.get("amount"), true)!; const competence = competenceValue(formData.get("competence")); const date = dateValue(formData.get("effective_date"), true)!; const group = crypto.randomUUID(); const description = textValue(formData.get("description")) ?? "Transferência entre contas";
    const common = { family_id: context.family.id, created_by: context.user.id, description, competence, entry_type: "transfer", expected_amount: amount, actual_amount: amount, effective_date: date, expected_date: date, status: "paid", origin: "manual", transfer_group_id: group } as const;
    const { error } = await createClient().from("financial_entries").insert([{ ...common, account_id: from, cash_direction: "outflow", source_key: `transfer:${group}:out` }, { ...common, account_id: to, cash_direction: "inflow", source_key: `transfer:${group}:in` }]); if (error) throw error;
  } catch (error) { actionFailure(error, context, "create_transfer", "movements", returnValues); }
  feedback("movements", "transfer_created", returnValues);
}

export async function createRecurrence(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData); const { error } = await createClient().from("recurrences").insert({ family_id: context.family.id, created_by: context.user.id,
      description: textValue(formData.get("description"), true)!, entry_type: oneOf(formData.get("entry_type"), ENTRY_TYPES), expected_amount: moneyValue(formData.get("expected_amount"), true)!,
      frequency: textValue(formData.get("frequency"), true)!, interval_value: integerValue(formData.get("interval_value"), { min: 1, max: 120 }) ?? 1,
      day_of_month: integerValue(formData.get("day_of_month"), { min: 1, max: 31 }), start_date: dateValue(formData.get("start_date"), true)!, end_date: dateValue(formData.get("end_date")), next_occurrence: dateValue(formData.get("start_date"), true)!,
      category_id: optionalId(formData, "category_id"), account_id: optionalId(formData, "account_id"), card_id: optionalId(formData, "card_id"), responsible_person_id: optionalId(formData, "responsible_person_id"),
      rule: { classification_category_id: optionalId(formData, "classification_category_id") },
    }); if (error) throw error;
  } catch (error) { actionFailure(error, context, "create_recurrence", "recurrences"); }
  feedback("recurrences", "created");
}

export async function toggleRecurrence(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData);
    const id = textValue(formData.get("id"), true)!;
    const active = textValue(formData.get("active"), true) === "true";
    const db = createClient();
    if (!active) {
      const { error } = await db.from("recurrences").update({ active: false, updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id).is("deleted_at", null);
      if (error) throw error;
    } else {
      const fromCompetence = competenceValue(formData.get("from_competence"));
      const { data: recurrence, error: recurrenceError } = await db.from("recurrences")
        .select("id,start_date,active,end_date,next_occurrence")
        .eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).maybeSingle();
      if (recurrenceError || !recurrence) throw recurrenceError ?? new FinanceValidationError("not_found");

      const { data: activeEntries, error: activeEntriesError } = await db.from("financial_entries")
        .select("competence")
        .eq("family_id", context.family.id).eq("recurrence_id", id)
        .gte("competence", fromCompetence).is("deleted_at", null);
      if (activeEntriesError) throw activeEntriesError;
      const activeMonths = new Set((activeEntries ?? []).map((entry) => entry.competence));

      const { data: archivedEntries, error: archivedEntriesError } = await db.from("financial_entries")
        .select("id,competence")
        .eq("family_id", context.family.id).eq("recurrence_id", id)
        .gte("competence", fromCompetence).not("deleted_at", "is", null).is("actual_amount", null);
      if (archivedEntriesError) throw archivedEntriesError;
      const restoreIds = (archivedEntries ?? []).filter((entry) => !activeMonths.has(entry.competence)).map((entry) => entry.id);

      const { error: activationError } = await db.from("recurrences")
        .update({ ...recurrenceActivationPatch(true, recurrence.start_date), updated_by: context.user.id })
        .eq("id", id).eq("family_id", context.family.id).is("deleted_at", null);
      if (activationError) throw activationError;

      if (restoreIds.length) {
        const { error: restoreError } = await db.from("financial_entries")
          .update({ deleted_at: null, updated_by: context.user.id })
          .in("id", restoreIds).eq("family_id", context.family.id);
        if (restoreError) {
          await db.from("recurrences").update({
            active: recurrence.active,
            end_date: recurrence.end_date,
            next_occurrence: recurrence.next_occurrence,
            updated_by: context.user.id,
          }).eq("id", id).eq("family_id", context.family.id).is("deleted_at", null);
          throw restoreError;
        }
      }
    }
  }
  catch (error) { actionFailure(error, context, "toggle_recurrence", "recurrences"); }
  feedback("recurrences", "updated");
}

export async function updateRecurrence(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData); const id = textValue(formData.get("id"), true)!;
    const db = createClient();
    const { data: existing, error: readError } = await db.from("recurrences").select("rule").eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).maybeSingle();
    if (readError || !existing) throw readError ?? new Error("not_found");
    const existingRule = typeof existing.rule === "object" && existing.rule && !Array.isArray(existing.rule) ? existing.rule : {};
    const { data, error } = await db.from("recurrences").update({ description: textValue(formData.get("description"), true)!, entry_type: oneOf(formData.get("entry_type"), ENTRY_TYPES), expected_amount: moneyValue(formData.get("expected_amount"), true)!, frequency: textValue(formData.get("frequency"), true)!, interval_value: integerValue(formData.get("interval_value"), { min: 1, max: 120 }) ?? 1, day_of_month: integerValue(formData.get("day_of_month"), { min: 1, max: 31 }), start_date: dateValue(formData.get("start_date"), true)!, end_date: dateValue(formData.get("end_date")), next_occurrence: dateValue(formData.get("next_occurrence")), category_id: optionalId(formData, "category_id"), account_id: optionalId(formData, "account_id"), card_id: optionalId(formData, "card_id"), responsible_person_id: optionalId(formData, "responsible_person_id"), rule: { ...existingRule, classification_category_id: optionalId(formData, "classification_category_id") }, updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).select("id").maybeSingle();
    if (error || !data) throw error ?? new Error("not_found");
  } catch (error) { actionFailure(error, context, "update_recurrence", "recurrences"); }
  feedback("recurrences", "updated");
}

export async function endRecurrence(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData);
    const id = textValue(formData.get("id"), true)!;
    const fromCompetence = competenceValue(formData.get("from_competence"));
    const db = createClient();
    const { data: recurrence, error: recurrenceError } = await db.from("recurrences")
      .select("id,active,end_date,next_occurrence")
      .eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).maybeSingle();
    if (recurrenceError || !recurrence) throw recurrenceError ?? new FinanceValidationError("not_found");

    const { data: realized, error: realizedError } = await db.from("financial_entries")
      .select("id")
      .eq("family_id", context.family.id)
      .eq("recurrence_id", id)
      .gte("competence", fromCompetence)
      .is("deleted_at", null)
      .not("actual_amount", "is", null)
      .limit(1);
    if (realizedError) throw realizedError;
    if (realized?.length) throw new FinanceValidationError("recurrence_has_realized_future");

    const endDate = dayBeforeCompetence(fromCompetence);
    const now = new Date().toISOString();
    const { data: ended, error: endError } = await db.from("recurrences")
      .update({ active: false, end_date: endDate, next_occurrence: null, updated_by: context.user.id })
      .eq("id", id).eq("family_id", context.family.id).is("deleted_at", null)
      .select("id").maybeSingle();
    if (endError || !ended) throw endError ?? new FinanceValidationError("not_found");

    const { error: archiveError } = await db.from("financial_entries")
      .update({ deleted_at: now, updated_by: context.user.id })
      .eq("family_id", context.family.id)
      .eq("recurrence_id", id)
      .gte("competence", fromCompetence)
      .is("deleted_at", null)
      .is("actual_amount", null);
    if (archiveError) {
      await db.from("recurrences").update({
        active: recurrence.active,
        end_date: recurrence.end_date,
        next_occurrence: recurrence.next_occurrence,
        updated_by: context.user.id,
      }).eq("id", id).eq("family_id", context.family.id).is("deleted_at", null);
      throw archiveError;
    }
  } catch (error) { actionFailure(error, context, "end_recurrence", "recurrences"); }
  feedback("recurrences", "ended");
}

export async function generateRecurrenceOccurrences(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData); const id = textValue(formData.get("id"), true)!; const count = integerValue(formData.get("count"), { min: 1, max: 60, required: true })!; const db = createClient();
    const { data: rule, error } = await db.from("recurrences").select("*").eq("id", id).eq("family_id", context.family.id).eq("active", true).is("deleted_at", null).maybeSingle(); if (error || !rule) throw error ?? new Error("not_found");
    if (rule.frequency !== "monthly" || !rule.next_occurrence || !rule.entry_type || rule.expected_amount === null) throw new FinanceValidationError("invalid_recurrence");
    const occurrences = generateMonthlyOccurrences({ recurrenceId: rule.id, startDate: rule.next_occurrence, count, endDate: rule.end_date, intervalMonths: rule.interval_value });
    const extras = typeof rule.rule === "object" && rule.rule && !Array.isArray(rule.rule) ? rule.rule as Record<string, unknown> : {};
    const rows: FinancialEntryInsert[] = occurrences.map((occurrence) => ({ family_id: context.family.id, created_by: context.user.id, description: rule.description ?? "Lançamento recorrente", competence: `${occurrence.date.slice(0, 7)}-01`, entry_type: rule.entry_type!, cash_direction: ["income", "investment_redemption", "investment_yield"].includes(rule.entry_type!) ? "inflow" : "outflow", expected_amount: rule.expected_amount!, expected_date: occurrence.date, due_date: occurrence.date, status: rule.entry_type === "income" ? "receivable" : "payable", origin: "recurrence", purchase_kind: "recurring", recurrence_id: rule.id, category_id: rule.category_id, classification_category_id: typeof extras.classification_category_id === "string" ? extras.classification_category_id : null, account_id: rule.account_id, card_id: rule.card_id, responsible_person_id: rule.responsible_person_id, source_key: occurrence.sourceKey }));
    if (rows.length) { const { error: insertError } = await db.from("financial_entries").upsert(rows, { onConflict: "family_id,source_key", ignoreDuplicates: true }); if (insertError) throw insertError; }
    const next = generateMonthlyOccurrences({ recurrenceId: rule.id, startDate: rule.next_occurrence, count: count + 1, endDate: rule.end_date, intervalMonths: rule.interval_value }).at(-1)?.date ?? null;
    const { error: updateError } = await db.from("recurrences").update({ next_occurrence: next, active: Boolean(next), updated_by: context.user.id }).eq("id", rule.id).eq("family_id", context.family.id); if (updateError) throw updateError;
  } catch (error) { actionFailure(error, context, "generate_recurrence", "recurrences"); }
  feedback("recurrences", "generated");
}

export async function createInstallmentPurchase(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData); const total = moneyValue(formData.get("total_amount"), true)!; const count = integerValue(formData.get("installment_count"), { min: 1, max: 360, required: true })!; const first = competenceValue(formData.get("first_competence")); const description = textValue(formData.get("description"), true)!;
    const cardId = optionalId(formData, "card_id"); const selectedCategoryId = optionalId(formData, "category_id");
    const { categoryId, classificationCategoryId } = await installmentCategories(context.family.id, cardId, selectedCategoryId);
    const db = createClient(); const { data: purchase, error } = await db.from("installment_purchases").insert({ family_id: context.family.id, created_by: context.user.id, description, total_amount: total, installment_count: count, first_competence: first, purchase_date: dateValue(formData.get("purchase_date")), card_id: cardId, category_id: categoryId, responsible_person_id: optionalId(formData, "responsible_person_id") }).select("id").single(); if (error) throw error;
    const cents = splitInstallments(Math.round(total * 100), count); const start = new Date(`${first}T00:00:00Z`);
    const rows: FinancialEntryInsert[] = cents.map((value, index) => { const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1)).toISOString().slice(0, 10); return { family_id: context.family.id, created_by: context.user.id, description: `${description} (${index + 1}/${count})`, competence: date, entry_type: "expense", cash_direction: "none", expected_amount: value / 100, status: "planned", origin: "installment", purchase_kind: "installment", installment_purchase_id: purchase.id, installment_number: index + 1, installment_count: count, card_id: cardId, category_id: categoryId, classification_category_id: classificationCategoryId, source_key: `installment:${purchase.id}:${index + 1}` }; });
    const { error: entriesError } = await db.from("financial_entries").insert(rows);
    if (entriesError) {
      await db.from("installment_purchases").update({ deleted_at: new Date().toISOString(), status: "cancelled", updated_by: context.user.id }).eq("id", purchase.id).eq("family_id", context.family.id);
      throw entriesError;
    }
  } catch (error) { actionFailure(error, context, "create_installment", "installments"); }
  feedback("installments", "created");
}

export async function updateInstallmentPurchase(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData);
    const id = textValue(formData.get("id"), true)!;
    const total = moneyValue(formData.get("total_amount"), true)!;
    const count = integerValue(formData.get("installment_count"), { min: 1, max: 360, required: true })!;
    const first = competenceValue(formData.get("first_competence"));
    const description = textValue(formData.get("description"), true)!;
    const purchaseDate = dateValue(formData.get("purchase_date"));
    const cardId = optionalId(formData, "card_id");
    const selectedCategoryId = optionalId(formData, "category_id");
    const { categoryId, classificationCategoryId } = await installmentCategories(context.family.id, cardId, selectedCategoryId);
    const responsiblePersonId = optionalId(formData, "responsible_person_id");
    const db = createClient();
    const { data: purchase, error: purchaseReadError } = await db.from("installment_purchases")
      .select("id,status").eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).maybeSingle();
    if (purchaseReadError || !purchase) throw purchaseReadError ?? new FinanceValidationError("not_found");
    if (purchase.status !== "active") throw new FinanceValidationError("installment_locked");

    const { data: existing, error: entriesReadError } = await db.from("financial_entries")
      .select("id,installment_number,actual_amount,card_invoice_id,status")
      .eq("family_id", context.family.id).eq("installment_purchase_id", id).is("deleted_at", null)
      .order("installment_number", { ascending: true });
    if (entriesReadError) throw entriesReadError;
    if ((existing ?? []).some((entry) => entry.actual_amount !== null || entry.card_invoice_id !== null || ["paid", "received", "reversed"].includes(entry.status))) {
      throw new FinanceValidationError("installment_locked");
    }

    const cents = splitInstallments(Math.round(total * 100), count);
    const start = new Date(`${first}T00:00:00Z`);
    const rows: FinancialEntryInsert[] = cents.map((value, index) => {
      const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1)).toISOString().slice(0, 10);
      return {
        id: existing?.[index]?.id ?? randomUUID(), family_id: context.family.id, created_by: context.user.id, updated_by: context.user.id,
        description: `${description} (${index + 1}/${count})`, competence: date, entry_type: "expense", cash_direction: "none",
        expected_amount: value / 100, actual_amount: null, status: "planned", origin: "installment", purchase_kind: "installment",
        installment_purchase_id: id, installment_number: index + 1, installment_count: count,
        card_id: cardId, category_id: categoryId, classification_category_id: classificationCategoryId, responsible_person_id: responsiblePersonId,
        source_key: `installment:${id}:${index + 1}`,
      };
    });
    const { error: upsertError } = await db.from("financial_entries").upsert(rows, { onConflict: "id" });
    if (upsertError) throw upsertError;

    const excessIds = (existing ?? []).slice(count).map((entry) => entry.id);
    if (excessIds.length) {
      const { error: archiveError } = await db.from("financial_entries").update({ deleted_at: new Date().toISOString(), updated_by: context.user.id })
        .eq("family_id", context.family.id).in("id", excessIds);
      if (archiveError) throw archiveError;
    }

    const { data: updated, error: updateError } = await db.from("installment_purchases").update({
      description, total_amount: total, installment_count: count, first_competence: first, purchase_date: purchaseDate,
      card_id: cardId, category_id: categoryId, responsible_person_id: responsiblePersonId, updated_by: context.user.id,
    }).eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).select("id").maybeSingle();
    if (updateError || !updated) throw updateError ?? new FinanceValidationError("not_found");
  } catch (error) { actionFailure(error, context, "update_installment", "installments"); }
  feedback("installments", "updated");
}

export async function archiveInstallmentPurchase(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData);
    const id = textValue(formData.get("id"), true)!;
    const now = new Date().toISOString();
    const db = createClient();
    const { data: purchase, error: readError } = await db.from("installment_purchases")
      .select("id").eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).maybeSingle();
    if (readError || !purchase) throw readError ?? new FinanceValidationError("not_found");
    const { error: entriesError } = await db.from("financial_entries").update({ deleted_at: now, updated_by: context.user.id })
      .eq("family_id", context.family.id).eq("installment_purchase_id", id).is("deleted_at", null);
    if (entriesError) throw entriesError;
    const { error: purchaseError } = await db.from("installment_purchases").update({ deleted_at: now, status: "cancelled", updated_by: context.user.id })
      .eq("id", id).eq("family_id", context.family.id).is("deleted_at", null);
    if (purchaseError) throw purchaseError;
  } catch (error) { actionFailure(error, context, "archive_installment", "installments"); }
  feedback("installments", "archived");
}

export async function cancelFutureInstallments(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData); const id = textValue(formData.get("id"), true)!; const from = competenceValue(formData.get("from_competence")); const db = createClient();
    const { error } = await db.from("financial_entries").update({ status: "cancelled", updated_by: context.user.id }).eq("family_id", context.family.id).eq("installment_purchase_id", id).gte("competence", from).is("actual_amount", null).is("deleted_at", null); if (error) throw error;
    const { error: purchaseError } = await db.from("installment_purchases").update({ status: "cancelled", updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id); if (purchaseError) throw purchaseError;
  } catch (error) { actionFailure(error, context, "cancel_installments", "installments"); }
  feedback("installments", "cancelled");
}

export async function createInvoice(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData); const cardId = textValue(formData.get("card_id"), true)!; const competence = competenceValue(formData.get("competence")); const dueDate = dateValue(formData.get("due_date"), true)!; const db = createClient();
    const { data: rows, error } = await db.from("financial_entries").select("expected_amount,entry_type").eq("family_id", context.family.id).eq("card_id", cardId).eq("competence", competence).is("deleted_at", null).neq("status", "cancelled"); if (error) throw error;
    const expected = (rows ?? []).reduce((sum, row) => row.entry_type === "expense" ? sum + row.expected_amount : row.entry_type === "reversal" ? sum - row.expected_amount : sum, 0);
    const { data: invoice, error: invoiceError } = await db.from("card_invoices").upsert({ family_id: context.family.id, created_by: context.user.id, card_id: cardId, competence, due_date: dueDate, expected_amount: Math.max(0, expected), status: "open" }, { onConflict: "family_id,card_id,competence" }).select("id").single(); if (invoiceError) throw invoiceError;
    const { error: linkError } = await db.from("financial_entries").update({ card_invoice_id: invoice.id, updated_by: context.user.id }).eq("family_id", context.family.id).eq("card_id", cardId).eq("competence", competence).is("card_invoice_id", null).is("deleted_at", null); if (linkError) throw linkError;
  } catch (error) { actionFailure(error, context, "create_invoice", "invoices"); }
  feedback("invoices", "created");
}

export async function closeInvoice(formData: FormData) {
  const context = await requireEditor();
  try { assertNoClientFamilyId(formData); const id = textValue(formData.get("id"), true)!; const amount = moneyValue(formData.get("closed_amount"), true)!; const { error } = await createClient().from("card_invoices").update({ status: "closed", closed_amount: amount, closing_date: dateValue(formData.get("closing_date"), true)!, updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id); if (error) throw error; }
  catch (error) { actionFailure(error, context, "close_invoice", "invoices"); }
  feedback("invoices", "closed");
}

export async function payInvoice(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData); const id = textValue(formData.get("id"), true)!; const db = createClient(); const { data: invoice, error } = await db.from("card_invoices").select("id,card_id,competence,closed_amount,expected_amount,payment_account_id,status,credit_cards(payment_account_id)").eq("id", id).eq("family_id", context.family.id).maybeSingle(); if (error || !invoice) throw error ?? new Error("not_found"); if (invoice.status === "paid") throw new FinanceValidationError("already_paid");
    const amount = moneyValue(formData.get("paid_amount")) ?? invoice.closed_amount ?? invoice.expected_amount; const account = optionalId(formData, "payment_account_id") ?? invoice.payment_account_id ?? invoice.credit_cards?.payment_account_id; if (!account) throw new FinanceValidationError("payment_account_required"); const date = dateValue(formData.get("payment_date"), true)!;
    const sourceKey = `invoice-payment:${invoice.id}`;
    const { data: existingPayment, error: paymentReadError } = await db.from("financial_entries").select("id").eq("family_id", context.family.id).eq("source_key", sourceKey).is("deleted_at", null).maybeSingle(); if (paymentReadError) throw paymentReadError;
    const paymentValues = { description: "Pagamento de fatura", competence: invoice.competence, entry_type: "transfer" as const, cash_direction: "outflow" as const, expected_amount: amount, actual_amount: amount, effective_date: date, status: "paid" as const, origin: "system" as const, account_id: account, card_id: invoice.card_id, card_invoice_id: invoice.id, updated_by: context.user.id };
    const paymentResult = existingPayment ? await db.from("financial_entries").update(paymentValues).eq("id", existingPayment.id).eq("family_id", context.family.id) : await db.from("financial_entries").insert({ ...paymentValues, family_id: context.family.id, created_by: context.user.id, source_key: sourceKey }); if (paymentResult.error) throw paymentResult.error;
    const { error: updateError } = await db.from("card_invoices").update({ status: "paid", paid_amount: amount, payment_date: date, payment_account_id: account, updated_by: context.user.id }).eq("id", invoice.id).eq("family_id", context.family.id); if (updateError) throw updateError;
    const { data: invoiceEntries, error: entriesReadError } = await db.from("financial_entries").select("id,expected_amount,source_key").eq("family_id", context.family.id).eq("card_id", invoice.card_id).eq("competence", invoice.competence).eq("entry_type", "expense").is("deleted_at", null).neq("status", "cancelled"); if (entriesReadError) throw entriesReadError;
    const payableEntries = (invoiceEntries ?? []).filter((entry) => !entry.source_key?.startsWith("card-balance:"));
    for (let index = 0; index < payableEntries.length; index += 8) {
      const updates = await Promise.all(payableEntries.slice(index, index + 8).map((entry) => db.from("financial_entries").update({ actual_amount: entry.expected_amount, effective_date: date, status: "paid", updated_by: context.user.id }).eq("id", entry.id).eq("family_id", context.family.id)));
      const failed = updates.find((result) => result.error); if (failed?.error) throw failed.error;
    }
  } catch (error) { actionFailure(error, context, "pay_invoice", "invoices"); }
  feedback("invoices", "paid");
}

export async function reverseInvoicePayment(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData); const id = textValue(formData.get("id"), true)!; const date = dateValue(formData.get("reversal_date"), true)!; const db = createClient();
    const { data: invoice, error } = await db.from("card_invoices").select("id,card_id,competence,closed_amount,expected_amount,status").eq("id", id).eq("family_id", context.family.id).maybeSingle();
    if (error || !invoice) throw error ?? new Error("not_found"); if (invoice.status !== "paid") throw new FinanceValidationError("invoice_not_paid");
    const { data: payment, error: paymentError } = await db.from("financial_entries").select("id,account_id,actual_amount,expected_amount").eq("family_id", context.family.id).eq("source_key", `invoice-payment:${id}`).is("deleted_at", null).maybeSingle();
    if (paymentError || !payment) throw paymentError ?? new Error("payment_not_found");
    const amount = payment.actual_amount ?? payment.expected_amount;
    const { error: reversalError } = await db.from("financial_entries").insert({ family_id: context.family.id, created_by: context.user.id, description: "Estorno de pagamento de fatura", competence: invoice.competence, entry_type: "transfer", cash_direction: "inflow", expected_amount: amount, actual_amount: amount, effective_date: date, status: "received", origin: "system", account_id: payment.account_id, card_id: invoice.card_id, card_invoice_id: invoice.id, reversal_of_entry_id: payment.id, source_key: `invoice-payment-reversal:${invoice.id}` });
    if (reversalError) throw reversalError;
    const { error: updateError } = await db.from("card_invoices").update({ status: "closed", paid_amount: null, payment_date: null, updated_by: context.user.id }).eq("id", invoice.id).eq("family_id", context.family.id); if (updateError) throw updateError;
    const { error: entriesError } = await db.from("financial_entries").update({ actual_amount: null, effective_date: null, status: "payable", updated_by: context.user.id }).eq("family_id", context.family.id).eq("card_id", invoice.card_id).eq("competence", invoice.competence).eq("entry_type", "expense").is("deleted_at", null).neq("status", "cancelled"); if (entriesError) throw entriesError;
  } catch (error) { actionFailure(error, context, "reverse_invoice_payment", "invoices"); }
  feedback("invoices", "reversed");
}

export async function createPropertyUnit(formData: FormData) {
  const context = await requireEditor();
  try { assertNoClientFamilyId(formData); const { error } = await createClient().from("property_units").insert({ family_id: context.family.id, created_by: context.user.id, property_id: textValue(formData.get("property_id"), true)!, name: textValue(formData.get("name"), true)!, code: textValue(formData.get("code"), true)!, unit_type: textValue(formData.get("unit_type")), notes: textValue(formData.get("notes")) }); if (error) throw error; }
  catch (error) { actionFailure(error, context, "create_unit", "properties"); }
  feedback("properties", "created");
}

export async function updateProperty(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData); const id = textValue(formData.get("id"), true)!;
    const { data, error } = await createClient().from("properties").update({ title: textValue(formData.get("title"), true)!, address: textValue(formData.get("address"), true)!, city: textValue(formData.get("city")), state: textValue(formData.get("state")), postal_code: textValue(formData.get("postal_code")), property_type: textValue(formData.get("property_type")), registry_number: textValue(formData.get("registry_number")), municipal_registration: textValue(formData.get("municipal_registration")), updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).select("id").maybeSingle();
    if (error || !data) throw error ?? new Error("not_found");
  } catch (error) { actionFailure(error, context, "update_property", "properties"); }
  feedback("properties", "updated");
}

export async function createLease(formData: FormData) {
  const context = await requireEditor();
  try { assertNoClientFamilyId(formData); const { error } = await createClient().from("lease_contracts").insert({ family_id: context.family.id, created_by: context.user.id, property_id: textValue(formData.get("property_id"), true)!, unit_id: optionalId(formData, "unit_id"), tenant_person_id: optionalId(formData, "tenant_person_id"), principal_owner_person_id: optionalId(formData, "principal_owner_person_id"), start_date: dateValue(formData.get("start_date"), true)!, end_date: dateValue(formData.get("end_date")), base_rent: moneyValue(formData.get("base_rent"), true)!, charges_amount: moneyValue(formData.get("charges_amount")) ?? 0, adjustment_index: textValue(formData.get("adjustment_index")), next_adjustment_date: dateValue(formData.get("next_adjustment_date")), status: "active" }); if (error) throw error; }
  catch (error) { actionFailure(error, context, "create_lease", "properties"); }
  feedback("properties", "created");
}

export async function createOwnerShare(formData: FormData) {
  const context = await requireEditor();
  try { assertNoClientFamilyId(formData); const shareType = textValue(formData.get("share_type"), true)!; const { error } = await createClient().from("lease_owner_shares").insert({ family_id: context.family.id, created_by: context.user.id, lease_contract_id: textValue(formData.get("lease_contract_id"), true)!, person_id: textValue(formData.get("person_id"), true)!, share_type: shareType, percentage: shareType === "percentage" ? validatePercentage(formData.get("percentage")) : null, fixed_amount: shareType === "fixed_amount" ? moneyValue(formData.get("fixed_amount"), true) : null, valid_from: dateValue(formData.get("valid_from"), true)!, valid_until: dateValue(formData.get("valid_until")), rule: {} }); if (error) throw error; }
  catch (error) { actionFailure(error, context, "create_share", "properties"); }
  feedback("properties", "created");
}

export async function createInvestmentAsset(formData: FormData) {
  const context = await requireEditor();
  try { assertNoClientFamilyId(formData); const { error } = await createClient().from("investment_assets").insert({ family_id: context.family.id, created_by: context.user.id, name: textValue(formData.get("name"), true)!, institution: textValue(formData.get("institution"), true)!, asset_type: textValue(formData.get("asset_type"), true)!, account_id: optionalId(formData, "account_id"), currency: "BRL" }); if (error) throw error; }
  catch (error) { actionFailure(error, context, "create_asset", "investments"); }
  feedback("investments", "created");
}

export async function updateInvestmentAsset(formData: FormData) {
  const context = await requireEditor();
  try {
    assertNoClientFamilyId(formData); const id = textValue(formData.get("id"), true)!;
    const { data, error } = await createClient().from("investment_assets").update({ name: textValue(formData.get("name"), true)!, institution: textValue(formData.get("institution"), true)!, asset_type: textValue(formData.get("asset_type"), true)!, account_id: optionalId(formData, "account_id"), updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).select("id").maybeSingle();
    if (error || !data) throw error ?? new Error("not_found");
  } catch (error) { actionFailure(error, context, "update_asset", "investments"); }
  feedback("investments", "updated");
}

export async function createInvestmentPosition(formData: FormData) {
  const context = await requireEditor();
  try { assertNoClientFamilyId(formData); const { error } = await createClient().from("investment_positions").upsert({ family_id: context.family.id, created_by: context.user.id, updated_by: context.user.id, asset_id: textValue(formData.get("asset_id"), true)!, position_date: dateValue(formData.get("position_date"), true)!, market_value: moneyValue(formData.get("market_value"), true)!, cost_amount: moneyValue(formData.get("cost_amount")), quantity: moneyValue(formData.get("quantity")), unit_price: moneyValue(formData.get("unit_price")) }, { onConflict: "asset_id,position_date" }); if (error) throw error; }
  catch (error) { actionFailure(error, context, "create_position", "investments"); }
  feedback("investments", "created");
}

export async function archiveFinanceRecord(formData: FormData) {
  const context = await requireEditor();
  if (!canAdminFamily(context)) redirect("/financas?error=permission_denied");
  const returnView = formData.get("return_view") === "movements" ? "movements" : "overview";
  const returnValues = {
    competence: textValue(formData.get("return_competence"))?.slice(0, 7),
    income_order: textValue(formData.get("income_order")) ?? undefined,
    expense_order: textValue(formData.get("expense_order")) ?? undefined,
  };
  try {
    assertNoClientFamilyId(formData); const id = textValue(formData.get("id"), true)!; const entity = textValue(formData.get("entity"), true)!; const now = new Date().toISOString(); const db = createClient(); let error: { message: string } | null = null;
    if (entity === "account") ({ error } = await db.from("accounts").update({ deleted_at: now, status: "archived", updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id));
    else if (entity === "category") ({ error } = await db.from("financial_categories").update({ deleted_at: now, active: false, updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id));
    else if (entity === "card") ({ error } = await db.from("credit_cards").update({ deleted_at: now, active: false, updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id));
    else if (entity === "entry") {
      const { data: entry, error: readError } = await db.from("financial_entries")
        .select("id")
        .eq("id", id).eq("family_id", context.family.id).is("deleted_at", null).maybeSingle();
      if (readError || !entry) throw readError ?? new Error("not_found");
      ({ error } = await db.from("financial_entries").update({ deleted_at: now, updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id));
    }
    else if (entity === "asset") ({ error } = await db.from("investment_assets").update({ deleted_at: now, active: false, updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id));
    else if (entity === "property") ({ error } = await db.from("properties").update({ deleted_at: now, status: "archived", updated_by: context.user.id }).eq("id", id).eq("family_id", context.family.id));
    else throw new FinanceValidationError("invalid_entity"); if (error) throw error;
  } catch (error) { actionFailure(error, context, "archive_record", returnView, returnValues); }
  feedback(returnView, "archived", returnValues);
}
