import { Vault } from "../../src/types/vault";
import { NoteRef, Note } from "../../src/types/note";
import { VaultContext } from "../../src/types/vault-context";
import { TriageResult } from "../../src/types/triage-result";

export class InMemoryVault implements Vault {
  private notes = new Map<string, Note>();

  setNote(path: string, note: Note) {
    this.notes.set(path, note);
  }

  async listInboxNotes(): Promise<NoteRef[]> {
    const refs: NoteRef[] = [];
    for (const p of this.notes.keys()) {
      if (p.includes("00-Inbox") || p.includes("Inbox")) refs.push({ path: p });
    }
    return refs;
  }

  async readNote(ref: NoteRef): Promise<Note> {
    const n = this.notes.get(ref.path);
    if (!n) throw new Error("not found");
    return n;
  }

  async applyTriage(ref: NoteRef, result: TriageResult): Promise<void> {
    // no-op
  }

  async getVaultContext(): Promise<VaultContext> {
    const folders = ["Projects", "Areas", "Notes", "Resources"];
    const tags = ["project", "daily", "inbox-triage"];
    const noteTitles = ["Project Alpha", "Meeting 2025-03-15"];
    return { folders, tags, noteTitles };
  }
}
