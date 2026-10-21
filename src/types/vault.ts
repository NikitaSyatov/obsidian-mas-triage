import { Note } from "./note";
import { TriageResult } from "./triage-result";
import { VaultContext } from "./vault-context";

export interface NoteRef {
  path: string;
}

export interface Vault {
  listInboxNotes(): Promise<NoteRef[]>;
  readNote(ref: NoteRef): Promise<Note>;
  applyTriage(ref: NoteRef, result: TriageResult): Promise<void>;
  getVaultContext(): Promise<VaultContext>;
}
