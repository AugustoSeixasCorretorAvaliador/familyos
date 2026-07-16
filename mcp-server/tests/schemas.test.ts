import { describe, expect, it } from "vitest";
import { CalendarEventSchema, UploadDocumentSchema } from "../src/tools/schemas";

describe("tool schemas", () => {
  it("accepts a valid document upload payload", () => {
    const parsed = UploadDocumentSchema.safeParse({
      documentType: "RG",
      fileName: "rg.png",
      mimeType: "image/png",
      contentBase64: Buffer.from("fake").toString("base64"),
    });

    expect(parsed.success).toBe(true);
  });

  it("requires calendar event title, start, and end", () => {
    expect(CalendarEventSchema.safeParse({ title: "Consulta" }).success).toBe(false);
    expect(CalendarEventSchema.safeParse({
      title: "Consulta",
      start: "2026-07-20T10:00:00-03:00",
      end: "2026-07-20T11:00:00-03:00",
    }).success).toBe(true);
  });
});
