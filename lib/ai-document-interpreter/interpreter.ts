import { parseDocumentText } from "@/lib/document-parser/parser";
import type {
  DocumentInterpreter,
  DocumentInterpreterInput,
  DocumentInterpreterOutput,
} from "@/lib/ai-document-interpreter/types";

class RuleBasedDocumentInterpreter implements DocumentInterpreter {
  readonly name = "rule_based_v1";

  async interpret(input: DocumentInterpreterInput): Promise<DocumentInterpreterOutput> {
    const suggestion = parseDocumentText(input.rawText);
    return {
      provider: this.name,
      suggestion,
    };
  }
}

export function getDocumentInterpreter(): DocumentInterpreter {
  // Future switch: openai | gemini | claude | llama
  return new RuleBasedDocumentInterpreter();
}
