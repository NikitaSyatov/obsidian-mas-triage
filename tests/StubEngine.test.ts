import { describe, it, expect } from "vitest";
import { StubEngine } from "../src/engines/StubEngine";
import { Note } from "../src/types/note";
import { VaultContext } from "../src/types/vault-context";

describe("StubEngine", () => {
  const ctx: VaultContext = { folders: ["Projects", "Notes"], tags: ["project", "daily"], noteTitles: [] };

  it("returns Projects for проект/project", async () => {
    const engine = new StubEngine();
    const note: Note = { path: "test.md", content: "нужно сделать проект", frontmatter: {} };
    const res = await engine.triage(note, ctx);
    expect(res.folder).toBe("Projects");
    expect(res.confidence).toBe(0.3);
    expect(res.links).toEqual([]);
  });

  it("adds daily tag for YYYY-MM-DD date", async () => {
    const engine = new StubEngine();
    const note: Note = { path: "test.md", content: "встреча 2025-03-15", frontmatter: {} };
    const res = await engine.triage(note, ctx);
    expect(res.tags).toContain("daily");
    expect(res.confidence).toBe(0.3);
  });

  it("defaults to Notes otherwise", async () => {
    const engine = new StubEngine();
    const note: Note = { path: "test.md", content: "просто заметка", frontmatter: {} };
    const res = await engine.triage(note, ctx);
    expect(res.folder).toBe("Notes");
    expect(res.confidence).toBe(0.3);
  });
});
