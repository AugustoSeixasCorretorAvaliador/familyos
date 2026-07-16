import { runOcr } from "../services/document-processing.service";

export class OcrProvider {
  async runOcr(input: { fileName: string; mimeType: string; bytes: Uint8Array }) {
    return runOcr(input);
  }

  async reprocessDocument(input: { fileName: string; mimeType: string; bytes: Uint8Array }) {
    return runOcr(input);
  }
}
