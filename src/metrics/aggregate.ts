import { QualityMetrics } from "./quality";

export interface RunSample {
  quality: QualityMetrics;
  costUsd: number;
  wallClockMs: number;
  failed: boolean;
}

export interface AggregateResult {
  n: number;
  failed: number;
  folderAcc: { mean: number; std: number };
  tagsPrecision: { mean: number; std: number };
  tagsRecall: { mean: number; std: number };
  linksPrecision: { mean: number; std: number };
  linksRecall: { mean: number; std: number };
  costUsd: { mean: number; std: number };
  wallClockMs: { mean: number; std: number };
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sampleStd(arr: number[]): number {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  const variance = arr.reduce((sum, x) => sum + Math.pow(x - m, 2), 0) / (arr.length - 1); // n-1
  return Math.sqrt(variance);
}

/**
 * Aggregate samples. failed samples excluded from means (but counted in failed/n).
 * Uses sample std (n-1). If all failed or empty, returns zeros.
 */
export function aggregate(samples: RunSample[]): AggregateResult {
  const n = samples.length;
  const failed = samples.filter((s) => s.failed).length;
  const valid = samples.filter((s) => !s.failed);

  if (valid.length === 0) {
    return {
      n,
      failed,
      folderAcc: { mean: 0, std: 0 },
      tagsPrecision: { mean: 0, std: 0 },
      tagsRecall: { mean: 0, std: 0 },
      linksPrecision: { mean: 0, std: 0 },
      linksRecall: { mean: 0, std: 0 },
      costUsd: { mean: 0, std: 0 },
      wallClockMs: { mean: 0, std: 0 },
    };
  }

  const folderAccArr = valid.map((s) => (s.quality.folderCorrect ? 1 : 0));
  const tagsPArr = valid.map((s) => s.quality.tagsPrecision);
  const tagsRArr = valid.map((s) => s.quality.tagsRecall);
  const linksPArr = valid.map((s) => s.quality.linksPrecision);
  const linksRArr = valid.map((s) => s.quality.linksRecall);
  const costArr = valid.map((s) => s.costUsd);
  const timeArr = valid.map((s) => s.wallClockMs);

  return {
    n,
    failed,
    folderAcc: { mean: mean(folderAccArr), std: sampleStd(folderAccArr) },
    tagsPrecision: { mean: mean(tagsPArr), std: sampleStd(tagsPArr) },
    tagsRecall: { mean: mean(tagsRArr), std: sampleStd(tagsRArr) },
    linksPrecision: { mean: mean(linksPArr), std: sampleStd(linksPArr) },
    linksRecall: { mean: mean(linksRArr), std: sampleStd(linksRArr) },
    costUsd: { mean: mean(costArr), std: sampleStd(costArr) },
    wallClockMs: { mean: mean(timeArr), std: sampleStd(timeArr) },
  };
}
