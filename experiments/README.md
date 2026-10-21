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
