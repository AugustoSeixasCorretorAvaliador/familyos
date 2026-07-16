export type OCRInput = {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
};

export type OCRResult = {
  provider: string;
  text: string;
  confidence: number;
  durationMs: number;
};

export interface OCRProvider {
  readonly name: string;
  extractText(input: OCRInput): Promise<OCRResult>;
}
