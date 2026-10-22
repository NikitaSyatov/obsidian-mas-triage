import { describe, it, expect } from "vitest";
import { buildSearchIndex } from "../../src/research/tools/search";
import { ReActEngine } from "../../src/research/engines/ReActEngine";
import { ResearchDeps, ResearchQuestion } from "../../src/research/types";
import { MetricsCollector } from "../../src/metrics/MetricsCollector";
import { Note } from "../../src/types/note";

const NOTES: Note[] = [
  { path: "Projects/Alpha.md", content: "Project Alpha. Aliases: A-Project, AProj.", frontmatter: {} },
  { path: "Daily/2025-01-15.md", content: "Worked on A-Project today. Chose React for frontend.", frontmatter: {} },
  { path: "Daily/2025-03-20.md", content: "Alpha update: backend confirmed PostgreSQL.", frontmatter: {} },
];

const QUESTION: ResearchQuestion = {
  id: "q1",
  text: "Что я решил по Alpha?",
  gold: { expectedFacts: [], expectedContradictions: [], expectedGaps: [] },
};

/** Scripted mock: returns the queued responses one by one. */
function scripted(responses: any[]) {
  const prompts: string[] = [];
  let i = 0;
  const llm = {
    async complete(_s: string, userPrompt: string) {
      prompts.push(userPrompt);
      const r = responses[Math.min(i, responses.length - 1)];
      i++;
      return {
        text: typeof r === "string" ? r : JSON.stringify(r),
        usage: { inputTokens: 10, outputTokens: 5 },
      };
    },
  };
  return { llm, prompts, callCount: () => i };
}

function makeDeps(llm: any, over: Partial<ResearchDeps> = {}): ResearchDeps {
  const metrics = new MetricsCollector();
  metrics.setRunMeta({ model: "gpt-4o-mini", runId: "test", configHash: "x", seed: 42 });
  return {
    vault: {
      listInboxNotes: async () => [],
      readNote: async (r: any) => {
        const n = NOTES.find((x) => x.path === r.path);
        if (!n) throw new Error(`Note not found: ${r.path}`);
        return n;
      },
      applyTriage: async () => {},
      getVaultContext: async () => ({ folders: [], tags: [], noteTitles: [] }),
    } as any,
    llm,
    metrics,
    searchIndex: buildSearchIndex(NOTES),
    budget: { maxUsd: 0.05, maxLlmCalls: 6 },
    config: { model: "gpt-4o-mini", maxTokensPerCall: 500, maxSteps: 6 },
    ...over,
  };
}

