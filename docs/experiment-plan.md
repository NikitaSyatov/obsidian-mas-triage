# Experiment Plan

## Hypotheses
- **H1**: MAS Parallel gives increase in recall of `[[wikilinks]]` compared to SAS at comparable token budget.
- **H2**: Sequential pipeline is more stable (lower variance across repeats) than Parallel at comparable budget.
- **H3**: Ablation of `linker` degrades link-recall more than ablation of `messaging` (or vice versa) — test contribution of components.

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
3. Log via `MetricsCollector` (tokens/time/cost, `quality='unknown'` until labeled)
4. Analyze with error analysis
