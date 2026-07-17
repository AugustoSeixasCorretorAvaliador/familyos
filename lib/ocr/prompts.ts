const TYPE_SPECIALIZATIONS: Record<string, string> = {
  CNH: "Separe numero da CNH, CPF, RG, orgao emissor, emissao, validade, nascimento, nacionalidade e filiacao.",
  RG: "Separe RG, CPF quando visivel, orgao emissor, emissao, nascimento, naturalidade e filiacao.",
  CPF: "Extraia nome e CPF como texto, preservando pontuacao e zeros a esquerda.",
  passaporte: "Extraia nome, numero, nacionalidade, nascimento, emissao, validade, pais e autoridade.",
  "certidao de nascimento": "Extraia nome, nascimento, naturalidade, filiacao, livro, folha, termo, matricula e cartorio.",
  "certidao de casamento": "Extraia nomes, data, livro, folha, termo, matricula, cartorio e observacoes relevantes.",
  escritura: "Extraia partes, cartorio, livro, folha, matricula, datas e valores sem perder a forma original.",
  "matricula ou RGI": "Extraia matricula, cartorio, proprietarios, datas e identificacao do imovel.",
  IPTU: "Extraia inscricao ou matricula, titular, endereco, exercicio e valores.",
  contrato: "Extraia partes, objeto, datas, vigencia, valores e identificadores.",
  procuracao: "Extraia outorgante, outorgado, poderes, validade, cartorio, livro e folha.",
  "laudo medico": "Extraia paciente, profissional, registro, data, conclusao e observacoes clinicas legiveis.",
  receita: "Extraia paciente, profissional, registro, data, medicamentos, posologia e validade.",
  exame: "Extraia paciente, tipo, laboratorio, data, resultados e observacoes legiveis.",
  generico: "Classifique o documento e extraia somente campos explicitamente visiveis.",
};

export const OPENAI_OCR_BASE_PROMPT = `
Voce e um extrator documental do HERO.FamilyOS. Analise visualmente o arquivo e, em uma unica resposta,
classifique o tipo, transcreva apenas o texto relevante e extraia os campos do schema.

Regras obrigatorias:
- Nunca invente, complete ou deduza valores ausentes. Use null quando nao conseguir ler.
- Identificadores, CPF, RG, CNH, matriculas e numeros de documentos sao texto; preserve zeros a esquerda.
- Normalize datas inequivocas para YYYY-MM-DD. Nao confunda nascimento, emissao e validade.
- Preserve acentos em nomes e nao misture dados do titular com filiacao.
- Valores monetarios devem preservar o valor original legivel.
- Confidence e uma estimativa de legibilidade e certeza, nao uma probabilidade estatistica.
- Inclua warnings para documento cortado, desfocado, ilegivel, campos conflitantes ou classificacao incerta.
- Em warnings, descreva somente o problema de qualidade; nao repita CPF, RG, numeros, nomes ou outros dados pessoais.
- Mantenha requires_human_review como true: toda sugestao sera conferida por uma pessoa.
`.trim();

export function buildOpenAIOcrPrompt(documentTypeHint?: string | null) {
  const hint = documentTypeHint?.trim() || "desconhecido";
  const specialization = Object.entries(TYPE_SPECIALIZATIONS).find(([key]) =>
    hint.toLocaleLowerCase("pt-BR").includes(key.toLocaleLowerCase("pt-BR"))
  )?.[1];

  const classificationGuide = Object.entries(TYPE_SPECIALIZATIONS)
    .map(([type, guidance]) => `${type}: ${guidance}`)
    .join("\n");

  return [
    `Tipo informado pelo usuario: ${hint}. Confirme visualmente; corrija a classificacao se necessario.`,
    specialization ? `Foco para este tipo: ${specialization}` : "",
    "Especializacoes disponiveis:",
    classificationGuide,
    "Retorne exclusivamente o objeto definido pelo schema.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
