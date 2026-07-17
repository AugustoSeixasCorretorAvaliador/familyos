import { normalizeDisplayName } from "../identity/display-name";

export type TimelineEventForPresentation = {
  eventType: string;
  entityType: string;
  actorName?: string | null;
  entityName?: string | null;
  entityHref?: string | null;
  canViewDetails?: boolean;
  metadata?: Record<string, unknown> | null;
};

export type TimelinePresentation = {
  icon: string;
  moduleLabel: string;
  entityLabel: string;
  message: string;
  href: string | null;
};

type EventContext = {
  actor: string | null;
  entity: string | null;
};

type EventDefinition = {
  icon: string;
  moduleLabel: string;
  entityLabel: string;
  render: (context: EventContext) => string;
};

type EntityEventOptions = {
  icon: string;
  moduleLabel: string;
  entityLabel: string;
  noun: string;
  actorVerb: string;
  passiveVerb: string;
  definiteArticle: "o" | "a";
  indefiniteArticle: "um" | "uma";
};

function entityEvent(options: EntityEventOptions): EventDefinition {
  return {
    icon: options.icon,
    moduleLabel: options.moduleLabel,
    entityLabel: options.entityLabel,
    render: ({ actor, entity }) => {
      if (actor && entity) {
        return `${actor} ${options.actorVerb} ${options.definiteArticle} ${options.noun} “${entity}”.`;
      }
      if (actor) {
        return `${actor} ${options.actorVerb} ${options.indefiniteArticle} ${options.noun}.`;
      }
      if (entity) {
        return `${options.passiveVerb} ${options.definiteArticle} ${options.noun} “${entity}”.`;
      }
      return `${options.passiveVerb} ${options.indefiniteArticle} ${options.noun}.`;
    },
  };
}

