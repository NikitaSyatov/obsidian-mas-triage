#!/usr/bin/env ts-node
// CLI runner for experiments
import * as fs from "fs";
import * as path from "path";
import { FsVaultAdapter } from "../src/vault/FsVaultAdapter";
import { createEngine } from "../src/engines";
import { MetricsCollector } from "../src/metrics/MetricsCollector";
import { OpenAiLlmClient, LlmClient } from "../src/llm/LlmClient";
import { defaultConfig } from "../src/config/defaultConfig";
import * as crypto from "crypto";
import { execSync } from "child_process";
import { computeQuality } from "../src/metrics/quality";
import { aggregate } from "../src/metrics/aggregate";
import { checkBudget } from "../src/metrics/budget";
import { buildSearchIndex } from "../src/research/tools/search";
import { createResearchEngine } from "../src/research/engines";
import { evaluateResearch } from "../src/research/evaluate";
import { ResearchMockLlm } from "../src/research/mock/ResearchMockLlm";
import { ResearchAnswer, ResearchDeps, ResearchQuestion } from "../src/research/types";

function loadGold(goldDir: string, noteBase: string) {
  const p = path.join(goldDir, noteBase.replace(".md", ".json"));
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch (e) {}
  }
  return null;
}

function getGitCommit() {
  try {
    return execSync("git rev-parse HEAD").toString().trim();
  } catch (e) {
    return "unknown";
  }
}

function getConfigHash(config: any) {
  const sorted = JSON.stringify(config, Object.keys(config).sort());
  return crypto.createHash("sha256").update(sorted).digest("hex");
}

