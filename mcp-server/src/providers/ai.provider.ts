export interface AIProvider {
  analyze(input: string): Promise<string>;
  summarize(input: string): Promise<string>;
  extract(input: string): Promise<Record<string, unknown>>;
  recommend(input: string): Promise<string[]>;
}

export class RuleBasedAIProvider implements AIProvider {
  async analyze(input: string): Promise<string> {
    return `analysis:${input.slice(0, 200)}`;
  }

  async summarize(input: string): Promise<string> {
    return input.slice(0, 500);
  }

  async extract(_input: string): Promise<Record<string, unknown>> {
    return {};
  }

  async recommend(_input: string): Promise<string[]> {
    return [];
  }
}
