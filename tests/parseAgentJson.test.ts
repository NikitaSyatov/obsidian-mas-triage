import { describe, it, expect } from "vitest";
import { parseAgentJson } from "../src/agents/parseJson";

describe("parseAgentJson", () => {
  it("parses valid JSON", () => {
    const res = parseAgentJson('{"a": 1}');
    expect(res.ok).toBe(true);
    expect(res.data.a).toBe(1);
  });

  it("parses JSON in code block", () => {
    const res = parseAgentJson('```json\n{"a": 2}\n```');
    expect(res.ok).toBe(true);
    expect(res.data.a).toBe(2);
  });

  it("handles extra fields", () => {
    const res = parseAgentJson('{"a": 1, "b": 2}');
    expect(res.ok).toBe(true);
  });
});
