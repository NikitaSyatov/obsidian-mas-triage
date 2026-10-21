import { TriageEngine } from "../types/engine";
import { StubEngine } from "./StubEngine";
import { SingleAgentEngine } from "./SingleAgentEngine";
import { MultiAgentEngine } from "./MultiAgentEngine";
import { LlmClient } from "../llm/LlmClient";
import { MetricsCollector } from "../metrics/MetricsCollector";

export function createEngine(config: any, deps: { llm: LlmClient; metrics: MetricsCollector }) {
  const engineId = config.engineId || config.architecture || "";
  if (engineId === "stub" || config.engine === "stub") {
    return new StubEngine();
  }
  if (engineId === "single-agent" || engineId === "baseline_single_agent") {
    return new SingleAgentEngine(deps.llm, deps.metrics, {
      model: config.model || "gpt-4o-mini",
      maxTokensPerNote: config.maxTokensPerNote || 1024,
      temperature: 0,
    });
  }
  if (engineId === "mas-parallel" || config.architecture === "parallel") {
    return new MultiAgentEngine(deps.llm, deps.metrics, {
      architecture: "parallel",
      model: config.model,
      maxTokensPerNote: config.maxTokensPerNote,
      useSharedMemory: config.ablations?.useSharedMemory ?? true,
      useMessaging: config.ablations?.useMessaging ?? false,
      enabledAgents: config.ablations?.enabledAgents || ["classifier", "linker", "extractor"],
      cotMode: config.cotMode || "checklist",
      totalBudgetUsd: config.totalBudgetUsd,
      agentsConfig: { model: config.model || "gpt-4o-mini", temperature: 0 },
    });
  }
  if (config.architecture === "sequential" || config.architecture === "debate") {
    // will throw in engine
    return new MultiAgentEngine(deps.llm, deps.metrics, {
      architecture: config.architecture,
      model: config.model,
      maxTokensPerNote: config.maxTokensPerNote,
      useSharedMemory: config.ablations?.useSharedMemory ?? false,
      useMessaging: config.ablations?.useMessaging ?? false,
      enabledAgents: config.ablations?.enabledAgents || ["classifier", "linker", "extractor"],
      cotMode: config.cotMode || "checklist",
    });
  }
  return new StubEngine();
}

export { StubEngine } from "./StubEngine";
export { SingleAgentEngine } from "./SingleAgentEngine";
export { MultiAgentEngine } from "./MultiAgentEngine";
export { BudgetExceededError } from "./MultiAgentEngine";
export type { MultiAgentArchitecture, MultiAgentConfig } from "./MultiAgentEngine";
export type { SingleAgentConfig } from "./SingleAgentEngine";
