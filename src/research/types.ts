import { Vault } from "../types/vault";
import { LlmClient } from "../llm/LlmClient";
import { MetricsCollector } from "../metrics/MetricsCollector";
import { SearchIndex } from "./tools/search";

export interface GoldFact {
  id: string;
  description: string;
  keyword: string;
  sourceNote: string;
  expected: boolean;
}

export interface GoldContradiction {
  id: string;
  description: string;
  noteA: string;
  noteB: string;
}

export interface ResearchQuestion {
  id: string;
  text: string;
  gold: {
    expectedFacts: GoldFact[];
    expectedContradictions: GoldContradiction[];
    expectedGaps: string[];
  };
}

export interface SearchHit {
  title: string;
  path: string;
  snippet: string;
  score: number;
}

export interface ResearchTraceStep {
  stepIndex: number;
  type: "thought" | "action" | "observation" | "final";
  content: string;
  tool?: "search" | "read";
  toolInput?: any;
  toolOutput?: any;
  usage?: { inputTokens: number; outputTokens: number };
}

export interface ResearchTrace {
  steps: ResearchTraceStep[];
}

export interface ResearchAnswer {
  text: string;
  citations: string[];
  gaps: string[];
  trace: ResearchTrace;
  usage: { inputTokens: number; outputTokens: number; costUsd: number; wallClockMs: number };
}

export interface ResearchDeps {
  vault: Vault;
  llm: LlmClient;
  metrics: MetricsCollector;
  searchIndex: SearchIndex;
  budget: { maxUsd: number; maxLlmCalls: number };
  config: { model: string; maxTokensPerCall: number; maxSteps?: number };
}

export interface ResearchEngine {
  readonly id: string;
  solve(question: ResearchQuestion, deps: ResearchDeps): Promise<ResearchAnswer>;
}
