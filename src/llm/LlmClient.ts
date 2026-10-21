export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmCompleteResult {
  text: string;
  usage: LlmUsage;
}

export interface LlmClient {
  complete(systemPrompt: string, userPrompt: string, opts?: { model?: string; maxTokens?: number; temperature?: number }): Promise<LlmCompleteResult>;
}

export class OpenAiLlmClient implements LlmClient {
  constructor(private apiKey?: string, private baseUrl: string = "https://api.openai.com/v1/chat/completions", private defaultModel: string = "gpt-4o-mini") {}

  async complete(systemPrompt: string, userPrompt: string, opts: { model?: string; maxTokens?: number; temperature?: number } = {}): Promise<LlmCompleteResult> {
    const model = opts.model || this.defaultModel;
    const maxTokens = opts.maxTokens ?? 1024;
    const temperature = opts.temperature ?? 0;

    const body = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature,
    };

    const res = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM request failed: ${res.status} ${text}`);
    }

    const data = await res.json();
    const message = data.choices?.[0]?.message?.content || "";
    const usage = data.usage || {};
    return {
      text: typeof message === "string" ? message : JSON.stringify(message),
      usage: {
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
      },
    };
  }
}
