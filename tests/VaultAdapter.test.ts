import { describe, it, expect, vi } from "vitest";
import { FsVaultAdapter } from "../src/vault/FsVaultAdapter";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("FsVaultAdapter", () => {
  it("listInboxNotes returns only .md files", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
    const inbox = path.join(tmp, "00-Inbox");
    fs.mkdirSync(inbox);
    fs.writeFileSync(path.join(inbox, "a.md"), "hello");
    fs.writeFileSync(path.join(inbox, "b.txt"), "x");
    const adapter = new FsVaultAdapter(tmp, "00-Inbox");
    const notes = await adapter.listInboxNotes();
    expect(notes.length).toBe(1);
    expect(notes[0].path.endsWith(".md")).toBe(true);
  });

  it("readNote returns content", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
    const inbox = path.join(tmp, "00-Inbox");
    fs.mkdirSync(inbox);
    const p = path.join(inbox, "note.md");
    fs.writeFileSync(p, "# test\ncontent");
    const adapter = new FsVaultAdapter(tmp, "00-Inbox");
    const note = await adapter.readNote({ path: p });
    expect(note.content).toContain("test");
  });

  it("applyTriage writes frontmatter", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
    const inbox = path.join(tmp, "00-Inbox");
    fs.mkdirSync(inbox);
    const p = path.join(inbox, "note.md");
    fs.writeFileSync(p, "content");
    const adapter = new FsVaultAdapter(tmp, "00-Inbox");
    await adapter.applyTriage({ path: p }, { folder: "Notes", tags: ["x"], links: [], entities: { people: [], projects: [], dates: [], concepts: [] }, confidence: 0.5 });
    const c = fs.readFileSync(p, "utf-8");
    expect(c).toContain("triage_folder");
  });

  it("getVaultContext collects titles", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
    const inbox = path.join(tmp, "00-Inbox");
    const notes = path.join(tmp, "Notes");
    fs.mkdirSync(inbox);
    fs.mkdirSync(notes);
    fs.writeFileSync(path.join(notes, "MyNote.md"), "# hi");
    const adapter = new FsVaultAdapter(tmp, "00-Inbox");
    const ctx = await adapter.getVaultContext();
    expect(ctx.folders.length).toBeGreaterThan(0);
    expect(ctx.noteTitles).toContain("MyNote");
  });

  it("getVaultContext excludes Inbox from target folders", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
    fs.mkdirSync(path.join(tmp, "00-Inbox"));
    fs.mkdirSync(path.join(tmp, "Projects"));
    const adapter = new FsVaultAdapter(tmp, "00-Inbox");
    const ctx = await adapter.getVaultContext();
    expect(ctx.folders).toContain("Projects");
    expect(ctx.folders).not.toContain("00-Inbox");
  });

  it("readNote accepts vault-relative paths", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
    fs.mkdirSync(path.join(tmp, "Projects"));
    fs.writeFileSync(path.join(tmp, "Projects", "Alpha.md"), "# Alpha");
    const adapter = new FsVaultAdapter(tmp, "00-Inbox");
    const note = await adapter.readNote({ path: "Projects/Alpha.md" });
    expect(note.content).toContain("Alpha");
    expect(note.path).toBe("Projects/Alpha.md");
  });

  it("readNote still accepts cwd-relative paths", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
    fs.mkdirSync(path.join(tmp, "00-Inbox"));
    const file = path.join(tmp, "00-Inbox", "inbox_1.md");
    fs.writeFileSync(file, "# Inbox");
    const adapter = new FsVaultAdapter(tmp, "00-Inbox");
    const note = await adapter.readNote({ path: file });
    expect(note.content).toContain("Inbox");
  });
});

describe.skip("ObsidianVaultAdapter: тестируется smoke-тестом в Obsidian", () => {});
