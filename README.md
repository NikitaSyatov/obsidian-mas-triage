# Obsidian MAS Triage (baseline)

Status: **baseline implemented** (skeleton + working baseline). MAS engines/agents remain unimplemented for next stage.

## Goal
"AI-assistant for structured knowledge base (notes) management in Obsidian as multi-agent system". Task: **Inbox Triage** for notes in `00-Inbox/` — suggest target folder, tags, `[[wikilinks]]`, extracted entities, confidence.

## Experiment
Compare single-agent (SAS) vs MAS (Centralized/Sequential/Parallel) with comparable token budget. Metrics: quality, cost (tokens→USD), time (wall-clock).

## Requirements
- Node.js (LTS)
- Obsidian

## Setup
```bash
npm install
```

## Build
```bash
npm run build
```

## Установка в Obsidian
1. Соберите плагин: `npm run build` — в корне проекта появится `main.js`, `manifest.json` уже есть.
2. Скопируйте папку плагина в хранилище Obsidian:
   - Откройте папку вашего vault: `<vault>/.obsidian/plugins/`
   - Создайте папку `obsidian-mas-triage/`
   - Скопируйте в неё `main.js`, `manifest.json`. При желании скопируйте `styles.css` если появится.
3. Включите плагин: Настройки → Community plugins → включить "MAS Triage".
4. Настройте плагин: Настройки → Community plugins → MAS Triage → указать `Inbox path` (по умолчанию `00-Inbox`), выбрать `Engine` (`stub` или `single-agent`), `Model`, `OpenAI API Key`.
5. Запустите triage: Палитра команд (Ctrl/Cmd+P) → `Triage Inbox`. Откроется модальное окно с таблицей, кнопки Accept/Edit/Reject. При закрытии метрики сохранятся в `results/latest.json`.

## Разработка
```bash
npm run dev
```
Рекомендуется использовать [Hot Reload](https://github.com/pjeby/hot-reload) плагин для Obsidian для автоматической перезагрузки при изменении `main.js`.

## Run experiment (CLI)
```bash
npx ts-node experiments/runner.ts --config experiments/configs/baseline_single_agent.json
```
(Note: runner still stub; baseline UI path is via plugin command.)

## What's done (baseline)
- `VaultAdapter` (list/read/context/applyTriage)
- `StubEngine` (rule-based)
- `LlmClient` (OpenAI-compatible fetch)
- `MetricsCollector` (tokens/cost/time, exports JSON)
- `SingleAgentEngine` (LLM call + JSON parse + validation/filter)
- `TriageModal` (table + Accept/Edit/Reject)
- Command `Triage Inbox` + settings tab in `main.ts`
- Prompt in `prompts/single_agent.system.md`

## Тесты
```bash
npm test        # run tests
npm run test:watch
npm run typecheck
npm run check   # typecheck + test
```
- Покрыто: StubEngine, FsVaultAdapter, SingleAgentEngine, MultiAgentEngine (parallel), parseAgentJson, AggregatorAgent, MetricsCollector
- Тесты не делают реальных LLM-вызовов; `obsidian` замокан в `tests/setup.ts`
- Помечены `todo`: `sequential`, `debate`, `useMessaging` (MultiAgentEngine), `ObsidianVaultAdapter` (smoke-тест только в Obsidian)

## TODO
- Implement sequential/debate architectures
- Implement messaging/shared memory
- Improve LLM parsing
- Full experiment runner logic
- Error analysis / real experiments

