import { TriageResult } from "../types/triage-result";

export interface QualityInput {
  result: TriageResult;
  gold: { expectedFolder: string; expectedTags: string[]; expectedLinks: string[] };
}

export interface QualityMetrics {
  folderCorrect: boolean;
  tagsPrecision: number;
  tagsRecall: number;
  linksPrecision: number;
  linksRecall: number;
}

/**
 * Compute quality metrics against gold.
 * Rules:
 * - folderCorrect: exact match result.folder === gold.expectedFolder
 * - tagsPrecision = |result.tags ∩ expectedTags| / |result.tags|; if result.tags empty -> 1.0; if both empty -> 1.0
 * - tagsRecall = |result.tags ∩ expectedTags| / |expectedTags|; if expectedTags empty -> 1.0
 * - linksPrecision/linksRecall analogous
 * - Empty result and empty gold -> 1.0/1.0. Gold non-empty, result empty -> recall 0
 * - Tags/links are deduplicated before calculation (protection against bugs)
 */
export function computeQuality(input: QualityInput): QualityMetrics {
  const { result, gold } = input;
  const folderCorrect = result.folder === gold.expectedFolder;

  const resTags = Array.from(new Set((result.tags || []).filter((t) => typeof t === "string")));
  const goldTags = Array.from(new Set((gold.expectedTags || []).filter((t) => typeof t === "string")));
  let tagsPrecision = 1.0;
  let tagsRecall = 1.0;
  if (resTags.length === 0 && goldTags.length === 0) {
    tagsPrecision = 1.0;
    tagsRecall = 1.0;
  } else if (resTags.length === 0) {
    tagsPrecision = 1.0;
    tagsRecall = 0.0;
  } else if (goldTags.length === 0) {
    tagsPrecision = 0.0;
    tagsRecall = 1.0;
  } else {
    let tp = 0;
    for (const t of resTags) if (goldTags.includes(t)) tp++;
    tagsPrecision = tp / resTags.length;
    tagsRecall = tp / goldTags.length;
  }

  const resLinks = Array.from(new Set((result.links || []).filter((l) => typeof l === "string")));
  const goldLinks = Array.from(new Set((gold.expectedLinks || []).filter((l) => typeof l === "string")));
  let linksPrecision = 1.0;
  let linksRecall = 1.0;
  if (resLinks.length === 0 && goldLinks.length === 0) {
    linksPrecision = 1.0;
    linksRecall = 1.0;
  } else if (resLinks.length === 0) {
    linksPrecision = 1.0;
    linksRecall = 0.0;
  } else if (goldLinks.length === 0) {
    linksPrecision = 0.0;
    linksRecall = 1.0;
  } else {
    let tp = 0;
    for (const l of resLinks) if (goldLinks.includes(l)) tp++;
    linksPrecision = tp / resLinks.length;
    linksRecall = tp / goldLinks.length;
  }

  return { folderCorrect, tagsPrecision, tagsRecall, linksPrecision, linksRecall };
}
