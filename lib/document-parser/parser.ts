import type {
  DocumentSuggestion,
  DocumentSuggestionFields,
  SupportedDocumentType,
} from "@/lib/document-parser/types";

function matchFirst(pattern: RegExp, text: string) {
  const result = text.match(pattern);
  return result?.[1]?.trim() || result?.[0]?.trim() || "";
}

function detectType(text: string): SupportedDocumentType {
  const normalized = text.toLowerCase();

  if (normalized.includes("registro geral") || normalized.includes("carteira de identidade")) return "RG";
  if (normalized.includes("cadastro de pessoa fisica") || normalized.includes("cpf")) return "CPF";
  if (normalized.includes("carteira nacional de habilitacao") || normalized.includes("cnh")) return "CNH";
  if (normalized.includes("republica federativa do brasil") && normalized.includes("passaporte")) {
    return "Passaporte Brasileiro";
  }
  if (normalized.includes("republica portuguesa") || normalized.includes("passaporte") && normalized.includes("portugal")) {
    return "Passaporte Portugues";
  }
  if (normalized.includes("certidao de nascimento")) return "Certidao de Nascimento";
  if (normalized.includes("certidao de casamento")) return "Certidao de Casamento";
  if (normalized.includes("escritura")) return "Escritura";
  if (normalized.includes("matricula") && normalized.includes("imovel")) return "Matricula de Imovel";
  if (normalized.includes("contrato")) return "Contrato";

  return "Documento Generico";
}

function computeOverallConfidence(values: number[]) {
  if (values.length === 0) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Number((total / values.length).toFixed(2));
}

export function parseDocumentText(rawText: string): DocumentSuggestion {
  const text = rawText.replace(/\s+/g, " ").trim();
  const fields: DocumentSuggestionFields = {};
  const confidenceByField: Record<string, number> = {};

  const detectedType = detectType(text);

  const nome =
    matchFirst(/nome\s*[:\-]\s*([^\n\r]+)/i, rawText) ||
    matchFirst(/name\s*[:\-]\s*([^\n\r]+)/i, rawText);
  if (nome) {
    fields.nome = nome;
    confidenceByField.nome = 0.96;
  }

  const cpf = matchFirst(/\b(\d{3}\.\d{3}\.\d{3}\-\d{2}|\d{11})\b/, text);
  if (cpf) {
    fields.cpf = cpf;
    confidenceByField.cpf = 0.99;
  }

  const rg = matchFirst(/\b(\d{1,2}\.?\d{3}\.?\d{3}\-?[\dxX])\b/, text);
  if (rg) {
    fields.rg = rg;
    confidenceByField.rg = 0.9;
  }

  const numero =
    matchFirst(/numero\s*[:\-]\s*([a-z0-9\-\/\.]+)/i, rawText) ||
    matchFirst(/no\.?\s*[:\-]?\s*([a-z0-9\-\/\.]+)/i, rawText);
  if (numero) {
    fields.numero = numero;
    confidenceByField.numero = 0.88;
  }

  const orgao = matchFirst(/org[aã]o\s*emissor\s*[:\-]\s*([^\n\r]+)/i, rawText);
  if (orgao) {
    fields.orgao_emissor = orgao;
    confidenceByField.orgao_emissor = 0.9;
  }

  const pais = matchFirst(/\b(brasil|portugal|brazil)\b/i, text);
  if (pais) {
    fields.pais = pais;
    confidenceByField.pais = 0.95;
  }

  const livro = matchFirst(/livro\s*[:\-]\s*([a-z0-9\-\/\.]+)/i, rawText);
  if (livro) {
    fields.livro = livro;
    confidenceByField.livro = 0.85;
  }

  const folha = matchFirst(/folha\s*[:\-]\s*([a-z0-9\-\/\.]+)/i, rawText);
  if (folha) {
    fields.folha = folha;
    confidenceByField.folha = 0.85;
  }

  const termo = matchFirst(/termo\s*[:\-]\s*([a-z0-9\-\/\.]+)/i, rawText);
  if (termo) {
    fields.termo = termo;
    confidenceByField.termo = 0.85;
  }

  const matricula = matchFirst(/matr[ií]cula\s*[:\-]\s*([a-z0-9\-\/\.]+)/i, rawText);
  if (matricula) {
    fields.matricula = matricula;
    confidenceByField.matricula = 0.9;
  }

  const cartorio = matchFirst(/cart[oó]rio\s*[:\-]\s*([^\n\r]+)/i, rawText);
  if (cartorio) {
    fields.cartorio = cartorio;
    confidenceByField.cartorio = 0.82;
  }

  const dataEmissao = matchFirst(/emiss[aã]o\s*[:\-]\s*(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})/i, rawText);
  if (dataEmissao) {
    fields.data_emissao = dataEmissao;
    confidenceByField.data_emissao = 0.86;
  }

  const dataValidade =
    matchFirst(/validade\s*[:\-]\s*(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})/i, rawText) ||
    matchFirst(/expira\s*em\s*(\d{2}[\/\-]\d{2}[\/\-]\d{2,4})/i, rawText);
  if (dataValidade) {
    fields.data_validade = dataValidade;
    confidenceByField.data_validade = 0.87;
  }

  const naturalidade = matchFirst(/naturalidade\s*[:\-]\s*([^\n\r]+)/i, rawText);
  if (naturalidade) {
    fields.naturalidade = naturalidade;
    confidenceByField.naturalidade = 0.82;
  }

  const filiacao = matchFirst(/filia[cç][aã]o\s*[:\-]\s*([^\n\r]+)/i, rawText);
  if (filiacao) {
    fields.filiacao = filiacao;
    confidenceByField.filiacao = 0.82;
  }

  fields.observacoes = `Tipo identificado: ${detectedType}`;
  confidenceByField.observacoes = 0.8;

  return {
    detectedType,
    fields,
    confidenceByField,
    overallConfidence: computeOverallConfidence(Object.values(confidenceByField)),
  };
}
