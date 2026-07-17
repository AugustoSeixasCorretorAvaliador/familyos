import { describe, expect, it } from "vitest";
import { humanizeTimelineEvent } from "./presentation";

describe("humanizeTimelineEvent", () => {
  it("traduz evento conhecido com ator e entidade", () => {
    const result = humanizeTimelineEvent({
      eventType: "legal_case_created",
      entityType: "legal_cases",
      actorName: "Augusto Seixas",
      entityName: "INSS",
      entityHref: "/processos",
    });

    expect(result.message).toBe('Augusto Seixas cadastrou o processo “INSS”.');
    expect(result.href).toBe("/processos");
    expect(result.icon).toBe("⚖️");
  });

  it("traduz evento conhecido sem ator", () => {
    const result = humanizeTimelineEvent({
      eventType: "legal_case_created",
      entityType: "legal_cases",
      entityName: "INSS",
    });

    expect(result.message).toBe('Foi cadastrado o processo “INSS”.');
  });

  it("usa fallback seguro para evento desconhecido", () => {
    const result = humanizeTimelineEvent({
      eventType: "internal_unknown_code",
      entityType: "documents",
    });

    expect(result.message).toBe("Atividade registrada no módulo Documentos.");
    expect(result.message).not.toContain("internal_unknown_code");
  });

  it("não inventa nome quando os metadados estão incompletos", () => {
    const result = humanizeTimelineEvent({
      eventType: "task_created",
      entityType: "family_tasks",
      actorName: "Augusto Seixas",
      metadata: { status: "open" },
    });

    expect(result.message).toBe("Augusto Seixas criou uma tarefa.");
  });

  it("oculta detalhes e link de evento sensível sem permissão", () => {
    const result = humanizeTimelineEvent({
      eventType: "document_uploaded",
      entityType: "documents",
      actorName: "Augusto Seixas",
      entityName: "Laudo médico sigiloso",
      entityHref: "/documentos/segredo/revisar",
      canViewDetails: false,
    });

    expect(result.message).toBe("Augusto Seixas enviou um documento.");
    expect(result.message).not.toContain("Laudo");
    expect(result.href).toBeNull();
  });

  it("normaliza nomes acentuados e espaços extras", () => {
    const result = humanizeTimelineEvent({
      eventType: "medication_created",
      entityType: "medications",
      actorName: "  Maria   José ",
      entityName: "  Ácido   fólico ",
    });

    expect(result.message).toBe('Maria José cadastrou o medicamento “Ácido fólico”.');
  });
});
