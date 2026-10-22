import * as fs from "fs";
import * as path from "path";
import { Vault } from "../types/vault";
import { NoteRef, Note } from "../types/note";
import { VaultContext } from "../types/vault-context";
import { TriageResult } from "../types/triage-result";

export class FsVaultAdapter implements Vault {
  constructor(private rootPath: string, private inboxPath: string = "00-Inbox") {}

  async listInboxNotes(): Promise<NoteRef[]> {
    const inboxDir = path.join(this.rootPath, this.inboxPath);
    if (!fs.existsSync(inboxDir)) return [];
    const files = fs.readdirSync(inboxDir);
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({ path: path.join(inboxDir, f) }));
  }

  async readNote(ref: NoteRef): Promise<Note> {
    const content = fs.readFileSync(ref.path, "utf-8");
    return {
      path: ref.path,
      content,
      frontmatter: {},
    };
  }

  async applyTriage(ref: NoteRef, result: TriageResult): Promise<void> {
    // write back minimal frontmatter note if needed (headless)
    let content = fs.existsSync(ref.path) ? fs.readFileSync(ref.path, "utf-8") : "";
    const fm = `---\ntriage_folder: ${result.folder}\ntriage_tags: [${result.tags.map((t) => `"${t}"`).join(", ")}]\ntriage_links: [${result.links.map((l) => `"${l}"`).join(", ")}]\ntriage_confidence: ${result.confidence}\n---\n`;
    if (content.startsWith("---")) {
      // replace frontmatter if exists
      const end = content.indexOf("\n---", 3);
      if (end >= 0) {
        content = content.slice(end + 4);
      }
    }
    fs.writeFileSync(ref.path, fm + content);
  }

  async getVaultContext(): Promise<VaultContext> {
    const folders: string[] = [];
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir);
      for (const e of entries) {
        const full = path.join(dir, e);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (e === ".obsidian" || e.startsWith(".")) continue;
          const rel = path.relative(this.rootPath, full).replace(/\\/g, "/");
          // Inbox is the source folder, not a valid triage target
          if (rel === this.inboxPath || rel.startsWith(this.inboxPath + "/")) {
            walk(full);
            continue;
          }
          folders.push(rel);
          walk(full);
        }
      }
    };
    walk(this.rootPath);

    const tags = new Set<string>();
    const noteTitles: string[] = [];
    const walkFiles = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir);
      for (const e of entries) {
        const full = path.join(dir, e);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          if (e === ".obsidian" || e.startsWith(".")) continue;
          walkFiles(full);
        } else if (e.endsWith(".md")) {
          const rel = path.relative(this.rootPath, dir).replace(/\\/g, "/");
          if (rel === this.inboxPath || rel.startsWith(this.inboxPath + "/")) {
            continue;
          }
          noteTitles.push(path.basename(e, ".md"));
          try {
            const c = fs.readFileSync(full, "utf-8");
            const m = c.match(/#([^\s#]+)/g);
            if (m) {
              for (const t of m.slice(0, 5)) {
                tags.add(t.replace("#", ""));
              }
            }
          } catch (e) {}
        }
      }
    };
    walkFiles(this.rootPath);

    return {
      folders: Array.from(new Set(folders)).slice(0, 100),
      tags: Array.from(tags).slice(0, 50),
      noteTitles: Array.from(new Set(noteTitles)).slice(0, 200),
    };
  }
}
