export type DashboardAlert = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  severity: "low" | "medium" | "high" | "critical" | string;
};

export type DocumentExpirationRow = {
  id: string;
  title: string;
  expiration_date: string | null;
};

const DAY_MS = 86_400_000;
const FAMILY_TIME_ZONE = "America/Sao_Paulo";

function dateOnlyEpoch(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return Number.NaN;

  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function todayEpoch(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FAMILY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day)
  );
}

function getDocumentAlertTitle(title: string, diffDays: number) {
  if (diffDays < 0) return `Documento vencido: ${title}`;
  if (diffDays === 0) return `Documento vence hoje: ${title}`;
  if (diffDays === 1) return `Documento vence amanhã: ${title}`;
  return `Documento vence em ${diffDays} dias: ${title}`;
}

function getDocumentAlertSeverity(diffDays: number) {
  if (diffDays < 0 || diffDays <= 7) return "critical" as const;
  if (diffDays <= 30) return "high" as const;
  return "medium" as const;
}

export function buildDocumentExpirationAlerts(
  documents: DocumentExpirationRow[],
  now = new Date()
): DashboardAlert[] {
  const today = todayEpoch(now);

  return documents
    .flatMap((document) => {
      if (!document.expiration_date) return [];

      const expiration = dateOnlyEpoch(document.expiration_date);
      if (!Number.isFinite(expiration)) return [];

      const diffDays = Math.round((expiration - today) / DAY_MS);
      if (diffDays > 90) return [];

      return [{
        id: `document-expiration-${document.id}`,
        title: getDocumentAlertTitle(document.title, diffDays),
        description: "Calculado pela validade atual do documento.",
        due_date: document.expiration_date,
        severity: getDocumentAlertSeverity(diffDays),
      }];
    })
    .sort((left, right) =>
      (left.due_date ?? "9999-12-31").localeCompare(
        right.due_date ?? "9999-12-31"
      )
    );
}

export function mergeDashboardAlerts(
  storedAlerts: DashboardAlert[],
  documentAlerts: DashboardAlert[],
  limit = 5
) {
  return [...storedAlerts, ...documentAlerts]
    .sort((left, right) =>
      (left.due_date ?? "9999-12-31").localeCompare(
        right.due_date ?? "9999-12-31"
      )
    )
    .slice(0, limit);
}
