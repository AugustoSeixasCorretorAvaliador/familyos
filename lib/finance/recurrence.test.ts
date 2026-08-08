import { describe, expect, it } from "vitest";
import { addCompetenceMonths, monthlyOccurrenceDates } from "@/lib/finance/recurrence";

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
});
