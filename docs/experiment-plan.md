# Experiment Plan

## Hypotheses
- **H1**: MAS Parallel gives increase in recall of `[[wikilinks]]` compared to SAS at comparable token budget.
- **H2**: Sequential pipeline is more stable (lower variance across repeats) than Parallel at comparable budget.
- **H3**: Ablation of `linker` degrades link-recall more than ablation of `messaging` (or vice versa) — test contribution of components.

## Определения метрик
**Модули:** `src/metrics/quality.ts`, `src/metrics/cost.ts`, `src/metrics/aggregate.ts`, `src/metrics/budget.ts`

**Quality (computeQuality):**
- `folderCorrect = (result.folder === gold.expectedFolder)`
- Tags: `tagsPrecision = |res∩gold|/|res|` if res non-empty else 1.0; if both empty 1.0. If res empty, gold non-empty -> precision 1.0, recall 0.0. If gold empty, res non-empty -> precision 0.0, recall 1.0.
- Links: аналогично.
- **Дедупликация:** теги/линки дедуплицируются перед расчётом (`Array.from(new Set(...))`).
- **Пустой gold:** корректное «ничего не предлагать» не наказывается (recall=1.0 при пустом gold).

**Cost (computeCost):**
- `costUsd = (inputTokens*priceIn + outputTokens*priceOut)/1_000_000`, округление до 6 знаков.
- Цены в `getPricingFor(model)`: `gpt-4o-mini` (0.15/0.60), `gpt-4o` (2.5/10.0), `gpt-4.1-mini` (0.4/1.6). Неизвестная модель -> throw.

**Aggregate (aggregate):**
- `failed` samples **исключаются** из средних, но считаются в `n` и `failed`.
- **Стандартное отклонение:** выборочное (sample std), знаменатель `n-1`. При `n<=1` -> `std=0`.
- Если все failed или пустой массив -> все mean/std=0, `failed=n` или `failed=0,n=0`.

**Budget (checkBudget):** превышение только при `total > budget` (строгое).

## Metrics
- Quality: precision/recall for links/tags, user acceptance (accept/edit/reject)
- Cost: input/output tokens → USD
- Time: wall-clock ms

## Ablation design
Flags: `useSharedMemory`, `useMessaging`, `enabledAgents`. Configs in `experiments/configs/` cover no_linker/no_shared_memory/no_messaging.

## Criteria for success (MAS)
MAS outperforms SAS on quality at equal or lower budget, or shows explainable improvement with justification.

## Criteria for negative result (failure)
Treat as failure/negative if:
- MAS worse on quality at >= budget with no explanation
- Overhead (cost/time) disproportionate to quality gain
- High variance / unstable across repeats (need `repeats>=3`)
- Gains disappear under ablations with no interpretable mechanism

## Experimental protocol
1. Use fixed seed, comparable `maxTokensPerNote`/budget
2. Run each config `repeats>=3`
3. Log via `MetricsCollector` (tokens/time/cost, `quality` as `QualityMetrics`)
4. Analyze with error analysis