describe("ReActEngine", () => {
  it("runs the chain search -> read -> search -> read -> finish", async () => {
    const { llm, callCount } = scripted([
      { thought: "Ищу Alpha", action: "search", actionInput: "Alpha", finalAnswer: null },
      { thought: "Читаю канон", action: "read", actionInput: "Projects/Alpha.md", finalAnswer: null },
      { thought: "Есть алиас A-Project, ищу по нему", action: "search", actionInput: "A-Project", finalAnswer: null },
      { thought: "Читаю найденную заметку", action: "read", actionInput: "Daily/2025-01-15.md", finalAnswer: null },
      {
        thought: "Готово",
        action: "finish",
        actionInput: "",
        finalAnswer: {
          answer: "Решил [[Projects/Alpha.md]] и [[Daily/2025-01-15.md]]",
          citations: ["Projects/Alpha.md", "Daily/2025-01-15.md"],
          gaps: [],
        },
      },
    ]);

    const engine = new ReActEngine();
    const answer = await engine.solve(QUESTION, makeDeps(llm));

    expect(callCount()).toBe(5);
    expect(answer.citations).toEqual(["Projects/Alpha.md", "Daily/2025-01-15.md"]);

    const types = answer.trace.steps.map((s) => s.type);
    expect(types).toContain("thought");
    expect(types).toContain("action");
    expect(types).toContain("observation");
    expect(types[types.length - 1]).toBe("final");

    // step indices are sequential
    answer.trace.steps.forEach((s, i) => expect(s.stepIndex).toBe(i));

    // the alias search observation contains the hidden note
    const obs = answer.trace.steps.filter((s) => s.type === "observation");
    expect(obs.some((o) => o.content.includes("2025-01-15"))).toBe(true);
  });

  it("respects maxSteps", async () => {
    const { llm, callCount } = scripted([
      { thought: "Ищу", action: "search", actionInput: "Alpha", finalAnswer: null },
    ]);
    const engine = new ReActEngine();
    const deps = makeDeps(llm, { config: { model: "gpt-4o-mini", maxTokensPerCall: 500, maxSteps: 2 } });
    const answer = await engine.solve(QUESTION, deps);

    expect(callCount()).toBe(2);
    const final = answer.trace.steps[answer.trace.steps.length - 1].toolOutput as any;
    expect(final.forced_finish).toBe(true);
  });

  it("respects maxLlmCalls", async () => {
    const { llm, callCount } = scripted([
      { thought: "Ищу", action: "search", actionInput: "Alpha", finalAnswer: null },
    ]);
    const engine = new ReActEngine();
    const deps = makeDeps(llm, { budget: { maxUsd: 0.05, maxLlmCalls: 3 } });
    const answer = await engine.solve(QUESTION, deps);

    expect(callCount()).toBe(3);
    const final = answer.trace.steps[answer.trace.steps.length - 1].toolOutput as any;
    expect(final.forced_finish).toBe(true);
  });

  it("recovers from a parse error and continues", async () => {
    const { llm, callCount } = scripted([
      "не json вовсе",
      { thought: "Ищу", action: "search", actionInput: "Alpha", finalAnswer: null },
      {
        thought: "Готово",
        action: "finish",
        actionInput: "",
        finalAnswer: { answer: "ок", citations: [], gaps: [] },
      },
    ]);
    const engine = new ReActEngine();
    const answer = await engine.solve(QUESTION, makeDeps(llm));

    expect(callCount()).toBe(3);
    const obs = answer.trace.steps.filter((s) => s.type === "observation");
    expect(obs[0].content).toContain("Parse error");
    expect(answer.trace.steps[answer.trace.steps.length - 1].type).toBe("final");
  });

  it("reports 'Note not found' and continues", async () => {
    const { llm, callCount } = scripted([
      { thought: "Читаю", action: "read", actionInput: "Nope/Missing.md", finalAnswer: null },
      {
        thought: "Готово",
        action: "finish",
        actionInput: "",
        finalAnswer: { answer: "ок", citations: [], gaps: [] },
      },
    ]);
    const engine = new ReActEngine();
    const answer = await engine.solve(QUESTION, makeDeps(llm));

    expect(callCount()).toBe(2);
    const obs = answer.trace.steps.filter((s) => s.type === "observation");
    expect(obs[0].content).toBe("Note not found: Nope/Missing.md");
  });

  it("reports an empty search query and continues", async () => {
    const { llm } = scripted([
      { thought: "Хм", action: "search", actionInput: "  ", finalAnswer: null },
      { thought: "Готово", action: "finish", actionInput: "", finalAnswer: { answer: "ок", citations: [], gaps: [] } },
    ]);
    const engine = new ReActEngine();
    const answer = await engine.solve(QUESTION, makeDeps(llm));
    const obs = answer.trace.steps.filter((s) => s.type === "observation");
    expect(obs[0].content).toBe("Empty query");
  });

  it("refuses to repeat the same search query", async () => {
    const { llm } = scripted([
      { thought: "Ищу", action: "search", actionInput: "Alpha", finalAnswer: null },
      { thought: "Ищу ещё раз", action: "search", actionInput: "Alpha", finalAnswer: null },
      { thought: "Готово", action: "finish", actionInput: "", finalAnswer: { answer: "ок", citations: [], gaps: [] } },
    ]);
    const engine = new ReActEngine();
    const answer = await engine.solve(QUESTION, makeDeps(llm));
    const obs = answer.trace.steps.filter((s) => s.type === "observation");
    expect(obs[1].content).toContain("already used");
  });

  it("drops invalid citations on finish", async () => {
    const { llm } = scripted([
      {
        thought: "Готово",
        action: "finish",
        actionInput: "",
        finalAnswer: { answer: "ок", citations: ["Projects/Alpha.md", "Ghost/Note.md"], gaps: [] },
      },
    ]);
    const engine = new ReActEngine();
    const answer = await engine.solve(QUESTION, makeDeps(llm));
    expect(answer.citations).toEqual(["Projects/Alpha.md"]);
    const final = answer.trace.steps[answer.trace.steps.length - 1].toolOutput as any;
    expect(final.invalidCitations).toEqual(["Ghost/Note.md"]);
  });

  it("accumulates usage over all calls", async () => {
    const { llm } = scripted([
      { thought: "Ищу", action: "search", actionInput: "Alpha", finalAnswer: null },
      { thought: "Готово", action: "finish", actionInput: "", finalAnswer: { answer: "ок", citations: [], gaps: [] } },
    ]);
    const engine = new ReActEngine();
    const answer = await engine.solve(QUESTION, makeDeps(llm));
    expect(answer.usage.inputTokens).toBe(20);
    expect(answer.usage.outputTokens).toBe(10);
    expect(answer.usage.costUsd).toBeGreaterThan(0);
  });
});
