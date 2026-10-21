import { Note } from "../types/note";
import { VaultContext } from "../types/vault-context";
import { LlmClient } from "../llm/LlmClient";
import { Agent, AgentConfig, AgentOutput } from "../types/agent";
import { loadPrompt, parseAgentJson } from "./parseJson";

export class ExtractorAgent implements Agent {
  readonly name = "extractor";

  async run(note: Note, ctx: VaultContext, llm: LlmClient, config: AgentConfig): Promise<AgentOutput> {
    const start = performance.now();
    const systemPrompt = loadPrompt("extractor.system.md");
    const userPrompt = ["Note:", note.content].join("\n");
    const res = await llm.complete(systemPrompt, userPrompt, { model: config.model, maxTokens: config.maxTokensPerNote, temperature: config.temperature });
    const parsed = parseAgentJson(res.text);
    let entities: any[] = [];
    let confidence = 0;
    let reasoningSteps: string[] = [];
    if (parsed.ok && parsed.data) {
      const d = parsed.data;
      reasoningSteps = Array.isArray(d.reasoning_steps) ? d.reasoning_steps : [];
      if (Array.isArray(d.entities)) {
        for (const e of d.entities) {
          if (e && typeof e === "object" && ["person", "project", "date", "concept"].includes(e.type) && typeof e.value === "string") {
            entities.push({ type: e.type, value: e.value });
          } else {
            confidence -= 0.1;
          }
        }
      }
      if (typeof d.confidence === "number") confidence = Math.max(0, Math.min(1, d.confidence + confidence));
      else confidence = Math.max(0, Math.min(1, 0.5 + confidence));
    } else {
      confidence = 0;
    }
    entities = Array.from(new Map(entities.map((e) => [`${e.type}:${e.value}`, e])).values());
    return {
      field: "entities",
      value: entities,
      confidence,
      reasoningSteps,
      usage: res.usage,
      wallClockMs: performance.now() - start,
      rawText: res.text,
    };
  }
}
