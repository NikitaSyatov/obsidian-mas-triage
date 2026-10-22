import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { FsVaultAdapter } from "../../src/vault/FsVaultAdapter";
import { buildSearchIndex, searchVault } from "../../src/research/tools/search";
import { BaselineEngine } from "../../src/research/engines/BaselineEngine";
import { ReActEngine } from "../../src/research/engines/ReActEngine";
import { evaluateResearch } from "../../src/research/evaluate";
import { ResearchDeps, ResearchQuestion } from "../../src/research/types";
import { MetricsCollector } from "../../src/metrics/MetricsCollector";
import { ResearchMockLlm } from "../../src/research/mock/ResearchMockLlm";

const VAULT_ROOT = path.resolve(__dirname, "../../datasets/research/vault");
const GOLD_PATH = path.resolve(__dirname, "../../datasets/research/gold/question_alpha.json");

function loadVault() {
  const vault = new FsVaultAdapter(VAULT_ROOT, "00-Inbox");
  const refs = vault.listAllNotes();
  return { vault, refs };
}

async function buildIndex(vault: FsVaultAdapter, refs: { path: string }[]) {
  const notes = [];
  for (const r of refs) notes.push(await vault.readNote(r));
  return buildSearchIndex(notes);
}

function depsFor(vault: FsVaultAdapter, index: any, llm: any, over: Partial<ResearchDeps> = {}): ResearchDeps {
  const metrics = new MetricsCollector();
  metrics.setRunMeta({ model: "gpt-4o-mini", runId: "test", configHash: "x", seed: 42 });
  return {
    vault,
    llm,
    metrics,
    searchIndex: index,
    budget: { maxUsd: 0.05, maxLlmCalls: 6 },
    config: { model: "gpt-4o-mini", maxTokensPerCall: 800, maxSteps: 6 },
    ...over,
  };
}

describe("alias trap (integration)", () => {
  it("the dataset exists and the gold file is valid", () => {
    expect(fs.existsSync(VAULT_ROOT)).toBe(true);
    const gold = JSON.parse(fs.readFileSync(GOLD_PATH, "utf-8"));
    expect(gold.id).toBe("question_alpha");
    expect(gold.gold.expectedFacts.length).toBe(5);
    expect(gold.gold.expectedContradictions.length).toBe(2);
    expect(gold.gold.expectedGaps.length).toBe(1);
  });

  it("retrieval cannot reach Daily/2025-01-15.md by 'Alpha' but can by 'A-Project'", async () => {
    const { vault, refs } = loadVault();
    const index = await buildIndex(vault, refs);

    const byAlpha = searchVault("Alpha", 10, index).map((h) => h.path);
    expect(byAlpha).not.toContain("Daily/2025-01-15.md");

    const byAlias = searchVault("A-Project", 5, index).map((h) => h.path);
    expect(byAlias).toContain("Daily/2025-01-15.md");
  });

  it("baseline misses F4 while react finds it", async () => {
    const { vault, refs } = loadVault();
    const index = await buildIndex(vault, refs);
    const question: ResearchQuestion = JSON.parse(fs.readFileSync(GOLD_PATH, "utf-8"));

    const baseline = new BaselineEngine();
    const baselineAnswer = await baseline.solve(
      question,
      depsFor(vault, index, new ResearchMockLlm("baseline"), { budget: { maxUsd: 0.05, maxLlmCalls: 1 } }),
    );
    const baselineEval = evaluateResearch(baselineAnswer, question.gold);

    const react = new ReActEngine();
    const reactAnswer = await react.solve(
      question,
      depsFor(vault, index, new ResearchMockLlm("react")),
    );
    const reactEval = evaluateResearch(reactAnswer, question.gold);

    // the trap: F4 (React, decided in the alias-only note) is unreachable for the baseline
    expect(baselineEval.coverage).toBeLessThan(1);
    expect(baselineEval.missedFacts).toContain("F4");
    expect(baselineAnswer.citations).not.toContain("Daily/2025-01-15.md");

    // react follows the alias chain and covers everything
    expect(reactEval.coverage).toBe(1);
    expect(reactEval.missedFacts).toEqual([]);
    expect(reactAnswer.citations).toContain("Daily/2025-01-15.md");

    // contradictions: only react sees both sides of C2
    expect(baselineEval.contradictionsFound).toEqual(["C1"]);
    expect(reactEval.contradictionsFound).toEqual(["C1", "C2"]);
  });

  it("react keeps a trace of the alias chain", async () => {
    const { vault, refs } = loadVault();
    const index = await buildIndex(vault, refs);
    const question: ResearchQuestion = JSON.parse(fs.readFileSync(GOLD_PATH, "utf-8"));

    const react = new ReActEngine();
    const answer = await react.solve(question, depsFor(vault, index, new ResearchMockLlm("react")));

    const actions = answer.trace.steps.filter((s) => s.type === "action").map((s) => s.toolInput);
    expect(actions).toContain("Alpha");
    expect(actions).toContain("A-Project");
    expect(answer.trace.steps[answer.trace.steps.length - 1].type).toBe("final");
  });

  it("baseline makes exactly one LLM call, react more than one", async () => {
    const { vault, refs } = loadVault();
    const index = await buildIndex(vault, refs);
    const question: ResearchQuestion = JSON.parse(fs.readFileSync(GOLD_PATH, "utf-8"));

    let baseCalls = 0;
    const countingBase = {
      complete: async () => {
        baseCalls++;
        return { text: JSON.stringify({ answer: "", citations: [], gaps: [] }), usage: { inputTokens: 1, outputTokens: 1 } };
      },
    };
    await new BaselineEngine().solve(question, depsFor(vault, index, countingBase));
    expect(baseCalls).toBe(1);

    let reactCalls = 0;
    const countingReact = {
      complete: async () => {
        reactCalls++;
        return { text: JSON.stringify({ thought: "t", action: "search", actionInput: "Alpha", finalAnswer: null }), usage: { inputTokens: 1, outputTokens: 1 } };
      },
    };
    await new ReActEngine().solve(
      question,
      depsFor(vault, index, countingReact, { config: { model: "gpt-4o-mini", maxTokensPerCall: 800, maxSteps: 3 } }),
    );
    expect(reactCalls).toBe(3);
  });
});
