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
  | "IPTU"
  | "Contrato"
  | "Procuracao"
  | "Laudo Medico"
  | "Receita"
  | "Exame"
  | "CRLV"
  | "Apolice de Seguro"
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
  data_nascimento?: string;
  nacionalidade?: string;
  naturalidade?: string;
  filiacao?: string;
  valor_monetario?: string;
  placa?: string;
  renavam?: string;
  chassi?: string;
  marca?: string;
  modelo?: string;
  ano_fabricacao?: string;
  ano_modelo?: string;
  seguradora?: string;
  numero_apolice?: string;
  data_inicio?: string;
  data_fim?: string;
  valor_segurado?: string;
  valor_pago?: string;
  franquia?: string;
  observacoes?: string;
};

export type DocumentSuggestion = {
  detectedType: SupportedDocumentType;
  fields: DocumentSuggestionFields;
  confidenceByField: Record<string, number>;
  overallConfidence: number;
};
