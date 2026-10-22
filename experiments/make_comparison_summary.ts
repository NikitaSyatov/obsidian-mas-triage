import * as fs from "fs";
import * as path from "path";

function load(p: string) {
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch(e){ return null; }
}

async function main() {
  const stub = load("experiments/results/latest_stub.json");
  const sa = load("experiments/results/latest_single-agent.json");
  const ma = load("experiments/results/latest_mas-parallel.json");
  
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  let out = `# Comparison Summary (${ts})\n\n`;
  out += "## Метрики по новым модулям (computeQuality / aggregate, sample std n-1)\n\n";
  out += "| Engine/Mode | n | failed | Folder Acc (mean±std) | Tags P (mean±std) | Tags R (mean±std) | Links P (mean±std) | Links R (mean±std) | Cost USD (mean±std) | Wall-clock ms (mean±std) |\n";
  out += "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n";
  
  if (stub) {
    const a = stub.summary.aggregate;
    out += `| stub (pipeline-smoke) | ${a.n} | ${a.failed} | ${a.folderAcc.mean.toFixed(3)}±${a.folderAcc.std.toFixed(3)} | ${a.tagsPrecision.mean.toFixed(3)}±${a.tagsPrecision.std.toFixed(3)} | ${a.tagsRecall.mean.toFixed(3)}±${a.tagsRecall.std.toFixed(3)} | ${a.linksPrecision.mean.toFixed(3)}±${a.linksPrecision.std.toFixed(3)} | ${a.linksRecall.mean.toFixed(3)}±${a.linksRecall.std.toFixed(3)} | ${a.costUsd.mean.toFixed(6)}±${a.costUsd.std.toFixed(6)} | ${a.wallClockMs.mean.toFixed(0)}±${a.wallClockMs.std.toFixed(0)} |\n`;
  }
  if (sa) {
    const a = sa.summary.aggregate || {n:sa.summary.n||0, failed:sa.summary.failed||0, folderAcc:{mean:sa.summary.folderAcc,std:0}, tagsPrecision:{mean:sa.summary.tagsP,std:0}, tagsRecall:{mean:sa.summary.tagsR,std:0}, linksPrecision:{mean:sa.summary.linksP,std:0}, linksRecall:{mean:sa.summary.linksR,std:0}, costUsd:{mean:0,std:0}, wallClockMs:{mean:0,std:0}};
    out += `| single-agent (real/LAST) | ${a.n} | ${a.failed} | ${a.folderAcc.mean?.toFixed(3)||0}±${a.folderAcc.std?.toFixed(3)||0} | ${a.tagsPrecision.mean?.toFixed(3)||0}±${a.tagsPrecision.std?.toFixed(3)||0} | ${a.tagsRecall.mean?.toFixed(3)||0}±${a.tagsRecall.std?.toFixed(3)||0} | ${a.linksPrecision.mean?.toFixed(3)||0}±${a.linksPrecision.std?.toFixed(3)||0} | ${a.linksRecall.mean?.toFixed(3)||0}±${a.linksRecall.std?.toFixed(3)||0} | ${a.costUsd.mean?.toFixed(6)||0}±${a.costUsd.std?.toFixed(6)||0} | ${a.wallClockMs.mean?.toFixed(0)||0}±${a.wallClockMs.std?.toFixed(0)||0} |\n`;
  }
  if (ma) {
    const a = ma.summary.aggregate || {n:ma.summary.n||0, failed:ma.summary.failed||0, folderAcc:{mean:ma.summary.folderAcc,std:0}, tagsPrecision:{mean:ma.summary.tagsP,std:0}, tagsRecall:{mean:ma.summary.tagsR,std:0}, linksPrecision:{mean:ma.summary.linksP,std:0}, linksRecall:{mean:ma.summary.linksR,std:0}, costUsd:{mean:0,std:0}, wallClockMs:{mean:0,std:0}};
    out += `| mas-parallel (real/LAST) | ${a.n} | ${a.failed} | ${a.folderAcc.mean?.toFixed(3)||0}±${a.folderAcc.std?.toFixed(3)||0} | ${a.tagsPrecision.mean?.toFixed(3)||0}±${a.tagsPrecision.std?.toFixed(3)||0} | ${a.tagsRecall.mean?.toFixed(3)||0}±${a.tagsRecall.std?.toFixed(3)||0} | ${a.linksPrecision.mean?.toFixed(3)||0}±${a.linksPrecision.std?.toFixed(3)||0} | ${a.linksRecall.mean?.toFixed(3)||0}±${a.linksRecall.std?.toFixed(3)||0} | ${a.costUsd.mean?.toFixed(6)||0}±${a.costUsd.std?.toFixed(6)||0} | ${a.wallClockMs.mean?.toFixed(0)||0}±${a.wallClockMs.std?.toFixed(0)||0} |\n`;
  }
  
  out += "\n## Примечания\n";
  out += "- Метрики посчитаны через `src/metrics/quality.ts` и `src/metrics/aggregate.ts`\n";
  out += "- std = sample standard deviation (n-1)\n";
  out += "- failed исключены из средних, но учтены в n/failed\n";
  out += "- Теги/линки дедуплицированы перед расчётом\n";
  
  const f = `experiments/results/comparison_summary_${ts}.md`;
  fs.writeFileSync(f, out);
  fs.writeFileSync("experiments/results/comparison_summary_latest.md", out);
  console.log(f);
  console.log("experiments/results/comparison_summary_latest.md");
}

main();
