import { loadPrompt, parseAgentJson } from "../../agents/parseJson";
import { ResearchAnswer, ResearchDeps, ResearchEngine, ResearchQuestion } from "../types";
import { searchVault, validateCitations, normalizeFinalPayload } from "../tools";
import { safeCost } from "../cost";

const MAX_NOTE_CHARS = 2000;
const TOP_K = 10;

/**
 * E0 — baseline: one retrieval pass, one LLM call, one answer.
 * The control variant for the Deep Research comparison.
 */
export class BaselineEngine implements ResearchEngine {
  readonly id = "baseline";

  async solve(question: ResearchQuestion, deps: ResearchDeps): Promise<ResearchAnswer> {
    const started = performance.now();
    const hits = searchVault(question.text, TOP_K, deps.searchIndex);

    const notes = hits.map((h) => {
      const doc = deps.searchIndex.byPath.get(h.path)!;
      return {
        title: h.path,
        snippet: h.snippet,
        content: (doc.content || "").slice(0, MAX_NOTE_CHARS),
      };
    });

    const userPrompt =
      `QUESTION: ${question.text}\n\n` +
      `NOTES (${notes.length}):\n` +
      notes
        .map(
          (n, i) =>
            `[${i + 1}] title: ${n.title}\ncontent: ${n.content || "(empty)"}`,
        )
        .join("\n\n");

    deps.metrics.start(`research:${question.id}`, this.id);
    const res = await deps.llm.complete(
      loadPrompt("research/baseline.system.md"),
      userPrompt,
      { model: deps.config.model, maxTokens: deps.config.maxTokensPerCall, temperature: 0 },
    );

    const usage = {
      inputTokens: res.usage?.inputTokens || 0,
      outputTokens: res.usage?.outputTokens || 0,
    };
    deps.metrics.end(usage, { quality: "unknown" });

    const parsed = parseAgentJson(res.text);
    const payload = normalizeFinalPayload(parsed.ok ? parsed.data : {});
    const { valid, invalid } = validateCitations(payload.citations, deps.searchIndex);

    const notes_ = invalid.length
      ? `Dropped invalid citations (not present in the vault): ${invalid.join(", ")}`
      : "All citations validated against the vault.";

    const steps: ResearchAnswer["trace"]["steps"] = [
      {
        stepIndex: 0,
        type: "final",
        content: parsed.ok
          ? payload.answer
          : `Parse error: ${parsed.error || "unknown"}\nRaw: ${res.text?.slice(0, 500) || ""}`,
        toolOutput: {
          citations: valid,
          invalidCitations: invalid,
          gaps: payload.gaps,
          retrievalHits: hits.map((h) => ({ path: h.path, score: h.score })),
        },
        usage,
      },
    ];

    return {
      text: payload.answer,
      citations: valid,
      gaps: payload.gaps,
      trace: { steps },
      usage: {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costUsd: safeCost(deps.config.model, usage),
        wallClockMs: Math.round(performance.now() - started),
      },
    };
  }
}
