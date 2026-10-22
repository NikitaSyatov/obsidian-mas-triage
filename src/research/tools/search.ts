import { Note } from "../../types/note";
import { SearchHit } from "../types";

export interface IndexedNote {
  path: string;
  title: string;
  content: string;
  tokens: string[];
  tf: Map<string, number>;
  len: number;
}

export interface SearchIndex {
  docs: IndexedNote[];
  df: Map<string, number>;
  avgDocLen: number;
  byPath: Map<string, IndexedNote>;
  byTitle: Map<string, IndexedNote>;
}

const STOP_WORDS = new Set([
  // english
  "a", "an", "the", "and", "or", "but", "if", "then", "than", "that", "this", "these", "those",
  "is", "are", "was", "were", "be", "been", "being", "to", "of", "in", "on", "at", "by", "for",
  "with", "about", "as", "from", "into", "it", "its", "we", "i", "you", "he", "she", "they",
  "do", "does", "did", "not", "no", "so", "such", "there", "here", "what", "which", "who",
  "how", "my", "our", "your", "can", "will", "would", "should", "could", "have", "has", "had",
  // russian
  "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то", "все", "она",
  "так", "его", "но", "да", "ты", "к", "у", "же", "вы", "за", "бы", "по", "только", "ее",
  "мне", "было", "вот", "от", "меня", "еще", "нет", "о", "из", "ему", "теперь", "когда",
  "даже", "ну", "вдруг", "ли", "если", "уже", "или", "ни", "быть", "был", "него", "до",
  "вас", "нибудь", "опять", "уж", "вам", "ведь", "там", "потом", "себя", "ничего", "ей",
  "может", "они", "тут", "где", "есть", "надо", "ней", "для", "мы", "тебя", "их", "чем",
  "была", "сам", "чтоб", "без", "будто", "чего", "раз", "тоже", "себе", "под", "будет",
  "ж", "тогда", "кто", "этот", "того", "потому", "этого", "какой", "совсем", "ним",
  "здесь", "этом", "один", "почти", "мой", "тем", "чтобы", "нее", " сейчас", "были", "куда",
  "зачем", "всех", "никогда", "можно", "при", "наконец", "два", "об", "другой", "хоть",
  "после", "над", "больше", "тот", "через", "эти", "нас", "про", "всего", "них", "какая",
  "много", "разве", "три", "эту", "моя", "впрочем", "хорошо", "свою", "этой", "перед",
  "иногда", "лучше", "чуть", "том", "нельзя", "такой", "им", "более", "всегда", "конечно",
  "всю", "между",
]);

export const TOKEN_RE = /[\p{L}\p{N}]+/gu;

export function tokenize(text: string): string[] {
  const raw = (text.toLowerCase().match(TOKEN_RE) || []);
  return raw.filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

export function basename(path: string): string {
  const file = path.split("/").pop() || path;
  return file.replace(/\.md$/i, "");
}

/**
 * Builds a BM25 index over the *content* of the notes.
 * Titles are intentionally NOT indexed: the alias-trap dataset relies on
 * content-only matching (a note whose body mentions "A-Project" but never
 * "Alpha" must not be reachable by the query "Alpha").
 */
export function buildSearchIndex(notes: Note[]): SearchIndex {
  const docs: IndexedNote[] = [];
  const df = new Map<string, number>();
  const byPath = new Map<string, IndexedNote>();
  const byTitle = new Map<string, IndexedNote>();
  let totalLen = 0;

  for (const note of notes) {
    const tokens = tokenize(note.content || "");
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    for (const term of tf.keys()) df.set(term, (df.get(term) || 0) + 1);

    const doc: IndexedNote = {
      path: note.path,
      title: basename(note.path),
      content: note.content || "",
      tokens,
      tf,
      len: tokens.length,
    };
    docs.push(doc);
    byPath.set(doc.path, doc);
    if (!byTitle.has(doc.title)) byTitle.set(doc.title, doc);
    totalLen += doc.len;
  }

  return {
    docs,
    df,
    avgDocLen: docs.length ? totalLen / docs.length : 0,
    byPath,
    byTitle,
  };
}

const K1 = 1.5;
const B = 0.75;

function idf(term: string, index: SearchIndex): number {
  const n = index.docs.length;
  const d = index.df.get(term) || 0;
  return Math.log(1 + (n - d + 0.5) / (d + 0.5));
}

function makeSnippet(content: string, terms: string[], maxLen = 200): string {
  if (!content) return "";
  const lower = content.toLowerCase();
  let best = -1;
  for (const t of terms) {
    const idx = lower.indexOf(t);
    if (idx >= 0 && (best === -1 || idx < best)) best = idx;
  }
  if (best === -1) return content.slice(0, maxLen);
  const start = Math.max(0, best - Math.floor(maxLen / 3));
  const end = Math.min(content.length, start + maxLen);
  return content.slice(start, end);
}

/**
 * BM25 search over note CONTENT only.
 * Deterministic: ties are broken by (score desc, path asc).
 */
export function searchVault(query: string, k: number, index: SearchIndex): SearchHit[] {
  const terms = tokenize(query || "");
  if (!terms.length || !index.docs.length) return [];

  const scores = new Map<string, number>();
  const matchedTerms = new Map<string, string[]>();

  for (const doc of index.docs) {
    let score = 0;
    const hitTerms: string[] = [];
    for (const term of terms) {
      const tf = doc.tf.get(term);
      if (!tf) continue;
      const denom = tf + K1 * (1 - B + (B * doc.len) / (index.avgDocLen || 1));
      score += idf(term, index) * ((tf * (K1 + 1)) / denom);
      hitTerms.push(term);
    }
    if (score > 0) {
      scores.set(doc.path, score);
      matchedTerms.set(doc.path, hitTerms);
    }
  }

  const hits: SearchHit[] = [];
  for (const [p, score] of scores) {
    const doc = index.byPath.get(p)!;
    hits.push({
      title: doc.title,
      path: doc.path,
      snippet: makeSnippet(doc.content, matchedTerms.get(p) || []),
      score: Math.round(score * 1e6) / 1e6,
    });
  }

  hits.sort((a, b) => (b.score - a.score) || a.path.localeCompare(b.path));
  return hits.slice(0, Math.max(0, k));
}
