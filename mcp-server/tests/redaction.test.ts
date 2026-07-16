import { describe, expect, it } from "vitest";
import { summarizeInput } from "../src/utils/redaction";

describe("audit redaction", () => {
  it("masks secrets and document payloads", () => {
    const result = summarizeInput({
      authorization: "Bearer secret-token",
      contentBase64: "abcd",
      nested: { cpf: "123.456.789-09", publicValue: "ok" },
    });

    expect(result.authorization).toBe("Bearer [masked]");
    expect(result.contentBase64).toBe("[masked]");
    expect((result.nested as Record<string, unknown>).cpf).not.toBe("123.456.789-09");
    expect((result.nested as Record<string, unknown>).publicValue).toBe("ok");
  });
});
