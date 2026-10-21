import { TriageEngine } from "../types/engine";
import { Note } from "../types/note";
import { VaultContext } from "../types/vault-context";
import { TriageResult } from "../types/triage-result";
import { LlmClient } from "../llm/LlmClient";
import { MetricsCollector } from "../metrics/MetricsCollector";
import * as fs from "fs";
import * as path from "path";

export interface SingleAgentConfig {
  model: string;
  maxTokensPerNote: number;
  temperature?: number;
}

export class SingleAgentEngine implements TriageEngine {
  constructor(private llm: LlmClient, private metrics: MetricsCollector, private config: SingleAgentConfig) {}

  private loadSystemPrompt(): string {
    try {
      const promptPath = path.resolve(process.cwd(), "prompts/single_agent.system.md");
      if (fs.existsSync(promptPath)) {
        return fs.readFileSync(promptPath, "utf-8");
      }
    } catch (e) {
      // ignore
    }
    return "You are an assistant for inbox triage. Return strictly valid JSON only.";
  }

  private buildUserPrompt(note: Note, ctx: VaultContext): string {
    return [
      "Note:",
      note.content,
      "",
      "Existing folders:",
      JSON.stringify(ctx.folders),
      "",
      "Top tags:",
      JSON.stringify(ctx.tags),
      "",
      "Existing note titles:",
      JSON.stringify(ctx.noteTitles),
    ].join("\n");
  }

  private validateAndFilter(result: any, ctx: VaultContext): TriageResult {
    let folder = typeof result.folder === "string" ? result.folder : "";
    if (!ctx.folders.includes(folder)) {
      folder = ctx.folders[0] || "";
    }

    let tags = Array.isArray(result.tags) ? result.tags.filter((t: any) => typeof t === "string" && ctx.tags.includes(t)) : [];
    if (tags.length > 4) tags = tags.slice(0, 4);

    let links = Array.isArray(result.links) ? result.links.filter((l: any) => typeof l === "string" && ctx.noteTitles.includes(l)) : [];

    const entities = result.entities && typeof result.entities === "object" ? result.entities : { people: [], projects: [], dates: [], concepts: [] };

    let confidence = typeof result.confidence === "number" ? result.confidence : 0;
    if (!ctx.folders.includes(result.folder)) confidence = Math.min(confidence, 0.4);
    if (tags.length === 0 && Array.isArray(result.tags) && result.tags.length > 0) confidence = Math.min(confidence, 0.4);

    return {
      folder,
      tags,
      links,
      entities: {
        people: Array.isArray(entities.people) ? entities.people : [],
        projects: Array.isArray(entities.projects) ? entities.projects : [],
        dates: Array.isArray(entities.dates) ? entities.dates : [],
        concepts: Array.isArray(entities.concepts) ? entities.concepts : [],
      },
      confidence,
      reasoning: result.reasoning,
    };
  }

  async triage(note: Note, ctx: VaultContext): Promise<TriageResult> {
    this.metrics.start(note.path, "single-agent");
    try {
      const systemPrompt = this.loadSystemPrompt();
      const userPrompt = this.buildUserPrompt(note, ctx);
      const res = await this.llm.complete(systemPrompt, userPrompt, {
        model: this.config.model,
        maxTokens: this.config.maxTokensPerNote,
        temperature: this.config.temperature ?? 0,
      });
      this.metrics.end({ inputTokens: res.usage.inputTokens, outputTokens: res.usage.outputTokens });

      try {
        const parsed = JSON.parse(res.text);
        return this.validateAndFilter(parsed, ctx);
      } catch (e: any) {
        return {
          folder: ctx.folders[0] || "",
          tags: [],
          links: [],
          entities: { people: [], projects: [], dates: [], concepts: [] },
          confidence: 0,
          reasoning: `parse error: ${String(e.message).slice(0, 100)}`,
        };
      }
    } catch (e: any) {
      this.metrics.end({ inputTokens: 0, outputTokens: 0 });
      throw e;
    }
  }
}
