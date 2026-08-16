export type ActionErrorCode =
  | "required_fields"
  | "missing_id"
  | "invalid_file"
  | "file_too_large"
  | "unsupported_file_type"
  | "too_many_files"
  | "multiple_files_require_archive"
  | "invalid_amount"
  | "permission_denied"
  | "self_access_protected"
  | "last_admin_required"
  | "schema_missing"
  | "schema_mismatch"
  | "duplicate"
  | "related_records"
  | "installment_locked"
  | "recurrence_has_realized_future"
  | "invoice_managed_settlement"
  | "not_found"
  | "file_not_found"
  | "signed_url_failed"
  | "storage_failed"
  | "storage_bucket_missing"
  | "invitation_invalid"
  | "invitation_email_mismatch"
  | "invitation_required"
  | "pending_invitation"
  | "read_failed"
  | "create_failed"
  | "update_failed"
  | "confirm_failed"
  | "delete_failed"
  | "unknown";

const ERROR_MESSAGES: Record<ActionErrorCode, string> = {
  required_fields: "Preencha todos os campos obrigatorios.",
  missing_id: "O registro informado nao possui um identificador valido.",
  invalid_file: "Selecione um arquivo valido.",
  file_too_large: "O arquivo excede o limite permitido.",
  unsupported_file_type: "O formato do arquivo nao e permitido.",
  too_many_files: "Selecione no maximo 10 arquivos por envio.",
  multiple_files_require_archive:
    "Para enviar varios arquivos de uma vez, marque Somente arquivar no historico.",
  invalid_amount: "Informe um valor monetario valido, com no maximo duas casas decimais.",
  permission_denied: "A politica de seguranca nao permite esta operacao para o seu perfil.",
  self_access_protected:
    "Seu proprio nivel de acesso nao pode ser alterado nesta tela, evitando bloqueio acidental.",
  last_admin_required:
    "A familia precisa manter ao menos um administrador ativo.",
  schema_missing: "O modulo ainda nao foi aplicado ao banco de dados.",
  schema_mismatch: "A estrutura do modulo esta divergente do banco de dados.",
  duplicate: "Este registro ja existe.",
  related_records: "O registro possui dados relacionados e nao pode ser excluido.",
  installment_locked: "Este parcelamento possui parcela realizada, faturada ou ja foi cancelado e nao pode ser editado.",
  recurrence_has_realized_future: "Existem ocorrencias futuras ja recebidas ou pagas. Desfaca essas baixas antes de encerrar a recorrencia.",
  invoice_managed_settlement: "Este cartao possui uma fatura formal nesta competencia. Faca a baixa pela area Faturas para registrar o pagamento uma unica vez.",
  not_found: "O registro nao foi encontrado ou nao esta acessivel.",
  file_not_found: "O arquivo solicitado nao foi encontrado.",
  signed_url_failed: "Nao foi possivel gerar o acesso privado ao arquivo.",
  storage_failed: "Falha ao enviar ou acessar o arquivo no Storage.",
  storage_bucket_missing: "O armazenamento privado deste modulo ainda nao foi configurado.",
  invitation_invalid: "O convite e invalido, expirou ou ja foi utilizado.",
  invitation_email_mismatch: "Este convite pertence a outro endereco de e-mail.",
  invitation_required: "Seu cadastro familiar existe, mas precisa de um convite ou regularizacao do administrador.",
  pending_invitation: "Voce possui um convite pendente.",
  read_failed: "Nao foi possivel carregar o registro solicitado.",
  create_failed: "Nao foi possivel cadastrar o registro.",
  update_failed: "Nao foi possivel atualizar o registro.",
  confirm_failed: "Nao foi possivel confirmar a revisao do documento.",
  delete_failed: "Nao foi possivel excluir o registro.",
  unknown: "Nao foi possivel concluir a operacao.",
};

export function getActionErrorMessage(code?: string, requestId?: string) {
  const message =
    !code || !(code in ERROR_MESSAGES)
      ? ERROR_MESSAGES.unknown
      : ERROR_MESSAGES[code as ActionErrorCode];
  return requestId ? `${message} Referencia: ${requestId}.` : message;
}
