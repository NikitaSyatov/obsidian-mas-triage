# Comparison Summary (2026-10-21T21-06-22-285Z)

## Метрики по новым модулям (computeQuality / aggregate, sample std n-1)

| Engine/Mode | n | failed | Folder Acc (mean±std) | Tags P (mean±std) | Tags R (mean±std) | Links P (mean±std) | Links R (mean±std) | Cost USD (mean±std) | Wall-clock ms (mean±std) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| stub (pipeline-smoke) | 12 | 0 | 0.833±0.389 | 0.833±0.389 | 1.000±0.000 | 1.000±0.000 | 0.000±0.000 | 0.000000±0.000000 | 5±0 |

## Примечания
- Метрики посчитаны через `src/metrics/quality.ts` и `src/metrics/aggregate.ts`
- std = sample standard deviation (n-1)
- failed исключены из средних, но учтены в n/failed
- Теги/линки дедуплицированы перед расчётом
