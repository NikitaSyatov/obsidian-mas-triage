#!/usr/bin/env ts-node
// CLI runner for experiments
import * as fs from "fs";
import * as path from "path";
import { FsVaultAdapter } from "../src/vault/FsVaultAdapter";
import { createEngine } from "../src/engines";
import { MetricsCollector } from "../src/metrics/MetricsCollector";
import { OpenAiLlmClient } from "../src/llm/LlmClient";
import { defaultConfig } from "../src/config/defaultConfig";
import * as crypto from "crypto";
import { execSync } from "child_process";
import { computeQuality } from "../src/metrics/quality";
import { aggregate } from "../src/metrics/aggregate";
import { checkBudget } from "../src/metrics/budget";

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
  const configPath = configIdx >= 0 ? args[configIdx + 1] : null;
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : undefined;
  if (!configPath) throw new Error("Usage: ts-node experiments/runner.ts --config <path> [--limit N] [--out <path>]");

  const hasKey = !!process.env.OPENAI_API_KEY;
  const mode = hasKey ? "real" : "pipeline-smoke";

  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
