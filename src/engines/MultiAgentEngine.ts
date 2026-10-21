import { TriageEngine } from "../types/engine";
import { Note } from "../types/note";
import { VaultContext } from "../types/vault-context";
import { TriageResult } from "../types/triage-result";
import { LlmClient } from "../llm/LlmClient";
import { MetricsCollector } from "../metrics/MetricsCollector";
import { ClassifierAgent } from "../agents/ClassifierAgent";
import { LinkerAgent } from "../agents/LinkerAgent";
import { ExtractorAgent } from "../agents/ExtractorAgent";
import { AggregatorAgent } from "../agents/AggregatorAgent";
import { AgentConfig, AgentOutput } from "../types/agent";

export class BudgetExceededError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = "BudgetExceededError";
  }
}

export type MultiAgentArchitecture = "centralized" | "sequential" | "parallel" | "debate";

export interface MultiAgentConfig {
  architecture: MultiAgentArchitecture;
  model?: string;
  maxTokensPerNote?: number;
  useSharedMemory: boolean;
  useMessaging: boolean;
  enabledAgents: ("classifier" | "linker" | "extractor")[];
  cotMode?: "none" | "checklist";
  totalBudgetUsd?: number;
  agentsConfig?: { model: string; temperature: number };
}

export class MultiAgentEngine implements TriageEngine {
  private classifier = new ClassifierAgent();
  private linker = new LinkerAgent();
  private extractor = new ExtractorAgent();
  private aggregator = new AggregatorAgent();

  constructor(private llm: LlmClient, private metrics: MetricsCollector, private config: MultiAgentConfig) {}

  async triage(note: Note, ctx: VaultContext): Promise<TriageResult> {
    const start = performance.now();
    if (this.config.architecture === "sequential" || this.config.architecture === "debate") {
      throw new Error(`Not implemented: ${this.config.architecture} — следующий этап`);
    }
    if (this.config.architecture !== "parallel") {
      throw new Error(`Not implemented: ${this.config.architecture} — следующий этап`);
    }

    if (typeof this.config.totalBudgetUsd === "number") {
      const est = (this.config.maxTokensPerNote || 1024) * (this.config.enabledAgents?.length || 1) * 0.00015; // rough est
      if (est > this.config.totalBudgetUsd) {
        throw new BudgetExceededError("Budget exceeded (estimate)");
      }
    }

    this.metrics.start(note.path, "mas-parallel");
    const agentConfig: AgentConfig = {
      model: this.config.agentsConfig?.model || this.config.model || "gpt-4o-mini",
      temperature: this.config.agentsConfig?.temperature ?? 0,
      maxTokensPerNote: this.config.maxTokensPerNote || 1024,
    };

    const tasks: Promise<AgentOutput>[] = [];
    if (this.config.enabledAgents?.includes("classifier")) {
      tasks.push(this.classifier.run(note, ctx, this.llm, agentConfig));
    }
    if (this.config.enabledAgents?.includes("linker")) {
      tasks.push(this.linker.run(note, ctx, this.llm, agentConfig));
    }
    if (this.config.enabledAgents?.includes("extractor")) {
      tasks.push(this.extractor.run(note, ctx, this.llm, agentConfig));
    }

    const outputs = await Promise.all(tasks);
    // TODO(next stage): shared state / message bus if useMessaging/useSharedMemory
    const result = this.aggregator.run(outputs);

    let inputTokens = 0;
    let outputTokens = 0;
    const agentBreakdown: any[] = [];
    for (const o of outputs) {
      inputTokens += o.usage.inputTokens || 0;
      outputTokens += o.usage.outputTokens || 0;
      agentBreakdown.push({ name: o.field, inputTokens: o.usage.inputTokens, outputTokens: o.usage.outputTokens, wallClockMs: o.wallClockMs });
    }

    this.metrics.end({ inputTokens, outputTokens }, { agentBreakdown, useMessaging: this.config.useMessaging, useSharedMemory: this.config.useSharedMemory });
    (result as any).wallClockMs = performance.now() - start;
    return result;
  }
}

export { StubEngine } from "./StubEngine";
export { SingleAgentEngine } from "./SingleAgentEngine";
export type { SingleAgentConfig } from "./SingleAgentEngine";
