# ARCHITECTURE

## Three layers
1. **Vault Adapter** (`src/vault/VaultAdapter.ts`) — only read/write Obsidian vault. No classification logic. Methods: `listInboxNotes()`, `readNote()`, `applyTriage()`, `getVaultContext()`.
2. **Triage Engine** (`src/engines/`) — swappable logic with unified interface `TriageEngine.triage(note, ctx): Promise<TriageResult>`. Implementations (stubs): `StubEngine` (debug-only heuristic), `SingleAgentEngine`, `MultiAgentEngine` (Centralized/Sequential/Parallel).
3. **UI + Integration** (`src/main.ts`, `src/ui/TriageModal.ts`) — Obsidian command in palette, modal with results table (Accept/Edit/Reject). Integration TODO.

Supporting: `src/agents/*` role definitions only, `src/llm/LlmClient.ts` interface, `src/metrics/*` for tokens/time/cost/quality, `src/config/defaultConfig.ts`.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ UI + Integration (main.ts, TriageModal.ts)                               │
│  - Command "Triage Inbox"                                                  │
│  - Modal: Accept / Edit / Reject                                          │
└─────────────────────────────┬─────────────────────────────────────────────┘
                              │  calls
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Triage Engine (TriageEngine interface)                                    │
│  StubEngine | SingleAgentEngine | MultiAgentEngine                        │
│    (arch: centralized/sequential/parallel + ablation flags)               │
└─────────────────────────────┬─────────────────────────────────────────────┘
                              │  uses
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Vault Adapter (VaultAdapter)                                               │
│  listInboxNotes/readNote/getVaultContext/applyTriage                       │
└─────────────────────────────┬─────────────────────────────────────────────┘
                              │  accesses
                              ▼
                        Obsidian Vault
```

## Data flow
`Note → TriageEngine → TriageResult → applyTriage`  
- Engine receives `Note` and `VaultContext` (folders/tags/noteTitles)
- Returns `TriageResult` {folder, tags, links, entities, confidence, reasoning?}
- `VaultAdapter.applyTriage()` applies user decision (Accept/Edit/Reject)

## Vault adapters
- `ObsidianVaultAdapter` (implements `Vault`) — uses Obsidian App API (plugin mode)
- `FsVaultAdapter` (implements `Vault`) — Node fs/path for headless experiments
- `createVaultAdapter(mode, opts)` in `src/vault/index.ts`

## MAS Parallel Fan-Out (implemented)
`MultiAgentEngine` with `architecture: "parallel"` runs `ClassifierAgent`, `LinkerAgent`, `ExtractorAgent` via `Promise.all` with CoT-checklist prompts (`reasoning_steps`). `AggregatorAgent` merges outputs (folder/tags/links/entities/confidence, concatenated reasoning). `useMessaging`/`useSharedMemory` read but not yet active (TODO(next stage)). `sequential`/`debate` throw `Not implemented: ... — следующий этап`.

## RunMetrics (extended)
Includes `runId`, `configHash`, `model`, `seed`, `agentBreakdown[]`, `useMessaging`, `useSharedMemory` for experiment tracking.

## Экспериментальный runner
`experiments/runner.ts` (ts-node): reads config, creates `FsVaultAdapter`, selects engine via `createEngine`, runs on Inbox notes (with `--limit`), compares to gold in `datasets/gold/` (folderAcc, tagsP/R, linksP/R), writes `experiments/results/<engineId>_<timestamp>.json` and `latest_<engineId>.json`, prints summary table.

## Experiment design (SAS vs MAS)
Compare **SingleAgentEngine (SAS)** vs **MultiAgentEngine** with architectures: `centralized`, `sequential`, `parallel`. 
Ablations via flags: `useSharedMemory`, `useMessaging`, `enabledAgents`. See `experiments/README.md`.

### Plan experiment (summary)
See detailed plan in [`experiments/README.md`](experiments/README.md).  
Key points: comparable token budget per note/task, `repeats>=3`, metrics quality/cost/time, ablations, criteria for MAS success/failure.

## Deep Research over Vault (отдельное измерение, не трогает Inbox Triage)

```
src/research/
├── types.ts          ResearchEngine / ResearchAnswer / ResearchTrace / GoldFact / ResearchDeps
├── tools/            search.ts (BM25 по содержимому) · read.ts · answer.ts (валидация цитат)
├── engines/          BaselineEngine (E0, 1 вызов) · ReActEngine (E2, цикл Thought/Action/Observation) · index.ts (factory)
├── evaluate.ts       coverage / groundedness / contradictionsFound / gapsMatched
└── mock/             ResearchMockLlm — фикстурный LLM для pipeline-smoke
```

- `ResearchEngine.solve(question, deps): Promise<ResearchAnswer>` — единый контракт для всех движков.
- `ResearchDeps` = { vault, llm, metrics, searchIndex, budget {maxUsd, maxLlmCalls}, config {model, maxTokensPerCall, maxSteps?} }.
- `SearchIndex` (BM25 без зависимостей) строится **runner-ом один раз** и передаётся обоим движкам —
  контракт извлечения у движков одинаковый, различается только способ вызова LLM.
- Поиск идёт **только по содержимому** заметок (заголовки не индексируются) — на этом свойстве
  построена ловушка с алиасом (`datasets/research/vault`).
- ReAct резервирует последний вызов под синтез ответа: при исчерпании шагов/бюджета движок
  всё равно возвращает нормальный ответ, помечая в trace `forced_finish: true`.
- Бюджет у baseline и react одинаковый по деньгам (`maxUsd`), различается по числу вызовов.
- CLI: `experiments/runner.ts --task research --engine baseline|react --question <id>`.
- TODO (по одной технике за шаг): CoT, ToT, Self-Reflection, LLM Compiler — см. `src/research/engines/index.ts`.
