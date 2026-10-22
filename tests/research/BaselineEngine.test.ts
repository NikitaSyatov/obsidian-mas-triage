import { describe, it, expect } from "vitest";
import { buildSearchIndex } from "../../src/research/tools/search";
import { BaselineEngine } from "../../src/research/engines/BaselineEngine";
import { ResearchDeps, ResearchQuestion } from "../../src/research/types";
import { MetricsCollector } from "../../src/metrics/MetricsCollector";
import { MockLlmClient } from "../mocks/MockLlmClient";

const NOTES = [
  { path: "Projects/Alpha.md", content: "Project Alpha. Aliases: A-Project, AProj. Frontend: TBD.", frontmatter: {} },
  { path: "Daily/2025-03-20.md", content: "Alpha update: backend confirmed PostgreSQL.", frontmatter: {} },
  { path: "Daily/2025-01-15.md", content: "Worked on A-Project today. Chose React for frontend.", frontmatter: {} },
];

const QUESTION: ResearchQuestion = {
  id: "q1",
  text: "Что я решил по Alpha?",
  gold: { expectedFacts: [], expectedContradictions: [], expectedGaps: [] },
};

function makeDeps(llm: any): ResearchDeps {
  const metrics = new MetricsCollector();
  metrics.setRunMeta({ model: "gpt-4o-mini", runId: "test", configHash: "x", seed: 42 });
  return {
    vault: { listInboxNotes: async () => [], readNote: async (r: any) => ({ path: r.path, content: "", frontmatter: {} }), applyTriage: async () => {}, getVaultContext: async () => ({ folders: [], tags: [], noteTitles: [] }) } as any,
    llm,
    metrics,
    searchIndex: buildSearchIndex(NOTES),
    budget: { maxUsd: 0.05, maxLlmCalls: 1 },
    config: { model: "gpt-4o-mini", maxTokensPerCall: 500 },
  };
}

describe("BaselineEngine", () => {
  it("makes exactly one LLM call", async () => {
    let calls = 0;
    const llm = {
      complete: async () => {
        calls++;
        return { text: JSON.stringify({ answer: "Ответ", citations: [], gaps: [] }), usage: { inputTokens: 10, outputTokens: 5 } };
      },
    };
    const engine = new BaselineEngine();
    await engine.solve(QUESTION, makeDeps(llm));
    expect(calls).toBe(1);
  });

  it("returns a ResearchAnswer with a final trace step", async () => {
    const llm = new MockLlmClient([
      {
        text: JSON.stringify({
          answer: "Решил backend на [[Projects/Alpha.md]]",
          citations: ["Projects/Alpha.md"],
          gaps: ["деплой"],
        }),
      },
    ]);
    const engine = new BaselineEngine();
    const answer = await engine.solve(QUESTION, makeDeps(llm));

    expect(answer.text).toContain("Projects/Alpha.md");
    expect(answer.citations).toEqual(["Projects/Alpha.md"]);
    expect(answer.gaps).toEqual(["деплой"]);
    expect(answer.trace.steps.length).toBe(1);
    expect(answer.trace.steps[0].type).toBe("final");
    expect(answer.usage.inputTokens).toBe(10);
    expect(answer.usage.outputTokens).toBe(5);
    expect(answer.usage.costUsd).toBeGreaterThan(0);
  });

  it("drops citations that do not exist in the vault", async () => {
    const llm = new MockLlmClient([
      {
        text: JSON.stringify({
          answer: "Ответ [[Projects/Alpha.md]] и [[Nope/Missing.md]]",
          citations: ["Projects/Alpha.md", "Nope/Missing.md"],
          gaps: [],
        }),
      },
    ]);
    const engine = new BaselineEngine();
    const answer = await engine.solve(QUESTION, makeDeps(llm));

    expect(answer.citations).toEqual(["Projects/Alpha.md"]);
    const final = answer.trace.steps[0].toolOutput as any;
    expect(final.invalidCitations).toEqual(["Nope/Missing.md"]);
  });

  it("citations are a subset of the vault notes", async () => {
    const llm = new MockLlmClient([
      {
        text: JSON.stringify({
          answer: "Ответ",
          citations: ["Projects/Alpha.md", "Daily/2025-03-20.md", "Daily/2025-01-15.md"],
          gaps: [],
        }),
      },
    ]);
    const engine = new BaselineEngine();
    const answer = await engine.solve(QUESTION, makeDeps(llm));
    const titles = NOTES.map((n) => n.path);
    for (const c of answer.citations) expect(titles).toContain(c);
  });

  it("survives an unparsable LLM answer", async () => {
    const llm = new MockLlmClient([{ text: "это не json" }]);
    const engine = new BaselineEngine();
    const answer = await engine.solve(QUESTION, makeDeps(llm));
    expect(answer.citations).toEqual([]);
    expect(answer.trace.steps[0].content).toContain("Parse error");
  });

  it("resolves citations given without extension or folder", async () => {
    const llm = new MockLlmClient([
      { text: JSON.stringify({ answer: "a", citations: ["Alpha", "Daily/2025-03-20"], gaps: [] }) },
    ]);
    const engine = new BaselineEngine();
    const answer = await engine.solve(QUESTION, makeDeps(llm));
    expect(answer.citations).toContain("Projects/Alpha.md");
    expect(answer.citations).toContain("Daily/2025-03-20.md");
  });
});
