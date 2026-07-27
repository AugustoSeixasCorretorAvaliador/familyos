import type { FinancialEntryCursor } from "@/lib/finance/types";

export function encodeEntryCursor(cursor: FinancialEntryCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeEntryCursor(value?: string | null): FinancialEntryCursor | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<FinancialEntryCursor>;
    if (typeof decoded.createdAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(decoded.createdAt)) return null;
    if (typeof decoded.id !== "string" || !/^[0-9a-f-]{36}$/i.test(decoded.id)) return null;
    return { createdAt: decoded.createdAt, id: decoded.id };
  } catch {
    return null;
  }
}

export function appendCursorTrail(trail: string | undefined, cursor: string) {
  return [...(trail ? trail.split("~").filter(Boolean) : []), cursor].join("~");
}

export function previousCursorTrail(trail?: string) {
  const items = trail ? trail.split("~").filter(Boolean) : [];
  items.pop();
  return { trail: items.join("~"), cursor: items.at(-1) ?? null };
}
