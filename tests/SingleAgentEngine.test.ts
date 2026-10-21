import { describe, it, expect, vi } from "vitest";
import { SingleAgentEngine } from "../src/engines/SingleAgentEngine";
import { MockLlmClient } from "./mocks/MockLlmClient";
import { MetricsCollector } from "../src/metrics/MetricsCollector";
import { Note } from "../src/types/note";
import { VaultContext } from "../src/types/vault-context";

describe("SingleAgentEngine", () => {
  const ctx: VaultContext = { folders: ["Projects", "Notes"], tags: ["project", "daily"], noteTitles: ["Project Alpha"] };

  it("parses valid JSON and returns TriageResult", async () => {
    const llm = new MockLlmClient([{ text: JSON.stringify({ reasoning_steps: ["x"], folder: "Projects", tags: ["project"], links: ["Project Alpha"], entities: [], confidence: 0.8 }) }]);
    const metrics = new MetricsCollector();
    const engine = new SingleAgentEngine(llm, metrics, { model: "test", maxTokensPerNote: 100 });
    const note: Note = { path: "t.md", content: "test", frontmatter: {} };
    const res = await engine.triage(note, ctx);
    expect(res.folder).toBe("Projects");
    expect(res.tags).toContain("project");
  });

  it("returns confidence 0 on parse error", async () => {
    const llm = new MockLlmClient([{ text: "not json" }]);
    const metrics = new MetricsCollector();
    const engine = new SingleAgentEngine(llm, metrics, { model: "test", maxTokensPerNote: 100 });
    const note: Note = { path: "t.md", content: "test", frontmatter: {} };
    const res = await engine.triage(note, ctx);
    expect(res.confidence).toBe(0);
    expect(res.reasoning).toContain("parse error");
  });

  it("filters invalid tags not in ctx.tags", async () => {
    const llm = new MockLlmClient([{ text: JSON.stringify({ reasoning_steps: [], folder: "Projects", tags: ["badtag"], links: [], entities: [], confidence: 0.9 }) }]);
    const metrics = new MetricsCollector();
    const engine = new SingleAgentEngine(llm, metrics, { model: "test", maxTokensPerNote: 100 });
    const note: Note = { path: "t.md", content: "test", frontmatter: {} };
    const res = await engine.triage(note, ctx);
    expect(res.tags.includes("badtag")).toBe(false);
  });
});
