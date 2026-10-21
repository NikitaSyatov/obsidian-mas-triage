export interface AgentConfig {
  model: string;
  temperature: number;
  maxTokensPerNote: number;
}

export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AgentOutput {
  field: string;
  value: unknown;
  confidence: number;
  reasoningSteps: string[];
  usage: AgentUsage;
  wallClockMs: number;
  rawText: string;
}

export interface Agent {
  readonly name: string;
  run(note: Note, ctx: VaultContext, llm: LlmClient, config: AgentConfig): Promise<AgentOutput>;
}
import { Note } from "./note";
import { VaultContext } from "./vault-context";
import { LlmClient } from "../llm/LlmClient";
