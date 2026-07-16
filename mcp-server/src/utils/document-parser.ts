function matchFirst(pattern: RegExp, text: string) {
  const result = text.match(pattern);
  return result?.[1]?.trim() || result?.[0]?.trim() || "";
}

function confidence(values: number[]) {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

export function parseDocumentText(rawText: string) {
  const text = rawText.replace(/\s+/g, " ").trim();
  const fields: Record<string, unknown> = {};
  const confidenceByField: Record<string, number> = {};
  const cpf = matchFirst(/\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/, text);
  const rg = matchFirst(/\b(\d{1,2}\.?\d{3}\.?\d{3}-?[\dxX])\b/, text);
  const nome = matchFirst(/nome\s*[:\-]\s*([^\n\r]+)/i, rawText);
  const numero = matchFirst(/n[uú]mero\s*[:\-]\s*([a-z0-9\-/.]+)/i, rawText);
  const validade = matchFirst(/validade\s*[:\-]\s*(\d{2}[/-]\d{2}[/-]\d{2,4})/i, rawText);

  if (nome) {
    fields.nome = nome;
    confidenceByField.nome = 0.96;
  }
  if (cpf) {
    fields.cpf = cpf;
    confidenceByField.cpf = 0.99;
  }
  if (rg) {
    fields.rg = rg;
    confidenceByField.rg = 0.9;
  }
  if (numero) {
    fields.numero = numero;
    confidenceByField.numero = 0.88;
  }
  if (validade) {
    fields.data_validade = validade;
    confidenceByField.data_validade = 0.87;
  }

  return {
    fields,
    confidenceByField,
    overallConfidence: confidence(Object.values(confidenceByField)),
  };
}
