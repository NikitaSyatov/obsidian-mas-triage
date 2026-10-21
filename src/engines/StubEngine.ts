import { TriageEngine } from "../types/engine";
import { Note } from "../types/note";
import { VaultContext } from "../types/vault-context";
import { TriageResult } from "../types/triage-result";

// DEBUG ONLY: rule-based heuristic stub
export class StubEngine implements TriageEngine {
  async triage(note: Note, ctx: VaultContext): Promise<TriageResult> {
    const content = note.content.toLowerCase();
    if (content.includes("#проект") || content.includes("проект") || content.includes("project")) {
      return {
        folder: "Projects",
        tags: ["project"],
        links: [],
        entities: { people: [], projects: [], dates: [], concepts: [] },
        confidence: 0.3,
        reasoning: "rule-based stub",
      };
    }
    if (/\d{4}-\d{2}-\d{2}/.test(note.content)) {
      return {
        folder: "Notes",
        tags: ["daily"],
        links: [],
        entities: { people: [], projects: [], dates: [], concepts: [] },
        confidence: 0.3,
        reasoning: "rule-based stub",
      };
    }
    return {
      folder: "Notes",
      tags: [],
      links: [],
      entities: { people: [], projects: [], dates: [], concepts: [] },
      confidence: 0.3,
      reasoning: "rule-based stub",
    };
  }
}