async function main() {
  const args = process.argv.slice(2);
  const configIdx = args.indexOf("--config");
  const limitIdx = args.indexOf("--limit");
  const outIdx = args.indexOf("--out");
  const taskIdx = args.indexOf("--task");
  const engineIdx = args.indexOf("--engine");
  const questionIdx = args.indexOf("--question");
  const modelIdx = args.indexOf("--model");
  const configPath = configIdx >= 0 ? args[configIdx + 1] : null;
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : undefined;
  const task = taskIdx >= 0 ? args[taskIdx + 1] : "triage";
  const engineOverride = engineIdx >= 0 ? args[engineIdx + 1] : undefined;
  const questionOverride = questionIdx >= 0 ? args[questionIdx + 1] : undefined;
  const modelOverride = modelIdx >= 0 ? args[modelIdx + 1] : undefined;
  if (!configPath) throw new Error("Usage: ts-node experiments/runner.ts --config <path> [--limit N] [--out <path>] [--task research --engine baseline|react --question <id>] [--model <name>]");

  const hasKey = !!process.env.OPENAI_API_KEY || !!process.env.DEEPSEEK_API_KEY;
  const mode = hasKey ? "real" : "pipeline-smoke";

  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  if (task === "research") {
    await runResearch({ config, configPath, mode, outIdx, engineOverride, questionOverride, modelOverride, args });
    return;
  }

  const vault = new FsVaultAdapter(config.vaultPath || "./datasets/synthetic_vault", "00-Inbox");
  const metrics = new MetricsCollector();
  const runId = crypto.randomUUID();
  const configHash = getConfigHash(config);
  const gitCommit = getGitCommit();
  const model = config.model || defaultConfig.model;
  const seed = config.seed || 42;
  metrics.setRunMeta({ runId, configHash, model, seed });

  // If pipeline-smoke, force stub for non-real runs? But we need to compare both - better to use config as-is but note mode
  const llm = new OpenAiLlmClient(process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || "", process.env.LLM_BASE_URL || "https://api.deepseek.com/chat/completions", model || "deepseek-chat");
  const engine = createEngine(config, { llm, metrics });

  const notes = await vault.listInboxNotes();
  const ctx = await vault.getVaultContext();
  const goldDir = path.resolve(process.cwd(), "datasets/gold");

  const perNoteMetrics: any[] = [];
  const failedNotes: any[] = [];
  const repeats = config.repeats || 1;
  const startTime = Date.now();
  
  for (let r = 0; r < repeats; r++) {
    let count = 0;
    for (const ref of notes) {
      if (limit && count >= limit) break;
      try {
        const note = await vault.readNote(ref);
        const res: any = await engine.triage(note, ctx);
        const base = path.basename(ref.path);
        const gold = loadGold(goldDir, base);
        let qm: any = null;
        if (gold) {
          qm = computeQuality({ result: res, gold });
        }
        perNoteMetrics.push({ notePath: ref.path, folderCorrect: qm?.folderCorrect, tagsPrecision: qm?.tagsPrecision, tagsRecall: qm?.tagsRecall, linksPrecision: qm?.linksPrecision, linksRecall: qm?.linksRecall, quality: qm, costUsd: 0, wallClockMs: res.wallClockMs || 0, rawResult: res, gold, failed: false });
        count++;
      } catch (e: any) {
        const base = path.basename(ref.path);
        const gold = loadGold(goldDir, base);
        perNoteMetrics.push({ notePath: ref.path, error: String(e.message), gold, failed: true });
        failedNotes.push({ notePath: ref.path, error: String(e.message) });
      }
    }
  }

  const outDir = path.resolve(process.cwd(), "experiments/results");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : path.join(outDir, `${config.engineId || "run"}_${ts}.json`);
  const latestPath = path.join(outDir, `latest_${config.engineId || "run"}.json`);
  
  const samples = perNoteMetrics
    .map((p: any) => {
      if (p.failed || p.error || !p.quality) {
        return { quality: p.quality || { folderCorrect: false, tagsPrecision: 0, tagsRecall: 0, linksPrecision: 0, linksRecall: 0 }, costUsd: p.costUsd || 0, wallClockMs: p.wallClockMs || 0, failed: true };
      }
      return { quality: p.quality, costUsd: p.costUsd || 0, wallClockMs: p.wallClockMs || 0, failed: false };
    });
  const agg = aggregate(samples);
  const validNotes = perNoteMetrics.filter((p: any) => !p.error && p.quality);
  const summary = {
    folderAcc: agg.folderAcc.mean,
    tagsP: agg.tagsPrecision.mean,
    tagsR: agg.tagsRecall.mean,
    linksP: agg.linksPrecision.mean,
    linksR: agg.linksRecall.mean,
    aggregate: agg,
  };
  
  const payload = {
    mode,
    gitCommit,
    configHash,
    runId,
    model,
    seed,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    config,
    repeats,
    totalNotes: notes.length,
    limit,
    failedNotesCount: failedNotes.length,
    perNoteMetrics,
    failedNotes,
    results: validNotes,
    metrics: metrics.getAll(),
    summary,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  fs.writeFileSync(latestPath, JSON.stringify(payload, null, 2));

  console.log("engine,folderAcc,tagsP,tagsR,linksP,linksR,costUsd,wallClockMs");
  const cost = metrics.getAll().reduce((a, b) => a + (b.costUsd || 0), 0);
  const time = metrics.getAll().reduce((a, b) => a + (b.wallClockMs || 0), 0);
  console.log(`${config.engineId},${summary.folderAcc.toFixed(3)},${summary.tagsP.toFixed(3)},${summary.tagsR.toFixed(3)},${summary.linksP.toFixed(3)},${summary.linksR.toFixed(3)},${cost.toFixed(6)},${time.toFixed(0)}`);
}

// ---------------------------------------------------------------------------
// Deep Research task
// ---------------------------------------------------------------------------

interface ResearchRunOptions {
  config: any;
  configPath: string;
  mode: string;
  outIdx: number;
  engineOverride?: string;
  questionOverride?: string;
  modelOverride?: string;
  args: string[];
}

async function runResearch(opts: ResearchRunOptions) {
  const { config, configPath, mode, outIdx, engineOverride, questionOverride, modelOverride, args } = opts;

  const engineId = engineOverride || config.engineId;
  if (!engineId) throw new Error("research task requires --engine baseline|react or config.engineId");

  const vaultPath = config.vaultPath || "./datasets/research/vault";
  const questionPath = config.questionPath || "./datasets/research/gold/question_alpha.json";
  const vault = new FsVaultAdapter(vaultPath, config.inboxPath || "00-Inbox");

  const questionRaw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), questionPath), "utf-8"));
  const question: ResearchQuestion = {
    id: questionOverride || questionRaw.id,
    text: questionRaw.text,
    gold: questionRaw.gold,
  };

  // One shared search index for all engines — the retrieval contract is identical.
  const refs = vault.listAllNotes();
  const notes = [];
  for (const ref of refs) notes.push(await vault.readNote(ref));
  const searchIndex = buildSearchIndex(notes);

  const model = modelOverride || config.model || defaultConfig.model;
  const seed = config.seed || 42;
  const runId = crypto.randomUUID();
  const configHash = getConfigHash(config);
  const gitCommit = getGitCommit();

  const llm: LlmClient = hasApiKey()
    ? new OpenAiLlmClient(
        process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || "",
        process.env.LLM_BASE_URL || "https://api.deepseek.com/chat/completions",
        model,
      )
    : new ResearchMockLlm(engineId === "react" ? "react" : "baseline");

  const metrics = new MetricsCollector();
  metrics.setRunMeta({ runId, configHash, model, seed });

  const engine = createResearchEngine(engineId);
  const deps: ResearchDeps = {
    vault,
    llm,
    metrics,
    searchIndex,
    budget: {
      maxUsd: config.maxUsd ?? 0.05,
      maxLlmCalls: config.maxLlmCalls ?? 1,
    },
    config: {
      model,
      maxTokensPerCall: config.maxTokensPerCall ?? 1500,
      maxSteps: config.maxSteps ?? 6,
    },
  };

  const repeats = config.repeats || 1;
  const runs: any[] = [];
  const startTime = Date.now();

  for (let r = 0; r < repeats; r++) {
    const answer: ResearchAnswer = await engine.solve(question, deps);
    const evaluation = evaluateResearch(answer, question.gold);
    runs.push({
      repeat: r,
      answer: {
        text: answer.text,
        citations: answer.citations,
        gaps: answer.gaps,
        usage: answer.usage,
        trace: answer.trace,
      },
      evaluation,
    });
  }

  const costUsd = runs.reduce((a, x) => a + (x.answer.usage.costUsd || 0), 0);
  const wallClockMs = runs.reduce((a, x) => a + (x.answer.usage.wallClockMs || 0), 0);
  const llmCalls = metrics.getAll().length;
  const avg = (fn: (x: any) => number) => runs.reduce((a, x) => a + fn(x), 0) / Math.max(1, runs.length);
  const perRun = (total: number) => total / Math.max(1, runs.length);

  const summary = {
    coverage: avg((x) => x.evaluation.coverage),
    groundedness: avg((x) => x.evaluation.groundedness),
    contradictionsFound: avg((x) => x.evaluation.contradictionsFound.length),
    gapsMatched: avg((x) => x.evaluation.gapsMatched.length),
    costUsd,
    costUsdPerRun: perRun(costUsd),
    wallClockMs,
    wallClockMsPerRun: perRun(wallClockMs),
    llmCalls,
    llmCallsPerRun: perRun(llmCalls),
  };

  const outDir = path.resolve(process.cwd(), "experiments/results");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath =
    outIdx >= 0
      ? path.resolve(args[outIdx + 1])
      : path.join(outDir, `research_${engineId}_${ts}.json`);
  const latestPath = path.join(outDir, `latest_research_${engineId}.json`);

  const payload = {
    task: "research",
    mode,
    engineId,
    gitCommit,
    configHash,
    runId,
    model,
    seed,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    config,
    configPath,
    repeats,
    questionId: question.id,
    question,
    vaultPath,
    vaultNotes: refs.map((r) => r.path),
    budget: deps.budget,
    summary,
    runs,
    metrics: metrics.getAll(),
  };

  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  // An explicit --out means "write exactly here": the canonical `latest_*`
  // file stays reserved for the primary run of that engine.
  if (outIdx < 0) {
    fs.writeFileSync(latestPath, JSON.stringify(payload, null, 2));
  }

  console.log("engine,coverage,groundedness,contradictionsFound,gapsMatched,costUsdPerRun,wallClockMsPerRun,llmCallsPerRun");
  console.log(
    `${engineId},${summary.coverage.toFixed(3)},${summary.groundedness.toFixed(3)},${summary.contradictionsFound.toFixed(2)},${summary.gapsMatched.toFixed(2)},${summary.costUsdPerRun.toFixed(6)},${summary.wallClockMsPerRun.toFixed(0)},${summary.llmCallsPerRun.toFixed(1)}`,
  );
}

function hasApiKey(): boolean {
  return !!(process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

