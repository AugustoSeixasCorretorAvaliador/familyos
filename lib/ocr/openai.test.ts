import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { OpenAIOcrProvider } from "@/lib/ocr/openai";
import { OCR_FIELD_KEYS, type OpenAIOcrPayload } from "@/lib/ocr/schema";

function payload(): OpenAIOcrPayload {
  return {
    document_type: "CNH",
    raw_text: "CONTEUDO SANITIZADO",
    fields: Object.fromEntries(
      OCR_FIELD_KEYS.map((key) => [key, { value: null, confidence: null }])
    ) as OpenAIOcrPayload["fields"],
    warnings: [],
    requires_human_review: true,
    overall_confidence: 0.9,
  };
}

function imageInput() {
  return {
    fileName: "documento.png",
    mimeType: "image/png",
    bytes: new Uint8Array([1, 2, 3]),
    documentTypeHint: "CNH",
  };
}

function providerWith(create: ReturnType<typeof vi.fn>) {
  return new OpenAIOcrProvider({ create: create as never });
}

describe("OpenAIOcrProvider", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key-not-real");
    vi.stubEnv("OPENAI_OCR_MODEL", "gpt-5-mini");
    vi.stubEnv("OCR_MAX_RETRIES", "3");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("returns validated structured extraction and operational metadata", async () => {
    const responsePayload = payload();
    responsePayload.fields.numero = { value: "001234", confidence: 0.99 };
    const create = vi.fn().mockResolvedValue({
      id: "resp_test_123",
      _request_id: "req_test_123",
      output_text: JSON.stringify(responsePayload),
    });

    const result = await providerWith(create).process(imageInput());

    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-5-mini");
    expect(result.suggestion.fields.numero).toBe("001234");
    expect(result.confidenceKind).toBe("model_estimate");
    expect(result.requestId).toBe("req_test_123");
    expect(create.mock.calls[0]?.[1]).toMatchObject({ maxRetries: 3 });
  });

  it("uses the official file input for PDFs", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "resp_pdf",
      output_text: JSON.stringify(payload()),
    });

    await providerWith(create).process({
      ...imageInput(),
      fileName: "documento.pdf",
      mimeType: "application/pdf",
    });

    const request = create.mock.calls[0]?.[0] as {
      input: Array<{ content: Array<{ type: string; file_data?: string }> }>;
    };
    expect(request.input[0]?.content[1]).toMatchObject({
      type: "input_file",
      file_data: expect.stringMatching(/^data:application\/pdf;base64,/),
    });
  });

  it("maps rate limits to a safe operational error", async () => {
    const create = vi.fn().mockRejectedValue({ status: 429, request_id: "req_rate" });
    await expect(providerWith(create).process(imageInput())).rejects.toMatchObject({
      code: "rate_limit",
      requestId: "req_rate",
    });
  });

  it("rejects an invalid provider response", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "resp_invalid",
      output_text: "{}",
    });
    await expect(providerWith(create).process(imageInput())).rejects.toMatchObject({
      code: "invalid_response",
    });
  });

  it("aborts a request that exceeds the configured timeout", async () => {
    vi.useFakeTimers();
    vi.stubEnv("OCR_TIMEOUT_MS", "5000");
    const create = vi.fn(
      (_request: unknown, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () =>
            reject({ name: "APIUserAbortError" })
          );
        })
    );

    const pending = providerWith(create).process(imageInput());
    const assertion = expect(pending).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
  });

  it("does not expose upstream contents or credentials in errors", async () => {
    const create = vi
      .fn()
      .mockRejectedValue(new Error("upstream included test-key-not-real"));

    const error = await providerWith(create).process(imageInput()).catch((caught) => caught);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain("test-key-not-real");
  });

  it("returns a clear error for TIFF without deleting or transforming the source", async () => {
    const create = vi.fn();
    await expect(
      providerWith(create).process({
        ...imageInput(),
        fileName: "documento.tiff",
        mimeType: "image/tiff",
      })
    ).rejects.toMatchObject({ code: "unsupported_format" });
    expect(create).not.toHaveBeenCalled();
  });
});
