import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { listPeople, listProperties } from "@/lib/ai/tools/queries";
import type { ExecutiveToolContext } from "@/lib/ai/tools/types";

function scopedContext(rows: unknown[]) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder = {
    select(...args: unknown[]) {
      calls.push({ method: "select", args });
      return builder;
    },
    eq(...args: unknown[]) {
      calls.push({ method: "eq", args });
      return builder;
    },
    is(...args: unknown[]) {
      calls.push({ method: "is", args });
      return builder;
    },
    order(...args: unknown[]) {
      calls.push({ method: "order", args });
      return builder;
    },
    async limit(...args: unknown[]) {
      calls.push({ method: "limit", args });
      return { data: rows, error: null };
    },
  };
  const supabase = {
    from(...args: unknown[]) {
      calls.push({ method: "from", args });
      return builder;
    },
  } as unknown as SupabaseClient;
  const context: ExecutiveToolContext = {
    supabase,
    familyId: "family-from-session",
    userId: "current-user",
    now: new Date("2026-07-17T12:00:00.000Z"),
  };
  return { calls, context };
}

describe("executive query scope", () => {
  it("filtra pessoas exclusivamente pela família da sessão", async () => {
    const { calls, context } = scopedContext([]);

    await listPeople(context);

    expect(calls).toContainEqual({
      method: "eq",
      args: ["family_id", "family-from-session"],
    });
    const selection = String(
      calls.find((call) => call.method === "select")?.args[0] ?? ""
    );
    expect(selection).not.toMatch(/cpf|email|phone|document/i);
  });

  it("filtra imóveis exclusivamente pela família da sessão", async () => {
    const { calls, context } = scopedContext([]);

    await listProperties(context);

    expect(calls).toContainEqual({
      method: "eq",
      args: ["family_id", "family-from-session"],
    });
  });
});
