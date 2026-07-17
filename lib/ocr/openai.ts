import "server-only";

import type OpenAI from "openai";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import { getOpenAIClient } from "@/lib/ai/openai-client";
import { getOcrConfig } from "@/lib/ocr/config";
import { OcrOperationalError } from "@/lib/ocr/errors";
import { buildOpenAIOcrPrompt, OPENAI_OCR_BASE_PROMPT } from "@/lib/ocr/prompts";
import {
  OPENAI_OCR_JSON_SCHEMA,
  parseOpenAIOcrPayload,
  payloadToSuggestion,
} from "@/lib/ocr/schema";
import type { OCRInput, OCRProvider, OCRResult } from "@/lib/ocr/types";

type ResponsesClient = Pick<OpenAI["responses"], "create">;

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function buildFileContent(input: OCRInput): ResponseInputContent {
  if (input.mimeType === "application/pdf") {
    return {
      type: "input_file",
      filename: input.fileName,
      file_data: `data:application/pdf;base64,${toBase64(input.bytes)}`,
      detail: "auto",
    };
  }

  if (input.mimeType === "image/tiff" || input.mimeType === "image/tif") {
    throw new OcrOperationalError("unsupported_format");
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(input.mimeType)) {
    throw new OcrOperationalError("unsupported_format");
  }

  return {
    type: "input_image",
    image_url: `data:${input.mimeType};base64,${toBase64(input.bytes)}`,
    detail: "high",
  };
}

function classifyOpenAIError(error: unknown, timedOut: boolean) {
  if (timedOut) {
    return new OcrOperationalError("timeout", { retryable: true });
  }

  const candidate =
    error && typeof error === "object"
      ? (error as {
          status?: unknown;
          code?: unknown;
          name?: unknown;
          request_id?: unknown;
          _request_id?: unknown;
        })
      : {};
  const requestId =
    typeof candidate.request_id === "string"
      ? candidate.request_id
      : typeof candidate._request_id === "string"
        ? candidate._request_id
        : null;
  if (candidate.status === 429 || candidate.code === "rate_limit_exceeded") {
    return new OcrOperationalError("rate_limit", { retryable: true, requestId });
  }
  if (candidate.name === "OpenAIConfigurationError") {
    return new OcrOperationalError("openai_not_configured");
  }
  if (error instanceof OcrOperationalError) return error;
  return new OcrOperationalError("provider_unavailable", { retryable: true, requestId });
}

export class OpenAIOcrProvider implements OCRProvider {
  readonly name = "openai";
  private readonly responses?: ResponsesClient;

  constructor(responses?: ResponsesClient) {
    this.responses = responses;
  }

  async process(input: OCRInput): Promise<OCRResult> {
    const config = getOcrConfig();
    if (!process.env.OPENAI_API_KEY?.trim() && !this.responses) {
      throw new OcrOperationalError("openai_not_configured");
    }
    if (input.bytes.byteLength > config.maxFileSizeBytes) {
      throw new OcrOperationalError("file_too_large");
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, config.timeoutMs);

    try {
      const responses = this.responses ?? getOpenAIClient().responses;
      const response = await responses.create(
        {
          model: config.openAIModel,
          instructions: OPENAI_OCR_BASE_PROMPT,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: buildOpenAIOcrPrompt(input.documentTypeHint),
                },
                buildFileContent(input),
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "familyos_document_ocr",
              description: "Extracao documental estruturada para revisao humana.",
              schema: OPENAI_OCR_JSON_SCHEMA,
              strict: true,
            },
          },
          max_output_tokens: 5_000,
          store: false,
        },
        {
          signal: controller.signal,
          maxRetries: config.maxRetries,
        }
      );

      const payload = parseOpenAIOcrPayload(response.output_text);
      const suggestion = payloadToSuggestion(payload);
      return {
        provider: this.name,
        model: config.openAIModel,
        rawText: payload.raw_text,
        suggestion,
        confidence: payload.overall_confidence,
        confidenceKind: "model_estimate",
        warnings: payload.warnings,
        requiresHumanReview: true,
        durationMs: Date.now() - startedAt,
        requestId: response._request_id ?? response.id ?? null,
        extractedFieldsCount: Object.keys(suggestion.fields).length,
      };
    } catch (error) {
      throw classifyOpenAIError(error, timedOut);
    } finally {
      clearTimeout(timer);
    }
  }
}
