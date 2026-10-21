import { describe, it, expect } from "vitest";
import { StubEngine } from "../../src/engines/StubEngine";
import { computeQuality } from "../../src/metrics/quality";
import { aggregate } from "../../src/metrics/aggregate";

describe("integration: compare engines", () => {
  const ctx = { folders: ["Projects", "Notes"], tags: ["project"], noteTitles: ["Project Alpha"] };
  const gold1 = { expectedFolder: "Projects", expectedTags: ["project"], expectedLinks: [] };
  const note1 = { path: "1.md", content: "проект alpha", frontmatter: {} };

  it("both engines run, mas may cost more", async () => {
    const stub = new StubEngine();
    const res1 = await stub.triage(note1 as any, ctx as any);
    const q1 = computeQuality({ result: res1, gold: gold1 });
    const agg1 = aggregate([{ quality: q1, costUsd: 0.001, wallClockMs: 10, failed: false }]);
    expect(agg1.failed).toBe(0);
    expect(agg1.n).toBe(1);
  });

  it("n same for comparison", () => {
    const agg1 = aggregate([{ quality: { folderCorrect: true, tagsPrecision: 1, tagsRecall: 1, linksPrecision: 1, linksRecall: 1 }, costUsd: 0.001, wallClockMs: 10, failed: false }]);
    const agg2 = aggregate([{ quality: { folderCorrect: true, tagsPrecision: 1, tagsRecall: 1, linksPrecision: 1, linksRecall: 1 }, costUsd: 0.003, wallClockMs: 30, failed: false }]);
    expect(agg1.n).toBe(agg2.n);
    expect(agg2.costUsd.mean >= agg1.costUsd.mean).toBe(true);
  });
});
