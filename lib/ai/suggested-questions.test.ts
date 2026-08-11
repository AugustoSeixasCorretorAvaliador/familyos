import { describe, expect, it } from "vitest";
import {
  executiveQuestionGroups,
  quickExecutiveQuestions,
} from "@/lib/ai/suggested-questions";

describe("executive question catalog", () => {
  it("oferece dez perguntas em cada módulo", () => {
    expect(executiveQuestionGroups.length).toBeGreaterThanOrEqual(10);
    for (const group of executiveQuestionGroups) {
      expect(group.questions).toHaveLength(10);
    }
  });

  it("não repete perguntas dentro da biblioteca e preserva os atalhos", () => {
    const questions = executiveQuestionGroups.flatMap((group) => [...group.questions]);
    expect(new Set(questions).size).toBe(questions.length);
    for (const question of quickExecutiveQuestions) {
      expect(questions).toContain(question);
    }
  });
});
