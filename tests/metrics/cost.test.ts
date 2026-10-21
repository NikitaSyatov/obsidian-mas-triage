import { describe, it, expect } from "vitest";
import { computeCost, getPricingFor } from "../../src/metrics/cost";

describe("cost metrics", () => {
  it("gpt-4o-mini 1M+1M", () => {
    const p = getPricingFor("gpt-4o-mini");
    const c = computeCost({ inputTokens: 1000000, outputTokens: 1000000 }, p);
    expect(c).toBe(0.75);
  });

  it("only input", () => {
    const p = getPricingFor("gpt-4o-mini");
    const c = computeCost({ inputTokens: 1000000, outputTokens: 0 }, p);
    expect(c).toBe(0.15);
  });

  it("zero tokens", () => {
    const p = getPricingFor("gpt-4o-mini");
    const c = computeCost({ inputTokens: 0, outputTokens: 0 }, p);
    expect(c).toBe(0);
  });

  it("rounds to 6 decimals", () => {
    const p = getPricingFor("gpt-4o-mini");
    const c = computeCost({ inputTokens: 1000, outputTokens: 0 }, p);
    expect(c).toBe(0.00015);
  });

  it("unknown model throws", () => {
    expect(() => getPricingFor("unknown-model")).toThrow(/Unknown model/);
  });

  it("all models defined", () => {
    expect(getPricingFor("gpt-4o")).toBeDefined();
    expect(getPricingFor("gpt-4.1-mini")).toBeDefined();
  });
});
