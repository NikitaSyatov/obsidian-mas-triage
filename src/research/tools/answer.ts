import { SearchIndex, basename } from "./search";

export interface FinalAnswerPayload {
  answer: string;
  citations: string[];
  gaps: string[];
}

/** Extracts [[wikilinks]] from the answer text, in order of appearance. */
export function extractWikilinks(text: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || "")) !== null) {
    const raw = m[1].split("|")[0].split("#")[0].trim();
    if (raw) out.push(raw);
  }
  return out;
}

/**
 * Resolves a citation string to a canonical vault-relative path.
 * Accepts "Projects/Alpha.md", "Projects/Alpha" and "Alpha".
 */
export function resolveCitation(citation: string, index: SearchIndex): string | null {
  const raw = (citation || "").trim();
  if (!raw) return null;
  const noExt = raw.replace(/\.md$/i, "");

  if (index.byPath.has(raw)) return raw;
  if (index.byPath.has(noExt)) return noExt;
  for (const p of index.byPath.keys()) {
    if (p.replace(/\.md$/i, "") === noExt) return p;
  }
  const base = basename(raw);
  if (index.byTitle.has(base)) return index.byTitle.get(base)!.path;
  return null;
}

export interface CitationValidation {
  valid: string[];
  invalid: string[];
}

/**
 * Validates citations against the vault. Invalid ones are dropped, valid ones
 * are normalized to canonical vault-relative paths (deduplicated, order kept).
 */
export function validateCitations(citations: string[], index: SearchIndex): CitationValidation {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const c of citations || []) {
    const resolved = resolveCitation(c, index);
    if (!resolved) {
      invalid.push(c);
      continue;
    }
    if (!valid.includes(resolved)) valid.push(resolved);
  }
  return { valid, invalid };
}

/** Normalizes the LLM payload into a stable FinalAnswerPayload shape. */
export function normalizeFinalPayload(raw: any): FinalAnswerPayload {
  const answer = typeof raw?.answer === "string" ? raw.answer : typeof raw?.text === "string" ? raw.text : "";
  const citations = Array.isArray(raw?.citations) ? raw.citations.filter((c: any) => typeof c === "string") : [];
  const gaps = Array.isArray(raw?.gaps) ? raw.gaps.filter((g: any) => typeof g === "string") : [];
  return { answer, citations, gaps };
}
