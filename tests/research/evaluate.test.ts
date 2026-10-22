import { describe, it, expect } from "vitest";
import { evaluateResearch } from "../../src/research/evaluate";
import { ResearchAnswer, ResearchQuestion } from "../../src/research/types";

const GOLD: ResearchQuestion["gold"] = {
  expectedFacts: [
    { id: "F1", description: "PostgreSQL chosen", keyword: "PostgreSQL", sourceNote: "Meetings/kickoff.md", expected: true },
    { id: "F2", description: "SQLite pivot", keyword: "SQLite", sourceNote: "Daily/pivot.md", expected: true },
    { id: "F3", description: "React original", keyword: "React", sourceNote: "Daily/early.md", expected: true },
  ],
  expectedContradictions: [
    { id: "C1", description: "pg vs sqlite", noteA: "Meetings/kickoff.md", noteB: "Daily/pivot.md" },
  ],
  expectedGaps: ["деплой"],
};

function answer(over: Partial<ResearchAnswer> = {}): ResearchAnswer {
  return {
    text: "",
    citations: [],
    gaps: [],
    trace: { steps: [] },
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, wallClockMs: 0 },
    ...over,
  };
}

describe("evaluateResearch", () => {
  it("coverage 1 when every fact is cited and mentioned", () => {
    const a = answer({
      text: "PostgreSQL, потом SQLite, изначально React",
      citations: ["Meetings/kickoff.md", "Daily/pivot.md", "Daily/early.md"],
    });
    const r = evaluateResearch(a, GOLD);
    expect(r.coverage).toBe(1);
    expect(r.foundFacts).toEqual(["F1", "F2", "F3"]);
    expect(r.missedFacts).toEqual([]);
  });

  it("coverage 0.5 when one fact is missing", () => {
    const a = answer({
      text: "PostgreSQL and SQLite",
      citations: ["Meetings/kickoff.md", "Daily/pivot.md"],
    });
    const r = evaluateResearch(a, GOLD);
    expect(r.coverage).toBeCloseTo(2 / 3);
    expect(r.missedFacts).toEqual(["F3"]);
  });

  it("a fact without its source note is not counted", () => {
    const a = answer({
      text: "PostgreSQL SQLite React",
      citations: ["Meetings/kickoff.md", "Daily/pivot.md"],
    });
    const r = evaluateResearch(a, GOLD);
    expect(r.foundFacts).not.toContain("F3");
  });

  it("a keyword without a citation is not counted", () => {
    const a = answer({
      text: "PostgreSQL SQLite React",
      citations: ["Meetings/kickoff.md", "Daily/pivot.md"],
    });
    const r = evaluateResearch(a, GOLD);
    expect(r.foundFacts).not.toContain("F3");
  });

  it("keyword matching is case-insensitive", () => {
    const a = answer({
      text: "postgresql sqlite react",
      citations: ["Meetings/kickoff.md", "Daily/pivot.md", "Daily/early.md"],
    });
    const r = evaluateResearch(a, GOLD);
    expect(r.coverage).toBe(1);
  });

  it("citation by basename counts as a match", () => {
    const a = answer({
      text: "PostgreSQL SQLite React",
      citations: ["kickoff", "pivot", "early"],
    });
    const r = evaluateResearch(a, GOLD);
    expect(r.coverage).toBe(1);
  });

  it("groundedness is 1 when every wikilink resolves", () => {
    const a = answer({
      text: "See [[Meetings/kickoff.md]] and [[Daily/pivot.md]]",
      citations: ["Meetings/kickoff.md", "Daily/pivot.md"],
    });
    const r = evaluateResearch(a, GOLD);
    expect(r.groundedness).toBe(1);
    expect(r.invalidCitations).toEqual([]);
  });

  it("groundedness drops unresolvable wikilinks", () => {
    const a = answer({
      text: "See [[Meetings/kickoff.md]] and [[Ghost/Note.md]]",
      citations: ["Meetings/kickoff.md"],
    });
    const r = evaluateResearch(a, GOLD);
    expect(r.groundedness).toBe(0.5);
    expect(r.invalidCitations).toEqual(["Ghost/Note.md"]);
  });

  it("groundedness is 1 when the answer has no wikilinks", () => {
    const a = answer({ text: "PostgreSQL SQLite React", citations: [] });
    const r = evaluateResearch(a, GOLD);
    expect(r.groundedness).toBe(1);
  });

  it("contradiction is found only when both notes are cited", () => {
    const both = answer({ text: "a", citations: ["Meetings/kickoff.md", "Daily/pivot.md"] });
    expect(evaluateResearch(both, GOLD).contradictionsFound).toEqual(["C1"]);

    const one = answer({ text: "a", citations: ["Meetings/kickoff.md"] });
    expect(evaluateResearch(one, GOLD).contradictionsFound).toEqual([]);
  });

  it("gaps are matched by substring, case-insensitively", () => {
    const a = answer({ text: "a", citations: [], gaps: ["Информация о ДЕПЛОЕ отсутствует"] });
    expect(evaluateResearch(a, GOLD).gapsMatched).toEqual(["деплой"]);
  });

  it("no gap match when the gaps differ", () => {
    const a = answer({ text: "a", citations: [], gaps: ["просто другое"] });
    expect(evaluateResearch(a, GOLD).gapsMatched).toEqual([]);
  });

  it("facts marked as not expected are ignored", () => {
    const gold = {
      ...GOLD,
      expectedFacts: [...GOLD.expectedFacts, { id: "F4", description: "optional", keyword: "zzz", sourceNote: "x.md", expected: false }],
    };
    const a = answer({ text: "", citations: [] });
    const r = evaluateResearch(a, gold);
    expect(r.missedFacts).toEqual(["F1", "F2", "F3"]);
  });

  it("empty gold yields coverage 0 and no contradictions", () => {
    const a = answer({ text: "anything", citations: [] });
    const r = evaluateResearch(a, { expectedFacts: [], expectedContradictions: [], expectedGaps: [] });
    expect(r.coverage).toBe(0);
    expect(r.contradictionsFound).toEqual([]);
  });

  it("wikilinks with an alias pipe are supported", () => {
    const a = answer({
      text: "See [[Meetings/kickoff.md|Alpha kickoff]]",
      citations: ["Meetings/kickoff.md"],
    });
    const r = evaluateResearch(a, GOLD);
    expect(r.groundedness).toBe(1);
  });
});
