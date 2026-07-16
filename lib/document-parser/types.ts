export type SupportedDocumentType =
  | "RG"
  | "CPF"
  | "CNH"
  | "Passaporte Brasileiro"
  | "Passaporte Portugues"
  | "Certidao de Nascimento"
  | "Certidao de Casamento"
  | "Escritura"
  | "Matricula de Imovel"
  | "Contrato"
  | "Documento Generico";

export type DocumentSuggestionFields = {
  nome?: string;
  numero?: string;
  cpf?: string;
  rg?: string;
  orgao_emissor?: string;
  pais?: string;
  livro?: string;
  folha?: string;
  termo?: string;
  matricula?: string;
  cartorio?: string;
  data_emissao?: string;
  data_validade?: string;
  naturalidade?: string;
  filiacao?: string;
  observacoes?: string;
};

export type DocumentSuggestion = {
  detectedType: SupportedDocumentType;
  fields: DocumentSuggestionFields;
  confidenceByField: Record<string, number>;
  overallConfidence: number;
};
