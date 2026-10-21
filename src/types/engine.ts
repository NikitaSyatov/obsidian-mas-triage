import { Note } from "./note";
import { VaultContext } from "./vault-context";
import { TriageResult } from "./triage-result";

export interface TriageEngine {
  triage(note: Note, ctx: VaultContext): Promise<TriageResult>;
}