const eventDefinitions: Record<string, EventDefinition> = {
  family_created: {
    icon: "🏡",
    moduleLabel: "Família",
    entityLabel: "Família",
    render: ({ actor }) =>
      actor ? `${actor} criou a família.` : "A família foi criada.",
  },
  family_invitation_created: {
    icon: "✉️",
    moduleLabel: "Convites",
    entityLabel: "Convite",
    render: ({ actor }) =>
      actor
        ? `${actor} criou um convite familiar.`
        : "Foi criado um convite familiar.",
  },
  family_invitation_accepted: {
    icon: "👋",
    moduleLabel: "Convites",
    entityLabel: "Convite",
    render: ({ actor }) =>
      actor
        ? `${actor} aceitou o convite para participar da família.`
        : "Um convite para participar da família foi aceito.",
  },
  legal_case_created: entityEvent({
    icon: "⚖️",
    moduleLabel: "Processos",
    entityLabel: "Processo",
    noun: "processo",
    actorVerb: "cadastrou",
    passiveVerb: "Foi cadastrado",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  legal_case_updated: entityEvent({
    icon: "⚖️",
    moduleLabel: "Processos",
    entityLabel: "Processo",
    noun: "processo",
    actorVerb: "atualizou",
    passiveVerb: "Foi atualizado",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  legal_case_deleted: entityEvent({
    icon: "⚖️",
    moduleLabel: "Processos",
    entityLabel: "Processo",
    noun: "processo",
    actorVerb: "removeu",
    passiveVerb: "Foi removido",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  task_created: entityEvent({
    icon: "✅",
    moduleLabel: "Tarefas",
    entityLabel: "Tarefa",
    noun: "tarefa",
    actorVerb: "criou",
    passiveVerb: "Foi criada",
    definiteArticle: "a",
    indefiniteArticle: "uma",
  }),
  task_updated: entityEvent({
    icon: "✅",
    moduleLabel: "Tarefas",
    entityLabel: "Tarefa",
    noun: "tarefa",
    actorVerb: "atualizou",
    passiveVerb: "Foi atualizada",
    definiteArticle: "a",
    indefiniteArticle: "uma",
  }),
  task_completed: entityEvent({
    icon: "✅",
    moduleLabel: "Tarefas",
    entityLabel: "Tarefa",
    noun: "tarefa",
    actorVerb: "concluiu",
    passiveVerb: "Foi concluída",
    definiteArticle: "a",
    indefiniteArticle: "uma",
  }),
  task_reopened: entityEvent({
    icon: "↩️",
    moduleLabel: "Tarefas",
    entityLabel: "Tarefa",
    noun: "tarefa",
    actorVerb: "reabriu",
    passiveVerb: "Foi reaberta",
    definiteArticle: "a",
    indefiniteArticle: "uma",
  }),
  task_deleted: entityEvent({
    icon: "🗑️",
    moduleLabel: "Tarefas",
    entityLabel: "Tarefa",
    noun: "tarefa",
    actorVerb: "removeu",
    passiveVerb: "Foi removida",
    definiteArticle: "a",
    indefiniteArticle: "uma",
  }),
  medication_created: entityEvent({
    icon: "💊",
    moduleLabel: "Saúde",
    entityLabel: "Medicamento",
    noun: "medicamento",
    actorVerb: "cadastrou",
    passiveVerb: "Foi cadastrado",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  doctor_created: entityEvent({
    icon: "🩺",
    moduleLabel: "Saúde",
    entityLabel: "Médico",
    noun: "médico",
    actorVerb: "cadastrou",
    passiveVerb: "Foi cadastrado",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  health_exam_created: entityEvent({
    icon: "🧪",
    moduleLabel: "Saúde",
    entityLabel: "Exame",
    noun: "exame",
    actorVerb: "cadastrou",
    passiveVerb: "Foi cadastrado",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  health_exam_completed: entityEvent({
    icon: "🧪",
    moduleLabel: "Saúde",
    entityLabel: "Exame",
    noun: "exame",
    actorVerb: "concluiu",
    passiveVerb: "Foi concluído",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  property_created: entityEvent({
    icon: "🏠",
    moduleLabel: "Imóveis",
    entityLabel: "Imóvel",
    noun: "imóvel",
    actorVerb: "cadastrou",
    passiveVerb: "Foi cadastrado",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  property_updated: entityEvent({
    icon: "🏠",
    moduleLabel: "Imóveis",
    entityLabel: "Imóvel",
    noun: "imóvel",
    actorVerb: "atualizou",
    passiveVerb: "Foi atualizado",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  property_deleted: entityEvent({
    icon: "🏠",
    moduleLabel: "Imóveis",
    entityLabel: "Imóvel",
    noun: "imóvel",
    actorVerb: "removeu",
    passiveVerb: "Foi removido",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  document_uploaded: entityEvent({
    icon: "📄",
    moduleLabel: "Documentos",
    entityLabel: "Documento",
    noun: "documento",
    actorVerb: "enviou",
    passiveVerb: "Foi enviado",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  document_updated: entityEvent({
    icon: "📄",
    moduleLabel: "Documentos",
    entityLabel: "Documento",
    noun: "documento",
    actorVerb: "atualizou",
    passiveVerb: "Foi atualizado",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  document_deleted: entityEvent({
    icon: "📄",
    moduleLabel: "Documentos",
    entityLabel: "Documento",
    noun: "documento",
    actorVerb: "removeu",
    passiveVerb: "Foi removido",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  property_document_uploaded: entityEvent({
    icon: "📄",
    moduleLabel: "Documentos",
    entityLabel: "Documento do imóvel",
    noun: "documento do imóvel",
    actorVerb: "enviou",
    passiveVerb: "Foi enviado",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  property_document_updated: entityEvent({
    icon: "📄",
    moduleLabel: "Documentos",
    entityLabel: "Documento do imóvel",
    noun: "documento do imóvel",
    actorVerb: "atualizou",
    passiveVerb: "Foi atualizado",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  property_document_deleted: entityEvent({
    icon: "📄",
    moduleLabel: "Documentos",
    entityLabel: "Documento do imóvel",
    noun: "documento do imóvel",
    actorVerb: "removeu",
    passiveVerb: "Foi removido",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  document_review_confirmed: entityEvent({
    icon: "📄",
    moduleLabel: "Documentos",
    entityLabel: "Documento",
    noun: "documento",
    actorVerb: "confirmou",
    passiveVerb: "Foi confirmado",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  document_review_rejected: entityEvent({
    icon: "📄",
    moduleLabel: "Documentos",
    entityLabel: "Documento",
    noun: "documento",
    actorVerb: "rejeitou",
    passiveVerb: "Foi rejeitado",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  account_created: {
    icon: "💳",
    moduleLabel: "Finanças",
    entityLabel: "Conta financeira",
    render: ({ actor, entity }) => {
      if (actor && entity) return `${actor} cadastrou uma conta financeira no ${entity}.`;
      if (actor) return `${actor} cadastrou uma conta financeira.`;
      if (entity) return `Foi cadastrada uma conta financeira no ${entity}.`;
      return "Foi cadastrada uma conta financeira.";
    },
  },
  person_created: entityEvent({
    icon: "👤",
    moduleLabel: "Pessoas",
    entityLabel: "Pessoa",
    noun: "pessoa",
    actorVerb: "cadastrou",
    passiveVerb: "Foi cadastrada",
    definiteArticle: "a",
    indefiniteArticle: "uma",
  }),
  relationship_created: entityEvent({
    icon: "🔗",
    moduleLabel: "Relacionamentos",
    entityLabel: "Relacionamento",
    noun: "relacionamento",
    actorVerb: "cadastrou",
    passiveVerb: "Foi cadastrado",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  family_member_regularized: entityEvent({
    icon: "👥",
    moduleLabel: "Pessoas",
    entityLabel: "Familiar",
    noun: "familiar",
    actorVerb: "regularizou",
    passiveVerb: "Foi regularizado",
    definiteArticle: "o",
    indefiniteArticle: "um",
  }),
  duplicate_family_archived: {
    icon: "🛡️",
    moduleLabel: "Família",
    entityLabel: "Família",
    render: () => "Um cadastro familiar duplicado foi arquivado com segurança.",
  },
  document_ocr_started: {
    icon: "🔎",
    moduleLabel: "Documentos",
    entityLabel: "OCR",
    render: ({ entity }) =>
      entity ? `A leitura OCR do documento “${entity}” foi iniciada.` : "Uma leitura OCR foi iniciada.",
  },
  document_ocr_completed: {
    icon: "🔎",
    moduleLabel: "Documentos",
    entityLabel: "OCR",
    render: ({ entity }) =>
      entity ? `A leitura OCR do documento “${entity}” foi concluída.` : "Uma leitura OCR foi concluída.",
  },
  document_ocr_failed: {
    icon: "⚠️",
    moduleLabel: "Documentos",
    entityLabel: "OCR",
    render: ({ entity }) =>
      entity
        ? `A leitura OCR do documento “${entity}” precisa de atenção.`
        : "Uma leitura OCR precisa de atenção.",
  },
};

const entityModuleLabels: Record<string, string> = {
  accounts: "Finanças",
  doctors: "Saúde",
  documents: "Documentos",
  entity_relationships: "Relacionamentos",
  families: "Família",
  family_invitations: "Convites",
  family_members: "Pessoas",
  family_tasks: "Tarefas",
  health_exams: "Saúde",
  legal_cases: "Processos",
  medications: "Saúde",
  people: "Pessoas",
  properties: "Imóveis",
};

export function humanizeTimelineEvent(
  event: TimelineEventForPresentation
): TimelinePresentation {
  const definition = eventDefinitions[event.eventType];
  const moduleLabel =
    definition?.moduleLabel ?? entityModuleLabels[event.entityType] ?? "Família";
  const canViewDetails = event.canViewDetails !== false;
  const actor = normalizeDisplayName(event.actorName);
  const metadataEntityName =
    normalizeDisplayName(event.metadata?.entity_name) ??
    normalizeDisplayName(event.metadata?.title) ??
    normalizeDisplayName(event.metadata?.name);
  const entity = canViewDetails
    ? normalizeDisplayName(event.entityName) ?? metadataEntityName
    : null;

  if (!definition) {
    return {
      icon: "🗂️",
      moduleLabel,
      entityLabel: "Atividade",
      message: `Atividade registrada no módulo ${moduleLabel}.`,
      href: null,
    };
  }

  return {
    icon: definition.icon,
    moduleLabel,
    entityLabel: definition.entityLabel,
    message: definition.render({ actor, entity }),
    href: canViewDetails && entity ? event.entityHref ?? null : null,
  };
}
