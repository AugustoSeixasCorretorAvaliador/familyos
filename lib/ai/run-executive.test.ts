import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("@/lib/ai/openai-client", () => ({
  getExecutiveModel: () => "gpt-5-mini",
  getOpenAIClient: () => ({ responses: { create: mocks.create } }),
}));

vi.mock("@/lib/ai/tool-routing", () => ({
  selectExecutiveTools: () => [],
}));

vi.mock("@/lib/ai/tools", () => ({
  executeExecutiveTool: vi.fn(),
  executiveToolDefinitions: [],
  isExecutiveToolName: () => false,
}));

import { runExecutive } from "@/lib/ai/run-executive";
import type { ExecutiveToolContext } from "@/lib/ai/tools/types";

const context = {
  supabase: {},
  userId: "user-1",
  familyId: "family-1",
  now: new Date("2026-08-11T12:00:00Z"),
} as ExecutiveToolContext;

describe("runExecutive", () => {
  beforeEach(() => {
    mocks.create.mockReset();
  });

  it("continua e reúne a resposta quando o limite de saída interrompe o RX", async () => {
    mocks.create
      .mockResolvedValueOnce({
        status: "incomplete",
        incomplete_details: { reason: "max_output_tokens" },
        output_text: "Situação confirmada\n- Entradas registr",
        output: [],
      })
      .mockResolvedValueOnce({
        status: "completed",
        incomplete_details: null,
        output_text:
          "adas: R$ 1.000,00.\n- Saídas registradas: R$ 400,00.\nFontes consultadas: RX integrado.",
        output: [],
      });

    const result = await runExecutive("Faça um RX financeiro.", context);

    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(mocks.create.mock.calls[0][0].max_output_tokens).toBe(4000);
    expect(result.answer).toContain("Entradas registradas");
    expect(result.answer).not.toContain("registr\nadas");
    expect(result.answer).toContain("Saídas registradas");
    expect(result.answer).toContain("Fontes consultadas");
  });
});
