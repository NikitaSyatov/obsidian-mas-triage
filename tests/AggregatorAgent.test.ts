import { describe, it, expect } from "vitest";
import { AggregatorAgent } from "../src/agents/AggregatorAgent";

describe("AggregatorAgent", () => {
  it("merges outputs and deduplicates", () => {
    const agg = new AggregatorAgent();
    const outputs: any[] = [
      { field: "classification", value: { folder: "Projects", tags: ["project", "project"] }, confidence: 0.8, reasoningSteps: ["c1"], usage: { inputTokens: 1, outputTokens: 1 }, wallClockMs: 1, rawText: "" },
      { field: "links", value: ["Note1"], confidence: 0.7, reasoningSteps: ["l1"], usage: { inputTokens: 1, outputTokens: 1 }, wallClockMs: 1, rawText: "" },
      { field: "entities", value: [{ type: "project", value: "X" }, { type: "project", value: "X" }], confidence: 0.6, reasoningSteps: ["e1"], usage: { inputTokens: 1, outputTokens: 1 }, wallClockMs: 1, rawText: "" },
    ];
    const res = agg.run(outputs);
    expect(res.folder).toBe("Projects");
    expect(res.tags.length).toBe(1);
    expect(res.links).toEqual(["Note1"]);
    expect(res.entities.projects).toEqual(["X"]);
    expect(res.confidence).toBeCloseTo((0.8+0.7+0.6)/3);
  });
});
