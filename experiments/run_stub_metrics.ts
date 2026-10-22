import * as fs from "fs";
import * as path from "path";
import { FsVaultAdapter } from "../src/vault/FsVaultAdapter";
import { StubEngine } from "../src/engines/StubEngine";
import { computeQuality } from "../src/metrics/quality";
import { aggregate } from "../src/metrics/aggregate";
import * as crypto from "crypto";

function loadGold(goldDir: string, noteBase: string) {
  const p = path.join(goldDir, noteBase.replace(".md", ".json"));
  if (fs.existsSync(p)) {
    try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch(e){}
  }
  return null;
}

async function main() {
  const vault = new FsVaultAdapter("./datasets/synthetic_vault", "00-Inbox");
  const engine = new StubEngine();
  const notes = await vault.listInboxNotes();
  const ctx = await vault.getVaultContext();
  const goldDir = path.resolve(process.cwd(), "datasets/gold");
  const samples: any[] = [];
  const perNoteMetrics: any[] = [];

  for (const ref of notes) {
    try {
      const note = await vault.readNote(ref);
      const res: any = await engine.triage(note, ctx);
      const base = path.basename(ref.path);
      const gold = loadGold(goldDir, base);
      let qm = null;
      if (gold) qm = computeQuality({ result: res, gold });
      perNoteMetrics.push({ notePath: ref.path, quality: qm, failed: false, result: res, gold });
      samples.push({ quality: qm, costUsd: 0, wallClockMs: 5, failed: false });
    } catch (e:any) {
      perNoteMetrics.push({ notePath: ref.path, error: String(e.message), failed: true });
      samples.push({ quality: { folderCorrect:false, tagsPrecision:0, tagsRecall:0, linksPrecision:0, linksRecall:0 }, costUsd: 0, wallClockMs: 0, failed: true });
    }
  }

  const agg = aggregate(samples);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const payload = {
    mode: "pipeline-smoke",
    engineId: "stub",
    timestamp: new Date().toISOString(),
    configHash: crypto.createHash("sha256").update("stub").digest("hex").slice(0,8),
    summary: { folderAcc: agg.folderAcc.mean, tagsP: agg.tagsPrecision.mean, tagsR: agg.tagsRecall.mean, linksP: agg.linksPrecision.mean, linksR: agg.linksRecall.mean, aggregate: agg },
    perNoteMetrics,
    samplesCount: samples.length
  };
  const out = path.resolve(process.cwd(), `experiments/results/stub_metrics_${ts}.json`);
  const latest = path.resolve(process.cwd(), "experiments/results/latest_stub.json");
  fs.writeFileSync(out, JSON.stringify(payload, null, 2));
  fs.writeFileSync(latest, JSON.stringify(payload, null, 2));
  console.log(out);
  console.log(latest);
}

main().catch(e=>{console.error(e);process.exit(1);});
