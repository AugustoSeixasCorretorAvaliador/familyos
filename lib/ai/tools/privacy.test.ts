import { describe, expect, it } from "vitest";
import { redactSensitiveText } from "@/lib/ai/tools/privacy";

describe("redactSensitiveText", () => {
  it("remove documentos e números longos de textos retornados à IA", () => {
    const redacted = redactSensitiveText(
      "CPF 123.456.789-00, conta bancaria 123456789012 e RG: AB123456"
    );

    expect(redacted).not.toContain("123.456.789-00");
    expect(redacted).not.toContain("123456789012");
    expect(redacted).not.toContain("AB123456");
    expect(redacted).toContain("[protegido]");
  });
});
