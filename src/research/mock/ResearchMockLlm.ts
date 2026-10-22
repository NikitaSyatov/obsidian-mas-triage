import { LlmClient, LlmCompleteResult } from "../../llm/LlmClient";

/**
 * Fixture LLM for the Deep Research pipeline.
 *
 * It is NOT a language model: it emulates two reference agents so that the
 * pipeline can be exercised deterministically (no API key required).
 *
 *  - `baseline` emulates an oracle that answers *only* from the notes it was
 *    given in the prompt. It therefore misses everything that was not
 *    retrieved — which is exactly the alias trap.
 *  - `react` emulates an alias-following agent: search -> read the canonical
 *    note -> notice the alias -> search by alias -> read the hidden note ->
 *    broaden the search -> finish.
 *
 * All numbers produced with this mock are pipeline-level smoke numbers; the
 * real evaluation uses a real LLM.
 */

export const RESEARCH_FIXTURE_GAP = "Хост/деплой (в волте нет)";

interface ParsedNote {
  title: string;
  content: string;
}

interface HistoryEntry {
  thought: string;
  action: string;
  actionInput: string;
  observation: string;
}

function parseNotes(userPrompt: string): ParsedNote[] {
  const notes: ParsedNote[] = [];
  const re = /\[(\d+)\]\s*title:\s*(.+)\ncontent:\s*([\s\S]*?)(?=\n\n\[\d+\]\s*title:|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(userPrompt)) !== null) {
    notes.push({ title: m[2].trim(), content: m[3].trim() });
  }
  return notes;
}

function parseHistory(userPrompt: string): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  let section = userPrompt.split("HISTORY:")[1] || "";
  const notesIdx = section.indexOf("NOTES FOUND:");
  if (notesIdx >= 0) section = section.slice(0, notesIdx);
  const re = /Thought:\s*([\s\S]*?)\nAction:\s*(\w+)\(([^)]*)\)\nObservation:\s*([\s\S]*?)(?=\nThought:|\nRespond with|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section)) !== null) {
    entries.push({
      thought: m[1].trim(),
      action: m[2].trim(),
      actionInput: m[3].trim(),
      observation: m[4].trim(),
    });
  }
  return entries;
}

