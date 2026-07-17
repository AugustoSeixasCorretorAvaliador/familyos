import { describe, expect, it } from "vitest";
import { resolveOCRProviderName } from "@/lib/ocr/selection";

describe("resolveOCRProviderName", () => {
  it("selects OpenAI when explicitly configured", () => {
    expect(
      resolveOCRProviderName({
        OCR_PROVIDER: "openai",
        OPENAI_API_KEY: "test-key",
      })
    ).toBe("openai");
  });

  it("falls back to OpenAI when the provider is absent and a key exists", () => {
    expect(resolveOCRProviderName({ OPENAI_API_KEY: "test-key" })).toBe("openai");
  });

  it("falls back to manual when the provider and key are absent", () => {
    expect(resolveOCRProviderName({})).toBe("manual");
  });

  it("keeps the legacy Google provider available", () => {
    expect(resolveOCRProviderName({ OCR_PROVIDER: "google_vision" })).toBe("google");
  });

  it("uses manual for an unknown provider instead of breaking uploads", () => {
    expect(resolveOCRProviderName({ OCR_PROVIDER: "unknown" })).toBe("manual");
  });
});
