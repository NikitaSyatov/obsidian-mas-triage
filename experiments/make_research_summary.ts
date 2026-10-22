#!/usr/bin/env ts-node
/**
 * Builds the Deep Research comparison report from two runner outputs.
 *
 *   npx ts-node experiments/make_research_summary.ts \
 *     --baseline experiments/results/latest_research_baseline.json \
 *     --react    experiments/results/latest_research_react.json \
 *     --mode real
 */
import * as fs from "fs";
import * as path from "path";

interface Args {
  baseline: string;
  react: string;
  mode: string;
  out: string | null;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const get = (name: string, def: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : def;
  };
  return {
    baseline: get("baseline", "experiments/results/latest_research_baseline.json"),
    react: get("react", "experiments/results/latest_research_react.json"),
    mode: get("mode", "real"),
    out: args.includes("--out") ? get("out", "") : null,
  };
}

function readResult(p: string): any {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), p), "utf-8"));
}

function fmt(n: number, digits = 3): string {
  return Number.isFinite(n) ? n.toFixed(digits) : "n/a";
}

/** Did the engine cite the note that only the alias search can reach? */
function foundTrap(result: any): boolean {
  return result.runs.some((r: any) => (r.answer.citations || []).includes("Daily/2025-01-15.md"));
}

/** Did the engine mention the F4 keyword while citing the alias-only note? */
function foundF4(result: any): boolean {
  return result.runs.some((r: any) => r.evaluation.foundFacts.includes("F4"));
}

function traceExample(result: any, max = 5): string[] {
  for (const run of result.runs) {
    const steps = run.answer.trace.steps.filter(
      (s: any) => s.type === "thought" || s.type === "action" || s.type === "observation",
    );
    if (steps.length) {
      return steps.slice(0, max).map((s: any) => {
        const label = s.type === "action" ? `Action: ${s.content}` : s.type === "thought" ? `Thought: ${s.content}` : `Observation: ${s.content}`;
        return `- **${label}**`;
      });
    }
  }
  return [];
}

function main() {
  const args = parseArgs();
  const baseline = readResult(args.baseline);
  const react = readResult(args.react);

  const budget = baseline.budget?.maxUsd ?? 0.05;
  const rows = [
    { name: "baseline (E0)", res: baseline },
    { name: "react (E2)", res: react },
  ];

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve(process.cwd(), "experiments/results");
  const outPath = args.out ? path.resolve(process.cwd(), args.out) : path.join(outDir, `research_summary_${ts}.md`);

  const lines: string[] = [];
  lines.push(`# Deep Research — сравнение движков (${new Date().toISOString()})`);
  lines.push("");
  lines.push(`- Режим: \`${args.mode}\``);
  lines.push(`- Модель: \`${baseline.model}\``);
  lines.push(`- Вопрос: \`${baseline.questionId}\` — ${baseline.question.text}`);
  lines.push(`- Бюджет на движок: $${budget} (одинаковый для обоих)`);
  lines.push(`- Повторов: ${baseline.repeats}`);
  lines.push("");
  lines.push("## Метрики");
  lines.push("");
  lines.push("| Engine | coverage | groundedness | contradictionsFound | gapsMatched | costUsd/запуск | wallClockMs/запуск | llmCalls/запуск |");
  lines.push("| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const { name, res } of rows) {
    const s = res.summary;
    lines.push(
      `| ${name} | ${fmt(s.coverage)} | ${fmt(s.groundedness)} | ${fmt(s.contradictionsFound, 2)} | ${fmt(s.gapsMatched, 2)} | ${fmt(s.costUsdPerRun, 6)} | ${Math.round(s.wallClockMsPerRun)} | ${fmt(s.llmCallsPerRun, 1)} |`,
    );
  }
  lines.push("");

  lines.push("## Проверка ловушки (alias trap)");
  lines.push("");
  lines.push("`Daily/2025-01-15.md` содержит решение (React), но в тексте нет слова «Alpha» — только алиас «A-Project».");
  lines.push("Поиск по «Alpha» её не возвращает; найти её можно только через цепочку alias-поиска.");
  lines.push("");
  lines.push("| Engine | цитирует `Daily/2025-01-15.md` | нашёл факт F4 (React) |");
  lines.push("| :--- | :--- | :--- |");
  for (const { name, res } of rows) {
    lines.push(`| ${name} | ${foundTrap(res) ? "✅ да" : "❌ нет"} | ${foundF4(res) ? "✅ да" : "❌ нет"} |`);
  }
  lines.push("");
  for (const { name, res } of rows) {
    const perRun = res.runs
      .map((r: any, i: number) => `  - прогон ${i + 1}: coverage=${fmt(r.evaluation.coverage)}, факты=[${r.evaluation.foundFacts.join(", ")}], пропущены=[${r.evaluation.missedFacts.join(", ")}], противоречия=[${r.evaluation.contradictionsFound.join(", ")}]`)
      .join("\n");
    lines.push(`**${name}**`);
    lines.push(perRun);
    lines.push("");
  }

  lines.push("## Бюджет");
  lines.push("");
  lines.push(`| Engine | потрачено | доля от $${budget} | LLM-вызовов |`);
  lines.push("| :--- | ---: | ---: | ---: |");
  for (const { name, res } of rows) {
    const s = res.summary;
    const share = budget > 0 ? (s.costUsdPerRun / budget) * 100 : 0;
    lines.push(
      `| ${name} | $${fmt(s.costUsdPerRun, 6)} | ${fmt(share, 2)}% | ${fmt(s.llmCallsPerRun, 1)} |`,
    );
  }
  lines.push("");

  lines.push("## Пример trace (ReAct)");
  lines.push("");
  const trace = traceExample(react);
  if (trace.length) {
    lines.push(...trace);
  } else {
    lines.push("_trace пуст_");
  }
  lines.push("");

  lines.push("## Артефакты");
  lines.push("");
  lines.push(`- baseline: \`${args.baseline}\``);
  lines.push(`- react: \`${args.react}\``);
  lines.push(`- gold: \`datasets/research/gold/question_alpha.json\``);
  lines.push("");

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, lines.join("\n"), "utf-8");
  console.log(outPath);
}

main();
