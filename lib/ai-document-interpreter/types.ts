import type { DocumentSuggestion } from "@/lib/document-parser/types";

export type DocumentInterpreterInput = {
  rawText: string;
};

export type DocumentInterpreterOutput = {
  provider: string;
  suggestion: DocumentSuggestion;
};

export interface DocumentInterpreter {
  readonly name: string;
  interpret(input: DocumentInterpreterInput): Promise<DocumentInterpreterOutput>;
}
