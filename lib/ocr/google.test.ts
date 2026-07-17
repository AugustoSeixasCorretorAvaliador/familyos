import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleVisionOCRProvider } from "@/lib/ocr/google";

describe("GoogleVisionOCRProvider legacy compatibility", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("adapts the existing Google response to the common structured contract", async () => {
    vi.stubEnv("GOOGLE_VISION_API_KEY", "google-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          responses: [
            {
              fullTextAnnotation: {
                text: "CARTEIRA NACIONAL DE HABILITACAO\nCPF: 000.000.000-00",
                pages: [{ confidence: 0.93 }],
              },
            },
          ],
        }),
      })
    );

    const result = await new GoogleVisionOCRProvider().process({
      fileName: "legacy.png",
      mimeType: "image/png",
      bytes: new Uint8Array([1]),
    });

    expect(result.provider).toBe("google_vision");
    expect(result.suggestion.detectedType).toBe("CNH");
    expect(result.confidence).toBe(0.93);
    expect(result.rawText).toContain("CPF");
  });
});
