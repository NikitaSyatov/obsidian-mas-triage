import { describe, it, expect } from "vitest";
import { computeQuality } from "../../src/metrics/quality";
import { aggregate } from "../../src/metrics/aggregate";

describe("integration: runner metrics logic", () => {
  it("computes correct summary for 2 notes", () => {
    const samples = [
      { quality: computeQuality({ result: { folder: "Projects", tags: ["project"], links: ["A"], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 1 }, gold: { expectedFolder: "Projects", expectedTags: ["project"], expectedLinks: ["A"] } }), costUsd: 0.01, wallClockMs: 100, failed: false },
      { quality: computeQuality({ result: { folder: "Notes", tags: [], links: [], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 0 }, gold: { expectedFolder: "Projects", expectedTags: ["project"], expectedLinks: [] } }), costUsd: 0.01, wallClockMs: 100, failed: false },
    ];
    const agg = aggregate(samples);
    expect(agg.folderAcc.mean).toBe(0.5);
    expect(agg.failed).toBe(0);
  });

  it("failed note excluded from means", () => {
    const samples = [
      { quality: computeQuality({ result: { folder: "Projects", tags: ["project"], links: [], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 1 }, gold: { expectedFolder: "Projects", expectedTags: ["project"], expectedLinks: [] } }), costUsd: 0.01, wallClockMs: 100, failed: false },
      { quality: computeQuality({ result: { folder: "X", tags: [], links: [], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 0 }, gold: { expectedFolder: "Y", expectedTags: [], expectedLinks: [] } }), costUsd: 0, wallClockMs: 0, failed: true },
    ];
    const agg = aggregate(samples);
    expect(agg.n).toBe(2);
    expect(agg.failed).toBe(1);
    expect(agg.folderAcc.mean).toBe(1);
  });

  it("repeats 3 with varying results", () => {
    const samples = [
      { quality: computeQuality({ result: { folder: "A", tags: [], links: [], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 1 }, gold: { expectedFolder: "A", expectedTags: [], expectedLinks: [] } }), costUsd: 0.01, wallClockMs: 10, failed: false },
      { quality: computeQuality({ result: { folder: "B", tags: [], links: [], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 1 }, gold: { expectedFolder: "A", expectedTags: [], expectedLinks: [] } }), costUsd: 0.02, wallClockMs: 20, failed: false },
      { quality: computeQuality({ result: { folder: "A", tags: [], links: [], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 1 }, gold: { expectedFolder: "A", expectedTags: [], expectedLinks: [] } }), costUsd: 0.01, wallClockMs: 15, failed: false },
    ];
    const agg = aggregate(samples);
    expect(agg.n).toBe(3);
    expect(agg.folderAcc.std > 0).toBe(true);
  });
});
