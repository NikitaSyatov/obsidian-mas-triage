import { ResearchAnswer, ResearchQuestion } from "./types";
import { extractWikilinks } from "./tools/answer";

export interface ResearchEvaluation {
  coverage: number;
  foundFacts: string[];
  missedFacts: string[];
  groundedness: number;
  invalidCitations: string[];
  contradictionsFound: string[];
  gapsMatched: string[];
}

function normalize(s: string): string {
  return (s || "").toLowerCase().trim();
}

function basenameNoExt(p: string): string {
  const file = (p || "").split("/").pop() || p || "";
  return file.replace(/\.md$/i, "").toLowerCase();
}

/**
 * Rough stems of a phrase — the first 5 characters of every word.
 * Enough to match Russian inflections ("деплой" / "деплое") without a
 * morphological analyser.
 */
function stems(text: string): string[] {
  return (text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => (w.length > 5 ? w.slice(0, 5) : w));
}

/**
 * A citation matches a gold source note when it is the same path, the same
 * path without extension, or the same basename (models sometimes cite
 * "[[Alpha]]" instead of "[[Projects/Alpha.md]]").
 */
function cites(citations: string[], sourceNote: string): boolean {
  const target = normalize(sourceNote);
  const targetBase = basenameNoExt(sourceNote);
  return citations.some((c) => {
    const cn = normalize(c);
    if (cn === target) return true;
    if (cn.replace(/\.md$/i, "") === target.replace(/\.md$/i, "")) return true;
    if (basenameNoExt(c) === targetBase) return true;
    return false;
  });
}

export function evaluateResearch(
  answer: ResearchAnswer,
  gold: ResearchQuestion["gold"],
): ResearchEvaluation {
  const citations = answer.citations || [];
  const text = answer.text || "";

  // --- coverage -----------------------------------------------------------
  const foundFacts: string[] = [];
  const missedFacts: string[] = [];
  const expectedFacts = (gold?.expectedFacts || []).filter((f) => f.expected !== false);
  for (const fact of expectedFacts) {
    const keywordPresent = normalize(text).includes(normalize(fact.keyword));
    const noteCited = cites(citations, fact.sourceNote);
    if (keywordPresent && noteCited) foundFacts.push(fact.id);
    else missedFacts.push(fact.id);
  }
  const coverage = expectedFacts.length ? foundFacts.length / expectedFacts.length : 0;

  // --- groundedness -------------------------------------------------------
  const wikilinks = extractWikilinks(text);
  const invalidCitations: string[] = [];
  for (const link of wikilinks) {
    if (!cites(citations, link)) invalidCitations.push(link);
  }
  const groundedness = wikilinks.length
    ? 1 - invalidCitations.length / wikilinks.length
    : 1;

  // --- contradictions -----------------------------------------------------
  const contradictionsFound: string[] = [];
  for (const c of gold?.expectedContradictions || []) {
    if (cites(citations, c.noteA) && cites(citations, c.noteB)) contradictionsFound.push(c.id);
  }

  // --- gaps ---------------------------------------------------------------
  const gapsMatched: string[] = [];
  const answerGaps = (answer.gaps || []).map(normalize);
  for (const expected of gold?.expectedGaps || []) {
    const expectedStems = stems(expected);
    const hit = answerGaps.some((g) => {
      const gStems = stems(g);
      return gStems.some((s) => expectedStems.includes(s));
    });
    if (hit) gapsMatched.push(expected);
  }

  return {
    coverage,
    foundFacts,
    missedFacts,
    groundedness,
    invalidCitations,
    contradictionsFound,
    gapsMatched,
  };
}
