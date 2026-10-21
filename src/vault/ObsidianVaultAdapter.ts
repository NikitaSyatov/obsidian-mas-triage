import { App, TFile, TFolder } from "obsidian";
import { Note } from "../types/note";
import { NoteRef } from "../types/note";
import { VaultContext } from "../types/vault-context";
import { TriageResult } from "../types/triage-result";
import { Vault } from "../types/vault";

export class ObsidianVaultAdapter implements Vault {
  constructor(private app: App, private inboxPath: string = "00-Inbox") {}

  async listInboxNotes(): Promise<NoteRef[]> {
    const folder = this.app.vault.getAbstractFileByPath(this.inboxPath);
    if (!folder || !(folder instanceof TFolder)) {
      return [];
    }
    const files: NoteRef[] = [];
    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        files.push({ path: child.path });
      }
    }
    return files;
  }

  async readNote(ref: NoteRef): Promise<Note> {
    const file = this.app.vault.getAbstractFileByPath(ref.path);
    if (!(file instanceof TFile)) {
      throw new Error("Note not found");
    }
    const content = await this.app.vault.read(file);
    const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter || {};
    return {
      path: file.path,
      content,
      frontmatter: { ...frontmatter },
    };
  }

  async getVaultContext(): Promise<VaultContext> {
    const folders: string[] = [];
    this.app.vault.getAllLoadedFiles().forEach((f) => {
      if (f instanceof TFolder) {
        const path = f.path;
        if (!path) return;
        if (path.startsWith(".obsidian")) return;
        if (path.split("/").some((p) => p.startsWith("."))) return;
        folders.push(path);
      }
    });

    const tagMap: any = (this.app.metadataCache as any).getTags ? (this.app.metadataCache as any).getTags() : {};
    const tags = Object.keys(tagMap || {})
      .map((t) => String(t).replace(/^#/, ""))
      .slice(0, 50);

    const noteTitles: string[] = [];
    this.app.vault.getMarkdownFiles().forEach((f) => {
      if ((f.parent?.path === this.inboxPath) || f.path.startsWith(this.inboxPath + "/")) {
        return;
      }
      noteTitles.push(f.basename);
    });

    return {
      folders: Array.from(new Set(folders)),
      tags: Array.from(new Set(tags)),
      noteTitles: Array.from(new Set(noteTitles)),
    };
  }

  async applyTriage(ref: NoteRef, result: TriageResult): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(ref.path);
    if (!(file instanceof TFile)) return;
    await this.app.fileManager.processFrontMatter(file, (fm) => {
      fm["triage_folder"] = result.folder;
      fm["triage_tags"] = result.tags;
      fm["triage_links"] = result.links;
      fm["triage_confidence"] = result.confidence;
    });

    if (result.folder && file.parent?.path && result.folder !== file.parent.path) {
      const targetPath = `${result.folder}/${file.name}`;
      try {
        await this.app.fileManager.renameFile(file, targetPath);
      } catch (e) {
        // best effort; do not throw
      }
    }
  }
}
