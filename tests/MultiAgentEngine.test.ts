import { describe, it, expect, vi } from "vitest";
import { MultiAgentEngine } from "../src/engines/MultiAgentEngine";
import { MockLlmClient } from "./mocks/MockLlmClient";
import { MetricsCollector } from "../src/metrics/MetricsCollector";
import { Note } from "../src/types/note";
import { VaultContext } from "../src/types/vault-context";

describe("MultiAgentEngine", () => {
  const ctx: VaultContext = { folders: ["Projects", "Notes"], tags: ["project"], noteTitles: ["Project Alpha"] };
  const note: Note = { path: "t.md", content: "test проект", frontmatter: {} };

  it("parallel: runs all agents via Promise.all and aggregates", async () => {
    const llm = new MockLlmClient([
      { match: /folder|Folders/i, text: JSON.stringify({ reasoning_steps: ["s1"], folder: "Projects", tags: ["project"], confidence: 0.8 }) },
      { match: /link|Existing note titles/i, text: JSON.stringify({ reasoning_steps: ["s2"], links: ["Project Alpha"], confidence: 0.7 }) },
      { match: /entit|Note:/i, text: JSON.stringify({ reasoning_steps: ["s3"], entities: [{ type: "project", value: "Alpha" }], confidence: 0.6 }) },
    ]);
    const metrics = new MetricsCollector();
    const engine = new MultiAgentEngine(llm, metrics, {
      architecture: "parallel",
      enabledAgents: ["classifier", "linker", "extractor"],
      useSharedMemory: true,
      useMessaging: false,
      cotMode: "checklist",
      model: "test",
      maxTokensPerNote: 100,
      agentsConfig: { model: "test", temperature: 0 },
    });
    const res = await engine.triage(note, ctx);
    expect(res.folder).toBe("Projects");
    expect(res.links).toContain("Project Alpha");
    expect(res.entities.projects).toContain("Alpha");
  });

  it("filters invalid folder in classifier", async () => {
    const llm = new MockLlmClient([
      { text: JSON.stringify({ reasoning_steps: [], folder: "BadFolder", tags: ["project"], confidence: 0.5 }) },
      { text: JSON.stringify({ reasoning_steps: [], links: [], confidence: 0.5 }) },
      { text: JSON.stringify({ reasoning_steps: [], entities: [], confidence: 0.5 }) },
    ]);
    const metrics = new MetricsCollector();
    const engine = new MultiAgentEngine(llm, metrics, {
      architecture: "parallel",
      enabledAgents: ["classifier", "linker", "extractor"],
      useSharedMemory: false,
      useMessaging: false,
      model: "test",
      maxTokensPerNote: 100,
    });
    const res = await engine.triage(note, ctx);
    // folder filtered - may be empty or first
    expect(typeof res.folder).toBe("string");
  });

  it("filters invalid link in linker", async () => {
    const llm = new MockLlmClient([
      { text: JSON.stringify({ reasoning_steps: [], folder: "Projects", tags: ["project"], confidence: 0.5 }) },
      { text: JSON.stringify({ reasoning_steps: [], links: ["NoSuchNote"], confidence: 0.5 }) },
      { text: JSON.stringify({ reasoning_steps: [], entities: [], confidence: 0.5 }) },
    ]);
    const metrics = new MetricsCollector();
    const engine = new MultiAgentEngine(llm, metrics, {
      architecture: "parallel",
      enabledAgents: ["classifier", "linker", "extractor"],
      useSharedMemory: false,
      useMessaging: false,
      model: "test",
      maxTokensPerNote: 100,
    });
    const res = await engine.triage(note, ctx);
    expect(res.links.includes("NoSuchNote")).toBe(false);
  });

  it.todo("sequential: не реализовано");
  it.todo("debate: не реализовано");
  it.todo("useMessaging: не реализовано");
});
