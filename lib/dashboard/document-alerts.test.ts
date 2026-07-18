import { describe, expect, it } from "vitest";
import {
  buildDocumentExpirationAlerts,
  mergeDashboardAlerts,
  type DashboardAlert,
} from "@/lib/dashboard/document-alerts";

const NOW = new Date("2026-07-18T15:00:00.000Z");

describe("buildDocumentExpirationAlerts", () => {
  it("remove do dashboard o documento cuja validade foi apagada", () => {
    expect(
      buildDocumentExpirationAlerts(
        [{ id: "doc-1", title: "All Docs Maria José", expiration_date: null }],
        NOW
      )
    ).toEqual([]);
  });

  it("remove do dashboard o documento atualizado para além de 90 dias", () => {
    expect(
      buildDocumentExpirationAlerts(
        [{ id: "doc-1", title: "CRECI", expiration_date: "2027-01-01" }],
        NOW
      )
    ).toEqual([]);
  });

  it("gera somente um alerta vigente para cada documento", () => {
    expect(
      buildDocumentExpirationAlerts(
        [{
          id: "doc-bella",
          title: "Documento Generico — Kleine Lummels Bella",
          expiration_date: "2026-07-18",
        }],
        NOW
      )
    ).toEqual([
      expect.objectContaining({
        id: "document-expiration-doc-bella",
        title: "Documento vence hoje: Documento Generico — Kleine Lummels Bella",
        due_date: "2026-07-18",
        severity: "critical",
      }),
    ]);
  });

  it("mantém documento realmente vencido com a validade atual", () => {
    expect(
      buildDocumentExpirationAlerts(
        [{ id: "doc-1", title: "CNH", expiration_date: "2023-10-22" }],
        NOW
      )[0]
    ).toEqual(
      expect.objectContaining({
        title: "Documento vencido: CNH",
        due_date: "2023-10-22",
        severity: "critical",
      })
    );
  });
});

describe("mergeDashboardAlerts", () => {
  it("ordena alertas atuais e respeita o limite visual", () => {
    const stored: DashboardAlert[] = [{
      id: "task-1",
      title: "Tarefa",
      description: null,
      due_date: "2026-07-20",
      severity: "medium",
    }];
    const documents = buildDocumentExpirationAlerts(
      [{ id: "doc-1", title: "RG", expiration_date: "2026-07-19" }],
      NOW
    );

    expect(mergeDashboardAlerts(stored, documents, 1)[0].id).toBe(
      "document-expiration-doc-1"
    );
  });
});
