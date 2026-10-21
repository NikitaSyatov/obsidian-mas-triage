import { LlmClient, LlmCompleteResult } from "../../src/llm/LlmClient";

export class MockLlmClient implements LlmClient {
  constructor(private responses: Array<{ match?: RegExp; text: string; usage?: { inputTokens: number; outputTokens: number } }> = []) {}

  async complete(systemPrompt: string, userPrompt: string, opts?: any): Promise<LlmCompleteResult> {
    for (const r of this.responses) {
      if (!r.match || r.match.test(userPrompt) || r.match.test(systemPrompt)) {
        return {
          text: r.text,
          usage: r.usage || { inputTokens: 10, outputTokens: 5 },
        };
      }
    }
    if (this.responses.length > 0) {
      return {
        text: this.responses[0].text,
        usage: this.responses[0].usage || { inputTokens: 10, outputTokens: 5 },
      };
    }
    throw new Error("MockLlmClient: no matching response");
  }
}
