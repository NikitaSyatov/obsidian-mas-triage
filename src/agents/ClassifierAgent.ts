import { Note } from "../types/note";
import { VaultContext } from "../types/vault-context";
import { LlmClient } from "../llm/LlmClient";
import { Agent, AgentConfig, AgentOutput } from "../types/agent";
import { loadPrompt, parseAgentJson } from "./parseJson";

export class ClassifierAgent implements Agent {
  readonly name = "classifier";

  async run(note: Note, ctx: VaultContext, llm: LlmClient, config: AgentConfig): Promise<AgentOutput> {
    const start = performance.now();
    const systemPrompt = loadPrompt("classifier.system.md");
    const userPrompt = [
      "Note:",
      note.content,
      "",
      "Folders:",
      JSON.stringify(ctx.folders),
      "",
      "Tags:",
      JSON.stringify(ctx.tags),
    ].join("\n");
    const res = await llm.complete(systemPrompt, userPrompt, { model: config.model, maxTokens: config.maxTokensPerNote, temperature: config.temperature });
    const parsed = parseAgentJson(res.text);
    let folder = "";
    let tags: string[] = [];
    let confidence = 0;
    let reasoningSteps: string[] = [];
    if (parsed.ok && parsed.data) {
      const d = parsed.data;
      reasoningSteps = Array.isArray(d.reasoning_steps) ? d.reasoning_steps : [];
      if (typeof d.folder === "string" && ctx.folders.includes(d.folder)) {
        folder = d.folder;
      } else if (typeof d.folder === "string") {
        confidence -= 0.2;
      }
      if (Array.isArray(d.tags)) {
        for (const t of d.tags) {
          if (typeof t === "string" && ctx.tags.includes(t)) {
            tags.push(t);
          } else {
            confidence -= 0.1;
          }
        }
        tags = Array.from(new Set(tags)).slice(0, 4);
      }
      if (typeof d.confidence === "number") confidence = Math.max(0, Math.min(1, d.confidence + confidence));
      else confidence = Math.max(0, Math.min(1, 0.5 + confidence));
    } else {
      confidence = 0;
    }
    return {
      field: "classification",
      value: { folder, tags },
      confidence,
      reasoningSteps,
      usage: res.usage,
      wallClockMs: performance.now() - start,
      rawText: res.text,
    };
  }
}
