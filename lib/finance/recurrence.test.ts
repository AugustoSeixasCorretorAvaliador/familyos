import { describe, expect, it } from "vitest";
import { addCompetenceMonths, dayBeforeCompetence, monthlyOccurrenceDates, recurrenceActivationPatch, recurrenceEntryPropagationPatch, recurrenceOccurrenceId, recurrenceRangesFromEntries, sortRecurrencesForEditing } from "@/lib/finance/recurrence";
import type { FinancialEntryRow } from "@/lib/finance/types";
import type { Recurrence } from "@/lib/finance/types";

describe("recorrências financeiras contínuas", () => {
  it("calcula o período pelos lançamentos recorrentes realmente ativos", () => {
    const entry = (competence: string, status = "payable", recurrenceId: string | null = "r1") => ({ competence, status, recurrence_id: recurrenceId, deleted_at: null }) as FinancialEntryRow;
    const ranges = recurrenceRangesFromEntries([
      entry("2027-12-01"),
      entry("2026-08-01"),
      entry("2028-01-01", "cancelled"),
      entry("2026-07-01", "payable", null),
    ]);
    expect(ranges.get("r1")).toEqual({ start: "2026-08-01", end: "2027-12-01" });
  });
  it("gera competências mensais até o horizonte consultado", () => {
    expect(monthlyOccurrenceDates({ startDate: "2026-08-01" }, "2026-11-01")).toEqual([
      "2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01",
    ]);
  });

  it("respeita encerramento, intervalo e último dia do mês", () => {
    expect(monthlyOccurrenceDates({ startDate: "2026-01-31", endDate: "2026-05-31", intervalMonths: 2, dayOfMonth: 31 }, "2026-12-01")).toEqual([
      "2026-01-31", "2026-03-31", "2026-05-31",
    ]);
  });

  it("preserva a data inicial e usa o dia configurado nos meses seguintes", () => {
    expect(monthlyOccurrenceDates({ startDate: "2026-09-15", dayOfMonth: 1 }, "2026-11-01")).toEqual([
      "2026-09-15", "2026-10-01", "2026-11-01",
    ]);
  });

  it("avança o horizonte sem depender do mês corrente", () => {
    expect(addCompetenceMonths("2026-09-01", 12)).toBe("2027-09-01");
    expect(monthlyOccurrenceDates({ startDate: "2026-08-01" }, "2047-08-01")).toHaveLength(253);
  });

  it("encerra no último dia anterior à competência selecionada", () => {
    expect(dayBeforeCompetence("2026-09-01")).toBe("2026-08-31");
    expect(dayBeforeCompetence("2027-01-01")).toBe("2026-12-31");
  });

  it("gera id estável por família, recorrência e ocorrência", () => {
    const id = recurrenceOccurrenceId("family-a", "recurrence-a", "2026-08-05");

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(recurrenceOccurrenceId("family-a", "recurrence-a", "2026-08-05")).toBe(id);
    expect(recurrenceOccurrenceId("family-a", "recurrence-a", "2026-09-05")).not.toBe(id);
    expect(recurrenceOccurrenceId("family-a", "recurrence-b", "2026-08-05")).not.toBe(id);
    expect(recurrenceOccurrenceId("family-b", "recurrence-a", "2026-08-05")).not.toBe(id);
  });

  it("ordena ativas e inativas por receitas, despesas e descrição", () => {
    const recurrence = (id: string, description: string, active: boolean, entryType: string) => ({ id, description, active, entry_type: entryType }) as Recurrence;
    const rows = [
      recurrence("inactive-expense", "Água", false, "expense"),
      recurrence("active-expense-z", "Zeladoria", true, "expense"),
      recurrence("inactive-income-z", "Venda", false, "income"),
      recurrence("active-income-z", "Salário", true, "income"),
      recurrence("active-expense-a", "Condomínio", true, "expense"),
      recurrence("inactive-income-a", "Aluguel", false, "income"),
      recurrence("active-income-a", "Aposentadoria", true, "income"),
    ];

    expect(sortRecurrencesForEditing(rows).map((item) => item.id)).toEqual([
      "active-income-a",
      "active-income-z",
      "active-expense-a",
      "active-expense-z",
      "inactive-income-a",
      "inactive-income-z",
      "inactive-expense",
    ]);
  });

  it("limpa encerramento e reinicia o horizonte ao reativar", () => {
    expect(recurrenceActivationPatch(true, "2026-08-10")).toEqual({
      active: true,
      end_date: null,
      next_occurrence: "2026-08-10",
    });
    expect(recurrenceActivationPatch(false, "2026-08-10")).toEqual({ active: false });
  });

  it("limpa o vínculo da fatura quando a propagação troca o cartão", () => {
    expect(recurrenceEntryPropagationPatch({
      description: "Condomínio CenterV",
      entryType: "expense",
      expectedAmount: 648.65,
      categoryId: "condominio",
      classificationCategoryId: "condominio",
      accountId: null,
      cardId: null,
      responsiblePersonId: "responsavel",
      cardChanged: true,
    })).toMatchObject({
      card_id: null,
      card_invoice_id: null,
      cash_direction: "outflow",
    });
  });

  it("preserva o vínculo da fatura quando o cartão não muda", () => {
    expect(recurrenceEntryPropagationPatch({
      description: "Anuidade",
      entryType: "expense",
      expectedAmount: 54,
      categoryId: "cartao",
      classificationCategoryId: null,
      accountId: null,
      cardId: "card-1",
      responsiblePersonId: null,
      cardChanged: false,
    })).not.toHaveProperty("card_invoice_id");
  });
});
