import { describe, expect, it } from "vitest";
import { ManualOCRProvider } from "@/lib/ocr/manual";

describe("ManualOCRProvider", () => {
  it("preserves the document for human completion without automatic extraction", async () => {
    const result = await new ManualOCRProvider().process();

    expect(result.provider).toBe("manual");
    expect(result.extractedFieldsCount).toBe(0);
    expect(result.requiresHumanReview).toBe(true);
  });
});
