import { describe, it, expect } from "vitest";
import { aggregate } from "../../src/metrics/aggregate";

describe("aggregate metrics", () => {
  it("single sample", () => {
    const res = aggregate([{ quality: { folderCorrect: true, tagsPrecision: 0.5, tagsRecall: 0.5, linksPrecision: 0.5, linksRecall: 0.5 }, costUsd: 0.01, wallClockMs: 100, failed: false }]);
    expect(res.n).toBe(1);
    expect(res.folderAcc.mean).toBe(1);
    expect(res.folderAcc.std).toBe(0);
  });

  it("two samples std n-1", () => {
    const res = aggregate([
      { quality: { folderCorrect: true, tagsPrecision: 1, tagsRecall: 1, linksPrecision: 1, linksRecall: 1 }, costUsd: 0, wallClockMs: 0, failed: false },
      { quality: { folderCorrect: false, tagsPrecision: 0, tagsRecall: 0, linksPrecision: 0, linksRecall: 0 }, costUsd: 0, wallClockMs: 0, failed: false },
    ]);
    expect(res.folderAcc.mean).toBe(0.5);
    // sample std of [1,0] is sqrt(0.5)
    expect(res.folderAcc.std).toBeCloseTo(Math.sqrt(0.5));
  });

  it("three samples", () => {
    const res = aggregate([
      { quality: { folderCorrect: true, tagsPrecision: 1, tagsRecall: 1, linksPrecision: 1, linksRecall: 1 }, costUsd: 0, wallClockMs: 0, failed: false },
      { quality: { folderCorrect: true, tagsPrecision: 1, tagsRecall: 1, linksPrecision: 1, linksRecall: 1 }, costUsd: 0, wallClockMs: 0, failed: false },
      { quality: { folderCorrect: false, tagsPrecision: 0, tagsRecall: 0, linksPrecision: 0, linksRecall: 0 }, costUsd: 0, wallClockMs: 0, failed: false },
    ]);
    expect(res.folderAcc.mean).toBeCloseTo(2 / 3);
  });

  it("excludes failed from means but counts failed", () => {
    const res = aggregate([
      { quality: { folderCorrect: true, tagsPrecision: 1, tagsRecall: 1, linksPrecision: 1, linksRecall: 1 }, costUsd: 0.1, wallClockMs: 10, failed: false },
      { quality: { folderCorrect: false, tagsPrecision: 0, tagsRecall: 0, linksPrecision: 0, linksRecall: 0 }, costUsd: 999, wallClockMs: 999, failed: true },
    ]);
    expect(res.n).toBe(2);
    expect(res.failed).toBe(1);
    expect(res.folderAcc.mean).toBe(1);
    expect(res.costUsd.mean).toBe(0.1);
  });

  it("all failed", () => {
    const res = aggregate([
      { quality: { folderCorrect: false, tagsPrecision: 0, tagsRecall: 0, linksPrecision: 0, linksRecall: 0 }, costUsd: 0, wallClockMs: 0, failed: true },
    ]);
    expect(res.failed).toBe(1);
    expect(res.folderAcc.mean).toBe(0);
    expect(res.folderAcc.std).toBe(0);
  });

  it("empty array", () => {
    const res = aggregate([]);
    expect(res.n).toBe(0);
    expect(res.failed).toBe(0);
    expect(res.folderAcc.mean).toBe(0);
  });

  it("n counted including failed", () => {
    const res = aggregate([
      { quality: { folderCorrect: true, tagsPrecision: 1, tagsRecall: 1, linksPrecision: 1, linksRecall: 1 }, costUsd: 0, wallClockMs: 0, failed: false },
      { quality: { folderCorrect: false, tagsPrecision: 0, tagsRecall: 0, linksPrecision: 0, linksRecall: 0 }, costUsd: 0, wallClockMs: 0, failed: true },
    ]);
    expect(res.n).toBe(2);
  });
});
