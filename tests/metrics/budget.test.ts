import { describe, it, expect } from "vitest";
import { checkBudget } from "../../src/metrics/budget";

describe("budget", () => {
  it("under budget", () => {
    const r = checkBudget([0.01, 0.02], 0.1);
    expect(r.exceeded).toBe(false);
    expect(r.overBy).toBe(0);
  });

  it("equal budget not exceeded", () => {
    const r = checkBudget([0.05], 0.05);
    expect(r.exceeded).toBe(false);
  });

  it("over budget", () => {
    const r = checkBudget([0.06], 0.05);
    expect(r.exceeded).toBe(true);
    expect(r.overBy).toBeCloseTo(0.01);
  });

  it("empty array", () => {
    const r = checkBudget([], 1);
    expect(r.exceeded).toBe(false);
    expect(r.total).toBe(0);
  });
});
