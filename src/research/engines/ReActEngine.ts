import { loadPrompt, parseAgentJson } from "../../agents/parseJson";
import { ResearchAnswer, ResearchDeps, ResearchEngine, ResearchQuestion } from "../types";
import {
  searchVault,
  readNote,
  validateCitations,
  normalizeFinalPayload,
  FinalAnswerPayload,
} from "../tools";
import { safeCost } from "../cost";

const MAX_NOTE_CHARS = 2000;
const SEARCH_K = 5;
const DEFAULT_MAX_STEPS = 6;

interface HistoryEntry {
  thought: string;
  action: string;
  actionInput: string;
  observation: string;
}

/**
 * E2 — ReAct: iterative Thought → Action → Observation loop over the vault.
 * Recovers from parse errors and from "Note not found" instead of crashing.
 */
export class ReActEngine implements ResearchEngine {
  readonly id = "react";

  async solve(question: ResearchQuestion, deps: ResearchDeps): Promise<ResearchAnswer> {
    const started = performance.now();
    const maxSteps = Math.max(1, deps.config.maxSteps ?? deps.budget.maxLlmCalls ?? DEFAULT_MAX_STEPS);

    const history: HistoryEntry[] = [];
    const steps: ResearchAnswer["trace"]["steps"] = [];
    const seenSearches = new Set<string>();
    /** Every note the agent actually observed (search snippet or full read). */
    const observed = new Map<string, string>();

    let llmCalls = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let costUsd = 0;
    let finalPayload: FinalAnswerPayload | null = null;
    let forcedFinish = false;
    let stopReason = "";

    // The last allowed call is reserved for the synthesis, so the engine always
    // gets a properly formed answer even when exploration eats the budget.
    const explorationSteps = Math.max(1, maxSteps - 1);

    for (let i = 0; i < explorationSteps; i++) {
      if (llmCalls >= deps.budget.maxLlmCalls) {
        forcedFinish = true;
        stopReason = `Budget exhausted: maxLlmCalls=${deps.budget.maxLlmCalls}`;
        break;
      }
      if (costUsd >= deps.budget.maxUsd) {
        forcedFinish = true;
        stopReason = `Budget exhausted: cost ${costUsd.toFixed(6)} >= maxUsd ${deps.budget.maxUsd}`;
        break;
      }

      const userPrompt = this.buildUserPrompt(question, history, deps);

      deps.metrics.start(`research:${question.id}`, this.id);
      const res = await deps.llm.complete(
        loadPrompt("research/react.system.md"),
        userPrompt,
        { model: deps.config.model, maxTokens: deps.config.maxTokensPerCall, temperature: 0 },
      );
      llmCalls++;

      const usage = {
        inputTokens: res.usage?.inputTokens || 0,
        outputTokens: res.usage?.outputTokens || 0,
      };
      inputTokens += usage.inputTokens;
      outputTokens += usage.outputTokens;
      costUsd += safeCost(deps.config.model, usage);
      deps.metrics.end(usage, { quality: "unknown" });

      const parsed = parseAgentJson(res.text);
      if (!parsed.ok) {
        const observation = `Parse error: ${parsed.error || "unknown"}. Raw: ${(res.text || "").slice(0, 300)}`;
        steps.push({
          stepIndex: steps.length,
          type: "observation",
          content: observation,
          toolOutput: { parseError: true },
          usage,
        });
        history.push({
          thought: "(unparsable model output)",
          action: "none",
          actionInput: "",
          observation,
        });
        continue;
      }

      const data = parsed.data || {};
      const thought = typeof data.thought === "string" ? data.thought : "";
      const action = typeof data.action === "string" ? data.action : "";
      const actionInput = data.actionInput == null ? "" : String(data.actionInput);

      steps.push({
        stepIndex: steps.length,
        type: "thought",
        content: thought,
        usage,
      });

      if (action === "finish") {
        finalPayload = normalizeFinalPayload(data.finalAnswer);
        stopReason = "finish";
        break;
      }

      const tool = action === "search" || action === "read" ? (action as "search" | "read") : undefined;
      steps.push({
        stepIndex: steps.length,
        type: "action",
        content: `${action}(${actionInput})`,
        tool,
        toolInput: actionInput,
        usage,
      });

      let observation: string;
      if (action === "search") {
        const q = actionInput.trim();
        if (!q) {
          observation = "Empty query";
        } else if (seenSearches.has(q.toLowerCase())) {
          observation = `Search query "${q}" was already used — try a different query or finish.`;
        } else {
          seenSearches.add(q.toLowerCase());
          const hits = searchVault(q, SEARCH_K, deps.searchIndex);
          for (const h of hits) {
            if (!observed.has(h.path)) observed.set(h.path, h.snippet);
          }
          observation = JSON.stringify(
            hits.map((h) => ({ title: h.path, snippet: h.snippet, score: h.score })),
            null,
            0,
          );
          if (!hits.length) observation = "No results.";
        }
      } else if (action === "read") {
        try {
          const note = await readNote(actionInput, deps.vault, deps.searchIndex);
          observed.set(note.path, note.content);
          observation = note.content.slice(0, MAX_NOTE_CHARS);
        } catch (e: any) {
          observation = `Note not found: ${actionInput}`;
        }
      } else {
        observation = `Unknown action: ${action || "(empty)"}. Use "search", "read" or "finish".`;
      }

      steps.push({
        stepIndex: steps.length,
        type: "observation",
        content: observation,
        toolOutput: { observation },
        usage,
      });

      history.push({ thought, action, actionInput, observation });
    }

    if (!finalPayload) {
      // Exploration is over — spend the reserved call on the synthesis.
      const synthesized = await this.synthesize(question, history, deps, observed, {
        inputTokens,
        outputTokens,
        costUsd,
        llmCalls,
      });
      if (synthesized) {
        finalPayload = synthesized.payload;
        inputTokens = synthesized.usage.inputTokens;
        outputTokens = synthesized.usage.outputTokens;
        costUsd = synthesized.usage.costUsd;
        llmCalls = synthesized.llmCalls;
        for (const st of synthesized.steps) {
          st.stepIndex = steps.length;
          steps.push(st);
        }
        forcedFinish = true;
        stopReason = stopReason || "synthesis after exploration limit";
      } else {
        forcedFinish = true;
        stopReason = stopReason || `maxSteps=${maxSteps} reached`;
        finalPayload = this.forcedAnswer(history, observed);
      }
    }

    const { valid, invalid } = validateCitations(finalPayload.citations, deps.searchIndex);
    // A model that returns no citations at all still answered from the notes it
    // observed — those notes are the honest citation set.
    const citations = valid.length || !observed.size ? valid : Array.from(observed.keys());

    const finalStep: ResearchAnswer["trace"]["steps"][number] = {
      stepIndex: steps.length,
      type: "final",
      content: finalPayload.answer,
      toolOutput: {
        citations,
        invalidCitations: invalid,
        gaps: finalPayload.gaps,
        forced_finish: forcedFinish,
        stopReason,
        llmCalls,
      },
    };

    // When the synthesis call already produced the final step, enrich it
    // instead of adding a second "final" entry.
    const last = steps[steps.length - 1];
    if (last && last.type === "final" && (last.toolOutput as any)?.synthesis) {
      last.content = finalPayload.answer;
      last.toolOutput = { ...(last.toolOutput as any), ...finalStep.toolOutput };
    } else {
      steps.push(finalStep);
    }

    return {
      text: finalPayload.answer,
      citations,
      gaps: finalPayload.gaps,
      trace: { steps },
      usage: {
        inputTokens,
        outputTokens,
        costUsd: Math.round(costUsd * 1000000) / 1000000,
        wallClockMs: Math.round(performance.now() - started),
      },
    };
  }

