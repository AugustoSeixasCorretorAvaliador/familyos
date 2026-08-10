import { describe, expect, it } from "vitest";
import { appendCursorTrail, collectCursorPages, decodeEntryCursor, encodeEntryCursor, previousCursorTrail } from "@/lib/finance/pagination";

describe("finance cursor pagination", () => {
  const first = encodeEntryCursor({ createdAt: "2026-07-26T12:00:00.000Z", id: "11111111-1111-4111-8111-111111111111" });
  const second = encodeEntryCursor({ createdAt: "2026-07-25T12:00:00.000Z", id: "22222222-2222-4222-8222-222222222222" });

  it("codifica e decodifica cursor estável", () => {
    expect(decodeEntryCursor(first)).toEqual({ createdAt: "2026-07-26T12:00:00.000Z", id: "11111111-1111-4111-8111-111111111111" });
  });

  it("rejeita cursor adulterado", () => {
    expect(decodeEntryCursor("family_id=outra-familia")).toBeNull();
  });

  it("mantém trilha para avançar e voltar sem repetir página", () => {
    const trail = appendCursorTrail(appendCursorTrail(undefined, first), second);
    expect(previousCursorTrail(trail)).toEqual({ trail: first, cursor: first });
  });

  it("coleta mais de mil registros sem depender do limite de uma resposta", async () => {
    const source = Array.from({ length: 1_377 }, (_, index) => ({ id: String(index).padStart(4, "0") }));
    const pages: Array<{ after: string | null; limit: number }> = [];
    const rows = await collectCursorPages(async (after, limit) => {
      pages.push({ after, limit });
      const start = after === null ? 0 : source.findIndex((row) => row.id === after) + 1;
      return source.slice(start, start + limit);
    }, (row) => row.id, 500);

    expect(rows).toEqual(source);
    expect(pages).toEqual([
      { after: null, limit: 500 },
      { after: "0499", limit: 500 },
      { after: "0999", limit: 500 },
    ]);
  });
});
