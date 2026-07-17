import "server-only";

import OpenAI from "openai";

export class OpenAIConfigurationError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not configured");
    this.name = "OpenAIConfigurationError";
  }
}

let client: OpenAI | null = null;

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new OpenAIConfigurationError();
  }

  if (!client) {
    client = new OpenAI({ apiKey });
  }

  return client;
}

export function getExecutiveModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
}
