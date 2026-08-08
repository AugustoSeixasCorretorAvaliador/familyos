import { describe, expect, it } from "vitest";
import { addCompetenceMonths, dayBeforeCompetence, monthlyOccurrenceDates, recurrenceOccurrenceId, sortRecurrencesForEditing } from "@/lib/finance/recurrence";
import type { Recurrence } from "@/lib/finance/types";

describe("recorrências financeiras contínuas", () => {
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
});
