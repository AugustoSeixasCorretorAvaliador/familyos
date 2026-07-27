import { describe, expect, it } from "vitest";
import { appendCursorTrail, decodeEntryCursor, encodeEntryCursor, previousCursorTrail } from "@/lib/finance/pagination";

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
});