  /**
   * Final synthesis call. It is the last call the engine is allowed to make and
   * it turns the collected observations into a proper answer. Returns null when
   * the budget does not allow another call or the model output is unusable.
   */
  private async synthesize(
    question: ResearchQuestion,
    history: HistoryEntry[],
    deps: ResearchDeps,
    observed: Map<string, string>,
    state: { inputTokens: number; outputTokens: number; costUsd: number; llmCalls: number },
  ): Promise<{
    payload: FinalAnswerPayload;
    usage: { inputTokens: number; outputTokens: number; costUsd: number };
    llmCalls: number;
    steps: ResearchAnswer["trace"]["steps"];
  } | null> {
    if (state.llmCalls >= deps.budget.maxLlmCalls) return null;
    if (state.costUsd >= deps.budget.maxUsd) return null;

    const notes = Array.from(observed.entries())
      .map(([p, text]) => `- ${p}: ${(text || "").replace(/\s+/g, " ").trim().slice(0, 240)}`)
      .join("\n");

    const userPrompt = [
      `QUESTION: ${question.text}`,
      "",
      "NOTES FOUND:",
      notes,
      "",
      "The exploration budget is exhausted. Synthesize the final answer now from the notes above.",
      "",
      "HISTORY:",
      ...history.map(
        (h) => `Thought: ${h.thought}\nAction: ${h.action}(${h.actionInput})\nObservation: ${h.observation}`,
      ),
    ].join("\n");

    const res = await deps.llm.complete(
      loadPrompt("research/react.synthesis.system.md"),
      userPrompt,
      { model: deps.config.model, maxTokens: deps.config.maxTokensPerCall, temperature: 0 },
    );

    const usage = {
      inputTokens: res.usage?.inputTokens || 0,
      outputTokens: res.usage?.outputTokens || 0,
    };
    const costUsd = safeCost(deps.config.model, usage);
    const parsed = parseAgentJson(res.text);
    if (!parsed.ok) return null;

    const data = parsed.data || {};
    const rawPayload =
      data.finalAnswer && typeof data.finalAnswer === "object"
        ? data.finalAnswer
        : data.action === "finish" && data.finalAnswer
          ? data.finalAnswer
          : data;
    const payload = normalizeFinalPayload(rawPayload);
    if (!payload.answer && !payload.citations.length) return null;

    return {
      payload,
      usage: {
        inputTokens: state.inputTokens + usage.inputTokens,
        outputTokens: state.outputTokens + usage.outputTokens,
        costUsd: Math.round((state.costUsd + costUsd) * 1000000) / 1000000,
      },
      llmCalls: state.llmCalls + 1,
      steps: [
        {
          stepIndex: 0, // renumbered by the caller
          type: "final",
          content: payload.answer,
          toolOutput: { citations: payload.citations, gaps: payload.gaps, synthesis: true },
          usage,
        },
      ],
    };
  }

