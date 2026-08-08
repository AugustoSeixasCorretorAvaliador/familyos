import { describe, expect, it } from "vitest";
import { findCardCategoryId } from "@/lib/finance/card-category";

const categories = [
  { id: "c6", name: "Cartão de Crédito C6" },
  { id: "bradesco", name: "Cartão de Crédito Bradesco" },
  { id: "mercado-pago", name: "Cartão de Crédito Mercado Pago" },
  { id: "porto", name: "Cartão de Crédito Porto Seguro" },
  { id: "compras", name: "Compras" },
];

describe("findCardCategoryId", () => {
  it.each([
    ["C6 final 1585", "c6"],
    ["BRADESCO", "bradesco"],
    ["Mercado Pago", "mercado-pago"],
    ["Porto Seguro", "porto"],
  ])("encontra a categoria principal de %s", (cardName, expected) => {
    expect(findCardCategoryId(cardName, categories)).toBe(expected);
  });

  it("não confunde uma categoria comum com a categoria do cartão", () => {
    expect(findCardCategoryId("Cartão inexistente", categories)).toBeNull();
  });
});
