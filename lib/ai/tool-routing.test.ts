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

  it("roteia análises financeiras para o panorama determinístico", () => {
    expect(selectExecutiveTools("Quais despesas mais cresceram neste mês?")).toEqual([
      "get_financial_overview",
    ]);
  });

  it("combina contas e fluxo para perguntas de saldo", () => {
    expect(selectExecutiveTools("Quanto dinheiro disponível temos nas contas?")).toEqual([
      "list_financial_accounts",
      "get_financial_summary",
      "get_financial_overview",
    ]);
  });

  it("consulta reajustes de aluguel e imóveis", () => {
    expect(selectExecutiveTools("Quais aluguéis precisam de reajuste?")).toEqual([
      "list_properties",
      "get_rent_adjustment_alerts",
    ]);
  });

  it("combina patrimônio, investimentos e imóveis", () => {
    expect(selectExecutiveTools("Qual é o patrimônio líquido total conhecido?")).toEqual([
      "get_net_worth_summary",
    ]);
  });

  it("usa o RX integrado para o retrato financeiro e patrimonial do dia", () => {
    expect(
      selectExecutiveTools(
        "Faça um RX financeiro e patrimonial de hoje dentro do mês atual."
      )
    ).toEqual(["get_daily_integrated_snapshot"]);
  });
});