function quote(text: string, max = 220): string {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

/** Collects every note path mentioned in the ReAct observations. */
function collectSeenNotes(history: HistoryEntry[]): Map<string, string> {
  const seen = new Map<string, string>();
  for (const h of history) {
    if (h.action === "read") {
      seen.set(h.actionInput, h.observation);
      continue;
    }
    if (h.action === "search") {
      try {
        const hits = JSON.parse(h.observation);
        if (Array.isArray(hits)) {
          for (const hit of hits) {
            if (hit && typeof hit.title === "string") {
              if (!seen.has(hit.title)) seen.set(hit.title, hit.snippet || "");
            }
          }
        }
      } catch (e) {
        /* not a search observation */
      }
    }
  }
  return seen;
}

/** Titles returned by a single search observation. */
function searchTitles(history: HistoryEntry[], query: string): string[] {
  const entry = history.find((h) => h.action === "search" && h.actionInput.toLowerCase() === query.toLowerCase());
  if (!entry) return [];
  try {
    const hits = JSON.parse(entry.observation);
    if (!Array.isArray(hits)) return [];
    return hits.map((h: any) => h?.title).filter((t: any) => typeof t === "string");
  } catch (e) {
    return [];
  }
}

/** The topic of the question ("проекту Alpha" -> "Alpha"). */
function extractTopic(userPrompt: string): string {
  const question = (userPrompt.split("QUESTION:")[1] || "").split("\n")[0];
  const m = question.match(/проекту\s+([^\s,?]+)/i);
  if (m) return m[1].replace(/[^\w-]/g, "");
  const cap = question.match(/\b([A-Z][A-Za-z0-9-]{2,})\b/);
  return cap ? cap[1] : "Alpha";
}

/** Aliases declared in a note body ("Aliases: A-Project, AProj"). */
function extractAliases(observations: string[]): string[] {
  const aliases: string[] = [];
  for (const obs of observations) {
    const m = (obs || "").match(/Aliases?\s*:\s*([^\n.]+)/i);
    if (!m) continue;
    for (const raw of m[1].split(",")) {
      const alias = raw.trim().split(/\s+/)[0].replace(/[^\w-]/g, "");
      if (alias && !aliases.includes(alias)) aliases.push(alias);
    }
  }
  return aliases;
}

export class ResearchMockLlm implements LlmClient {
  constructor(private kind: "baseline" | "react" = "baseline") {}

  async complete(systemPrompt: string, userPrompt: string, opts?: any): Promise<LlmCompleteResult> {
    const text = this.kind === "baseline" ? this.baselineReply(userPrompt) : this.reactReply(userPrompt);
    return {
      text,
      usage: { inputTokens: 1200, outputTokens: 300 },
    };
  }

  private baselineReply(userPrompt: string): string {
    const notes = parseNotes(userPrompt);
    const lines = notes.map((n) => `- [[${n.title}]]: ${quote(n.content)}`);
    const answer = [
      `По переданным заметкам (${notes.length}) видно следующее:`,
      ...lines,
    ].join("\n");
    return JSON.stringify({
      answer,
      citations: notes.map((n) => n.title),
      gaps: [RESEARCH_FIXTURE_GAP],
    });
  }

  private reactReply(userPrompt: string): string {
    const history = parseHistory(userPrompt);
    const topic = extractTopic(userPrompt);
    const searchEntries = history.filter((h) => h.action === "search");
    const searchQueries = searchEntries.map((h) => h.actionInput.toLowerCase());
    const reads = history.filter((h) => h.action === "read").map((h) => h.actionInput);
    const seen = collectSeenNotes(history);
    const aliases = extractAliases(history.filter((h) => h.action === "read").map((h) => h.observation));

    // 1. first step — search for the topic
    if (!searchEntries.length) {
      return JSON.stringify({
        thought: `Нужно собрать решения по проекту ${topic}. Начну с поиска по «${topic}».`,
        action: "search",
        actionInput: topic,
        finalAnswer: null,
      });
    }

    // 2. read the canonical project note
    if (!reads.length) {
      const titles = searchTitles(history, searchEntries[searchEntries.length - 1].actionInput);
      const canonical = titles.find((p) => p.startsWith("Projects/")) || titles[0];
      if (canonical) {
        return JSON.stringify({
          thought: `Прочитаю каноническую заметку ${canonical}, чтобы понять, как на неё ссылаются.`,
          action: "read",
          actionInput: canonical,
          finalAnswer: null,
        });
      }
    }

    // 3. the canonical note declares an alias -> follow it
    const alias = aliases[0];
    if (alias && !searchQueries.includes(alias.toLowerCase())) {
      return JSON.stringify({
        thought:
          `В канонической заметке есть алиас «${alias}» — ранние заметки могли не упоминать ${topic}. Ищу по алиасу.`,
        action: "search",
        actionInput: alias,
        finalAnswer: null,
      });
    }

    // 4. the alias search opened a note that plain search never saw -> read it
    if (alias) {
      const earlier = new Set<string>();
      for (const entry of searchEntries) {
        if (entry.actionInput.toLowerCase() === alias.toLowerCase()) break;
        for (const t of searchTitles(history, entry.actionInput)) earlier.add(t);
      }
      const fresh = searchTitles(history, alias).filter((t) => !earlier.has(t));
      const freshUnread = fresh.filter((t) => !reads.includes(t));
      if (freshUnread.length && !fresh.some((t) => reads.includes(t))) {
        return JSON.stringify({
          thought: "Поиск по алиасу нашёл заметку, недоступную обычному поиску — прочитаю её.",
          action: "read",
          actionInput: fresh[0],
          finalAnswer: null,
        });
      }
    }

    // 5. broaden the search — decisions may be recorded in meeting notes
    const broad = `${topic} meeting`;
    if (!searchQueries.includes(broad.toLowerCase())) {
      return JSON.stringify({
        thought: `Решения фиксировались и на встречах. Уточню поиск: «${broad}», чтобы найти протоколы.`,
        action: "search",
        actionInput: broad,
        finalAnswer: null,
      });
    }

    // 6. finish — compose the answer from everything observed
    const citations = Array.from(seen.keys());
    const body = citations.map((p) => `- [[${p}]]: ${quote(seen.get(p) || "")}`);
    const answer = [
      `Собрал решения по проекту ${topic} по всем найденным заметкам (включая заметку, найденную по алиасу ${alias || "—"}):`,
      ...body,
      "Противоречия: PostgreSQL (2025-03-20) против SQLite (2025-05-01) — более позднее решение SQLite отменяет PostgreSQL; React (2025-01-15) против Svelte (2025-06-01) — более позднее решение Svelte отменяет React.",
    ].join("\n");

    return JSON.stringify({
      thought: "Собрал достаточно заметок, можно синтезировать ответ.",
      action: "finish",
      actionInput: "",
      finalAnswer: { answer, citations, gaps: [RESEARCH_FIXTURE_GAP] },
    });
  }
}
