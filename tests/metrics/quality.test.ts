import { describe, it, expect } from "vitest";
import { computeQuality } from "../../src/metrics/quality";

describe("quality metrics", () => {
  it("ideal match", () => {
    const q = computeQuality({ result: { folder: "Projects", tags: ["a"], links: ["X"], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 1 }, gold: { expectedFolder: "Projects", expectedTags: ["a"], expectedLinks: ["X"] } });
    expect(q.folderCorrect).toBe(true);
    expect(q.tagsPrecision).toBe(1);
    expect(q.tagsRecall).toBe(1);
    expect(q.linksPrecision).toBe(1);
    expect(q.linksRecall).toBe(1);
  });

  it("empty result + non-empty gold -> precision 1, recall 0", () => {
    const q = computeQuality({ result: { folder: "X", tags: [], links: [], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 0 }, gold: { expectedFolder: "X", expectedTags: ["a"], expectedLinks: [] } });
    expect(q.tagsPrecision).toBe(1);
    expect(q.tagsRecall).toBe(0);
  });

  it("non-empty result + empty gold -> precision 0, recall 1", () => {
    const q = computeQuality({ result: { folder: "X", tags: ["a"], links: [], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 1 }, gold: { expectedFolder: "X", expectedTags: [], expectedLinks: [] } });
    expect(q.tagsPrecision).toBe(0);
    expect(q.tagsRecall).toBe(1);
  });

  it("partial intersection", () => {
    const q = computeQuality({ result: { folder: "X", tags: ["a", "b", "c"], links: [], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 1 }, gold: { expectedFolder: "X", expectedTags: ["b", "c", "d"], expectedLinks: [] } });
    expect(q.tagsPrecision).toBeCloseTo(2 / 3);
    expect(q.tagsRecall).toBeCloseTo(2 / 3);
  });

  it("extra tags", () => {
    const q = computeQuality({ result: { folder: "X", tags: ["a", "b", "c", "d"], links: [], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 1 }, gold: { expectedFolder: "X", expectedTags: ["a", "b"], expectedLinks: [] } });
    expect(q.tagsPrecision).toBe(0.5);
    expect(q.tagsRecall).toBe(1);
  });

  it("missing tags", () => {
    const q = computeQuality({ result: { folder: "X", tags: ["a"], links: [], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 1 }, gold: { expectedFolder: "X", expectedTags: ["a", "b", "c"], expectedLinks: [] } });
    expect(q.tagsPrecision).toBe(1);
    expect(q.tagsRecall).toBeCloseTo(1 / 3);
  });

  it("folder wrong but tags ok", () => {
    const q = computeQuality({ result: { folder: "Y", tags: ["a"], links: [], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 1 }, gold: { expectedFolder: "X", expectedTags: ["a"], expectedLinks: [] } });
    expect(q.folderCorrect).toBe(false);
    expect(q.tagsPrecision).toBe(1);
  });

  it("deduplicates tags", () => {
    const q = computeQuality({ result: { folder: "X", tags: ["a", "a", "b"], links: [], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 1 }, gold: { expectedFolder: "X", expectedTags: ["a", "b"], expectedLinks: [] } });
    expect(q.tagsPrecision).toBe(1);
    expect(q.tagsRecall).toBe(1);
  });

  it("links precision/recall", () => {
    const q = computeQuality({ result: { folder: "X", tags: [], links: ["A", "B"], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 1 }, gold: { expectedFolder: "X", expectedTags: [], expectedLinks: ["B", "C"] } });
    expect(q.linksPrecision).toBe(0.5);
    expect(q.linksRecall).toBe(0.5);
  });

  it("both empty", () => {
    const q = computeQuality({ result: { folder: "X", tags: [], links: [], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 1 }, gold: { expectedFolder: "X", expectedTags: [], expectedLinks: [] } });
    expect(q.tagsPrecision).toBe(1);
    expect(q.tagsRecall).toBe(1);
  });
});
