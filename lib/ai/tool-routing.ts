import type { ExecutiveToolName } from "@/lib/ai/tools/types";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function unique(tools: ExecutiveToolName[]) {
  return Array.from(new Set(tools));
}

export function selectExecutiveTools(question: string): ExecutiveToolName[] {
  const value = normalize(question);
  const tools: ExecutiveToolName[] = [];

  if (
    /\brx\b|raio x|retrato (financeiro|do mes)|visao integrada|o que entrou.*(saiu|sai).*sobr/.test(
      value
    )
  ) {
    return ["get_daily_integrated_snapshot"];
  }

  if (
    /como (esta|vai).*(familia|casa)|visao geral|resumo geral|familia hoje/.test(
      value
    )
  ) {
    tools.push("get_dashboard", "get_pending_items", "list_calendar_events");
  }
  if (/imove|patrimonio imobiliario|carteira imobiliaria|alug|loca|reajust/.test(value)) {
    tools.push("list_properties");
    if (
      /valor|total|soma|patrimonio|proporcional|percentual|avaliacao|divida|liquid/.test(
        value
      )
    ) {
      tools.push("get_property_portfolio_summary");
    }
  }
  if (/alug|loca|reajust|contrato.*imove/.test(value)) {
    tools.push("get_rent_adjustment_alerts");
  }
  if (/document/.test(value)) {
    tools.push(
      /venc|validade|expir/.test(value)
        ? "get_document_expirations"
        : "list_documents"
    );
  }
  if (/tarefa|pendencia|urgente|prioridade/.test(value)) {
    tools.push("list_tasks", "get_pending_items");
  }
  if (/processo|juridic|legal/.test(value)) {
    tools.push("list_legal_processes");
  }
  if (/exame|saude|medic/.test(value)) {
    tools.push(
      /atras|venc|alert|pend/.test(value)
        ? "get_health_alerts"
        : "list_health_records"
    );
  }
  if (
    /financ|receita|despesa|gasto|orcamento|fluxo de caixa|margem|superavit|deficit|pagamento|recorrencia|transfer/.test(
      value
    )
  ) {
    tools.push("get_financial_overview");
  }
  if (/conta|saldo|cofre|liquidez|dinheiro disponivel/.test(value)) {
    tools.push(
      "list_financial_accounts",
      "get_financial_summary",
      "get_financial_overview"
    );
  }
  if (/invest|aplicacao|carteira de ativos|rentabilidade/.test(value)) {
    tools.push("get_investment_summary");
  }
  if (
    /patrimonio|riqueza liquida|valor liquido total/.test(value) &&
    !/patrimonio imobiliario|carteira imobiliaria/.test(value)
  ) {
    tools.push("get_net_worth_summary");
  }
  if (/agenda|calendario|compromisso|evento/.test(value)) {
    tools.push("list_calendar_events");
  }
  if (/timeline|historico recente|aconteceu/.test(value)) {
    tools.push("get_family_timeline");
  }
  if (/pessoa|membro|familiar/.test(value) && tools.length === 0) {
    tools.push("list_people");
  }

  return unique(tools.length > 0 ? tools : ["get_dashboard"]);
}
