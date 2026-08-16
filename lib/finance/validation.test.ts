import { describe, expect, it } from "vitest";
import { assertNoClientFamilyId, competenceValue, dateValue, FinanceValidationError, integerValue, moneyValue, positiveDecimalValue, validatePercentage } from "@/lib/finance/validation";

describe("finance validation", () => {
  it("aceita moeda brasileira sem perder centavos", () => {
    expect(moneyValue("1.234,56", true)).toBe(1234.56);
    expect(moneyValue("8533.22", true)).toBe(8533.22);
    expect(moneyValue("9.181,87", true)).toBe(9181.87);
  });

  it("rejeita valor negativo ou com precisão inválida", () => {
    expect(() => moneyValue("-1,00", true)).toThrow(FinanceValidationError);
    expect(() => moneyValue("1,001", true)).toThrow(FinanceValidationError);
  });

  it("aceita cotação positiva com até oito casas decimais", () => {
    expect(positiveDecimalValue("5,43218765", { required: true, maxDecimals: 8 })).toBe(5.43218765);
    expect(() => positiveDecimalValue("0", { required: true })).toThrow("invalid_number");
    expect(() => positiveDecimalValue("5,123456789", { maxDecimals: 8 })).toThrow("invalid_number");
  });

  it("normaliza competência mensal para o primeiro dia", () => {
    expect(competenceValue("2026-08")).toBe("2026-08-01");
    expect(() => competenceValue("2026-08-02")).toThrow("invalid_competence");
  });

  it("valida datas, parcelas e dias de cartão", () => {
    expect(dateValue("2026-02-28", true)).toBe("2026-02-28");
    expect(integerValue("12", { min: 1, max: 360, required: true })).toBe(12);
    expect(() => integerValue("32", { min: 1, max: 31 })).toThrow("invalid_number");
  });

  it("valida percentuais de rateio", () => {
    expect(validatePercentage("50,25")).toBe(50.25);
    expect(() => validatePercentage("100,01")).toThrow("invalid_percentage");
  });

  it("rejeita family_id enviado pelo cliente", () => {
    const data = new FormData();
    data.set("family_id", "familia-de-terceiro");
    expect(() => assertNoClientFamilyId(data)).toThrow("invalid_family_context");
  });
});
