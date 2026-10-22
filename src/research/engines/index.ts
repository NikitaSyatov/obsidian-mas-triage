import { ResearchDeps, ResearchEngine } from "../types";
import { BaselineEngine } from "./BaselineEngine";
import { ReActEngine } from "./ReActEngine";

export { BaselineEngine } from "./BaselineEngine";
export { ReActEngine } from "./ReActEngine";

export const RESEARCH_ENGINE_IDS = ["baseline", "react"] as const;
export type ResearchEngineId = (typeof RESEARCH_ENGINE_IDS)[number];

/**
 * Factory for the research engines.
 *
 * TODO: add the remaining Deep Research techniques as separate engines.
 *  - CoT (chain-of-thought): single call with explicit reasoning scaffold.
 *    Reason for deferral: it needs the same retrieval contract as E0/E2 first,
 *    otherwise the comparison would confound "reasoning style" with "retrieval".
 *  - ToT (tree-of-thought): branching + self-evaluation of partial answers.
 *    Reason for deferral: needs a scoring/verifier model and a token budget
 *    that does not fit the per-call budget model used by ResearchDeps.
 *  - Self-Reflection: draft → critique → revise loop over the final answer.
 *    Reason for deferral: partially overlaps with ReAct's error-recovery, so
 *    it must be implemented as a post-processing stage to stay comparable.
 *  - LLM Compiler: DAG of research subtasks planned up front.
 *    Reason for deferral: needs a planner contract and a scheduler that maps
 *    subtasks onto the shared searchVault/readNote tools.
 */
export function createResearchEngine(id: string, deps?: Partial<ResearchDeps>): ResearchEngine {
  switch (id) {
    case "baseline":
      return new BaselineEngine();
    case "react":
      return new ReActEngine();
    default:
      throw new Error(`Unknown research engine: ${id}. Available: ${RESEARCH_ENGINE_IDS.join(", ")}`);
  }
}
