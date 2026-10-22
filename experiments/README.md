# Experiments

## Goal
Compare Single-Agent System (SAS) baseline vs Multi-Agent System (MAS) architectures for Inbox Triage with comparable token budget.

## Baseline
- `baseline_single_agent.json` — `SingleAgentEngine` (SAS)

## MAS configurations
- `mas_centralized.json` — Centralized (aggregator coordinates)
- `mas_sequential.json` — Sequential pipeline (classifier→linker/extractor→aggregator)
- `mas_parallel.json` — Parallel independent agents, aggregated

## Ablations
- `ablation_no_linker.json` — remove linker agent
- `ablation_no_shared_memory.json` — disable shared memory
- `ablation_no_messaging.json` — disable inter-agent messaging

## Metrics
- **quality**: precision/recall for suggested links/tags, user acceptance (accept/edit/reject)
- **cost**: tokens (input/output) → USD
- **time**: wall-clock (ms)

## Requirements
- **Comparable token budget** per note/task across conditions
- **repeats >= 3** for dispersion estimation
- **Fixed seed/vault** where possible

## Success criterion (MAS)
MAS outperforms SAS on quality at equal or lower budget, or shows explainable improvement with justification. Otherwise treat as negative result.

## Running
```bash
npx ts-node experiments/runner.ts --config experiments/configs/<config>.json
```
Results written to `experiments/results/` (JSON) via MetricsCollector.

## Первый прогон
- **Дата:** 2026-10-21
- **Режим:** real (API key provided)
- **Файлы:** `experiments/results/summary_20261021_225631.md`, `experiments/results/error_analysis_20261021_225652.md`
- **Краткий вывод:** Pipeline работает, оба движка выполняются. В текущих условиях много `parse_error` из-за формата ответов LLM - требуется доработка парсинга/промптов для реальных прогонов.

---

# Research task (Deep Research over Vault)

Отдельное измерение: вопрос по всему волту, а не по одной заметке из Inbox.
Inbox Triage (`src/engines/*`, `src/agents/*`) этой задачей не затрагивается.

## Что реализовано

| ID | Движок | Файл | Идея |
| :--- | :--- | :--- | :--- |
| E0 | Baseline | `src/research/engines/BaselineEngine.ts` | один поиск top-10 → один вызов LLM → ответ |
| E2 | ReAct | `src/research/engines/ReActEngine.ts` | цикл Thought → Action → Observation, до 6 вызовов |

Общие инструменты (используются обоими движками одинаково):
- `src/research/tools/search.ts` — BM25-подобный поиск **только по содержимому** заметок (без внешних зависимостей).
- `src/research/tools/read.ts` — чтение заметки по заголовку/пути.
- `src/research/tools/answer.ts` — валидация цитат и извлечение `[[wikilinks]]`.

Оценка: `src/research/evaluate.ts` — coverage / groundedness / contradictionsFound / gapsMatched.

## TODO — остальные техники

Реализовать как **отдельные движки** в `src/research/engines/index.ts` (по одной технике за шаг),
каждый — с тем же контрактом `ResearchEngine` и тем же бюджетом:

- **CoT (chain-of-thought)** — один вызов с явным каркасом рассуждения. Причина отложенного старта:
  нужен тот же контракт извлечения, что у E0/E2, иначе сравнение смешает «стиль рассуждения» и «извлечение».
- **ToT (tree-of-thought)** — ветвление + самооценка частичных ответов. Нужна модель-судья и
  токеновый бюджет, который не влезает в текущую модель `ResearchDeps.budget`.
- **Self-Reflection** — черновик → критика → правка. Частично пересекается с восстановлением ReAct,
  поэтому должен быть отдельной стадией пост-обработки, чтобы сравнение осталось честным.
- **LLM Compiler** — DAG подзадач, спланированный заранее. Нужен контракт планировщика и планировщик,
  раскладывающий подзадачи на общие `searchVault`/`readNote`.

## Данные и ловушка

- Генератор волта: `datasets/research/generate.py` (детерминированный, `--seed 42`).
- Волт: `datasets/research/vault/` (Projects / Meetings / Daily / Ideas / Resources / Archive).
- Gold: `datasets/research/gold/question_alpha.json` — 5 фактов (F1..F5), 2 противоречия (C1..C2), 1 gap.

**Ловушка (alias trap):** `Daily/2025-01-15.md` содержит решение (React), но в тексте нет слова
«Alpha» — только алиас «A-Project». Поиск по «Alpha» её не возвращает (поиск идёт по содержимому,
а не по заголовку). Найти её можно только через цепочку: `search("Alpha")` → `read("Projects/Alpha.md")`
(там `Aliases: A-Project, AProj`) → `search("A-Project")` → `read("Daily/2025-01-15.md")`.

Прочие ловушки: два временных противоречия (PostgreSQL→SQLite, React→Svelte),
шум (`Ideas/Alpha-ideas.md` — brainstorm, не решение), каноническая заметка без решений
(`Projects/Alpha.md` — `Frontend: TBD. Backend: TBD`), устаревшее (`Archive/Alpha-v0-archive.md`).

## Запуск

```bash
# 1. сгенерировать волт (детерминированно)
python3 datasets/research/generate.py --out ./datasets/research/vault --seed 42

# 2a. pipeline-smoke (без API-ключа, детерминированные фикстуры)
npx ts-node experiments/runner.ts --task research --config experiments/configs/research_baseline.json
npx ts-node experiments/runner.ts --task research --config experiments/configs/research_react.json

# 2b. real (нужен OPENAI_API_KEY; модель переопределяется --model)
OPENAI_API_KEY=... LLM_BASE_URL=https://api.deepseek.com/chat/completions \
  npx ts-node experiments/runner.ts --task research --config experiments/configs/research_baseline.json --model deepseek-chat
OPENAI_API_KEY=... LLM_BASE_URL=https://api.deepseek.com/chat/completions \
  npx ts-node experiments/runner.ts --task research --config experiments/configs/research_react.json --model deepseek-chat

# 3. отчёт
npx ts-node experiments/make_research_summary.ts \
  --baseline experiments/results/latest_research_baseline.json \
  --react    experiments/results/latest_research_react.json --mode real
```

Результаты: `experiments/results/research_<engine>_<ts>.json` и `latest_research_<engine>.json`,
отчёт: `experiments/results/research_summary_<ts>.md`.

## Бюджет

У обоих движков **одинаковый денежный бюджет $0.05** (`maxUsd` в конфигах) — иначе сравнение нечестно.
Различается число вызовов: baseline — 1 (`maxLlmCalls`), react — 6 (`maxLlmCalls`, `maxSteps`).
ReAct дополнительно резервирует последний вызов под синтез ответа, поэтому при исчерпании
шагов движок всё равно возвращает нормальный ответ, а не дамп наблюдений
(в trace помечается `forced_finish: true`).

