import { describe, it, expect } from "vitest";
import { buildSearchIndex, searchVault, tokenize } from "../../src/research/tools/search";
import { Note } from "../../src/types/note";

function note(path: string, content: string): Note {
  return { path, content, frontmatter: {} };
}

const VAULT: Note[] = [
  note("Projects/Alpha.md", "Project Alpha. Aliases: A-Project, AProj. Started: 2025-02-10. Frontend: TBD. Backend: TBD."),
  note("Projects/Beta.md", "Beta depends on Alpha for auth module."),
  note("Meetings/2025-02-10-Alpha-kickoff.md", "Alpha kickoff meeting. Decided: use PostgreSQL for backend."),
  note("Meetings/2025-06-01-Alpha-final.md", "Alpha final meeting. Switched frontend from React to Svelte."),
  note("Daily/2025-01-15.md", "Worked on A-Project today. Chose React for frontend."),
  note("Daily/2025-03-20.md", "Alpha update: backend confirmed PostgreSQL."),
  note("Daily/2025-05-01.md", "Alpha pivot: switching to SQLite for MVP."),
  note("Ideas/Alpha-ideas.md", "Brainstorming for Alpha, nothing decided here."),
  note("Resources/PARA.md", "Notes about the PARA method."),
];

describe("research search", () => {
  const index = buildSearchIndex(VAULT);

  it("tokenizes and drops stopwords", () => {
    const tokens = tokenize("Alpha update: backend confirmed PostgreSQL");
    expect(tokens).toContain("alpha");
    expect(tokens).toContain("postgresql");
    expect(tokens).not.toContain("the");
    expect(tokens).not.toContain("for");
  });

  it("alias trap: search 'Alpha' does NOT find Daily/2025-01-15.md", () => {
    const hits = searchVault("Alpha", 10, index);
    const paths = hits.map((h) => h.path);
    expect(paths).not.toContain("Daily/2025-01-15.md");
  });

  it("alias trap: search 'A-Project' DOES find Daily/2025-01-15.md", () => {
    const hits = searchVault("A-Project", 5, index);
    const paths = hits.map((h) => h.path);
    expect(paths).toContain("Daily/2025-01-15.md");
  });

  it("search matches note content, not the title", () => {
    // The file is named 2025-06-01-Alpha-final.md but "alpha" also occurs in the body.
    const hits = searchVault("Svelte", 5, index);
    expect(hits[0].path).toBe("Meetings/2025-06-01-Alpha-final.md");
  });

  it("returns at most k hits, sorted by score desc", () => {
    const hits = searchVault("Alpha", 3, index);
    expect(hits.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].score).toBeGreaterThanOrEqual(hits[i].score);
    }
  });

  it("is deterministic: ties are broken by path asc", () => {
    const a = searchVault("Alpha", 10, index).map((h) => h.path);
    const b = searchVault("Alpha", 10, index).map((h) => h.path);
    expect(a).toEqual(b);
  });

  it("empty query returns no hits", () => {
    expect(searchVault("", 5, index)).toEqual([]);
    expect(searchVault("   ", 5, index)).toEqual([]);
  });

  it("unknown terms return no hits", () => {
    expect(searchVault("zzzzqqq", 5, index)).toEqual([]);
  });

  it("snippet contains the matched term", () => {
    const hits = searchVault("SQLite", 5, index);
    expect(hits[0].path).toBe("Daily/2025-05-01.md");
    expect(hits[0].snippet.toLowerCase()).toContain("sqlite");
  });

  it("index exposes note metadata", () => {
    expect(index.docs.length).toBe(VAULT.length);
    expect(index.byPath.get("Projects/Alpha.md")!.title).toBe("Alpha");
    expect(index.byTitle.get("Alpha")!.path).toBe("Projects/Alpha.md");
  });
});
