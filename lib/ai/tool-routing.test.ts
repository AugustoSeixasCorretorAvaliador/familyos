import { describe, expect, it } from "vitest";
import { selectExecutiveTools } from "@/lib/ai/tool-routing";

describe("selectExecutiveTools", () => {
  it("combina dashboard, pendências e agenda para uma visão geral", () => {
    expect(selectExecutiveTools("Como está a família hoje?")).toEqual([
      "get_dashboard",
      "get_pending_items",
      "list_calendar_events",
    ]);
  });

  it("consulta imóveis detalhados sem calcular total quando não solicitado", () => {
    expect(selectExecutiveTools("Quais imóveis temos?")).toEqual([
      "list_properties",
    ]);
  });

  it("consulta lista e resumo determinístico para valores imobiliários", () => {
    expect(selectExecutiveTools("Qual o valor total do patrimônio imobiliário?")).toEqual([
      "list_properties",
      "get_property_portfolio_summary",
    ]);
  });

  it("combina ferramentas quando a pergunta atravessa módulos", () => {
    expect(
      selectExecutiveTools(
        "Quais tarefas urgentes e documentos próximos do vencimento?"
      )
    ).toEqual([
      "get_document_expirations",
      "list_tasks",
      "get_pending_items",
    ]);
  });

  it("usa dashboard como fallback seguro", () => {
    expect(selectExecutiveTools("Preciso de uma análise")).toEqual([
      "get_dashboard",
    ]);
  });
});