  private buildUserPrompt(
    question: ResearchQuestion,
    history: HistoryEntry[],
    deps: ResearchDeps,
  ): string {
    const knownTitles = deps.searchIndex.docs.map((d) => d.path).slice(0, 200);
    const parts: string[] = [];
    parts.push(`QUESTION: ${question.text}`);
    parts.push("");
    parts.push("KNOWN NOTES (path = basename without .md):");
    parts.push(knownTitles.map((t) => `- ${t}`).join("\n"));
    parts.push("");
    parts.push("HISTORY:");
    if (!history.length) {
      parts.push("(empty — this is your first step)");
    } else {
      for (const h of history) {
        parts.push(`Thought: ${h.thought}`);
        parts.push(`Action: ${h.action}(${h.actionInput})`);
        parts.push(`Observation: ${h.observation}`);
        parts.push("");
      }
    }
    parts.push("Respond with the next JSON step.");
    return parts.join("\n");
  }

  /**
   * Builds a best-effort answer when the loop ended without an explicit finish.
   * Everything the agent actually observed (search snippets and full reads) is
   * quoted and cited — the observations are the evidence, not only the notes
   * that were opened.
   */
  private forcedAnswer(history: HistoryEntry[], observed: Map<string, string>): FinalAnswerPayload {
    const thoughts = history.map((h) => h.thought).filter(Boolean).join(" ");
    const body = Array.from(observed.entries()).map(
      ([p, text]) => `- [[${p}]]: ${(text || "").replace(/\s+/g, " ").trim().slice(0, 240)}`,
    );
    return {
      answer: [
        "[forced finish] Исследование прервано лимитом шагов/бюджета — ответ собран из всего, что было найдено.",
        ...body,
        `Ход рассуждения: ${thoughts}`,
      ].join("\n"),
      citations: Array.from(observed.keys()),
      gaps: ["Research did not reach an explicit finish before the budget/limit was reached."],
    };
  }
}
