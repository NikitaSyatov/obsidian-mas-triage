import { describe, it, expect } from "vitest";
import { MetricsCollector } from "../src/metrics/MetricsCollector";
import { computeCost, getPricingFor } from "../src/metrics/cost";

describe("MetricsCollector", () => {
  it("computes wallClockMs and costUsd", async () => {
    const m = new MetricsCollector();
    m.setRunMeta({ model: "gpt-4o-mini" });
    m.start("note.md", "test");
    await new Promise((r) => setTimeout(r, 10));
    const r = m.end({ inputTokens: 1000000, outputTokens: 1000000 });
    expect(r.wallClockMs > 0).toBe(true);
    expect(r.costUsd).toBeGreaterThan(0);
  });

  it("costUsd matches computeCost", () => {
    const m = new MetricsCollector();
    m.setRunMeta({ model: "gpt-4o-mini" });
    m.start("n.md", "t");
    const r = m.end({ inputTokens: 10000, outputTokens: 5000 });
    const expected = computeCost({ inputTokens: 10000, outputTokens: 5000 }, getPricingFor("gpt-4o-mini"));
    expect(r.costUsd).toBe(expected);
  });

  it("exportToJson writes valid JSON", async () => {
    const m = new MetricsCollector();
    m.setRunMeta({ model: "gpt-4o-mini" });
    m.start("n.md", "t");
    m.end({ inputTokens: 10, outputTokens: 5 });
    const p = "/tmp/test-metrics.json";
    await m.exportToJson(p);
    const fs = await import("fs");
    const data = JSON.parse(fs.readFileSync(p, "utf-8"));
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toHaveProperty("costUsd");
    expect(data[0]).toHaveProperty("wallClockMs");
  });

  it("two calls do not overwrite", () => {
    const m = new MetricsCollector();
    m.setRunMeta({ model: "gpt-4o-mini" });
    m.start("n1.md", "t");
    m.end({ inputTokens: 1, outputTokens: 1 });
    m.start("n2.md", "t");
    m.end({ inputTokens: 2, outputTokens: 2 });
    expect(m.getAll().length).toBe(2);
  });

  it("end without start throws", () => {
    const m = new MetricsCollector();
    expect(() => m.end({ inputTokens: 1, outputTokens: 1 })).toThrow();
  });
});
