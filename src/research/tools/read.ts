import { Vault } from "../../types/vault";
import { Note } from "../../types/note";
import { SearchIndex, basename } from "./search";

/**
 * Resolves a note reference to its vault-relative path.
 * Accepts a full path ("Projects/Alpha.md", "Projects/Alpha") or a bare
 * basename ("Alpha"). Throws when nothing matches.
 */
export function resolveNotePath(title: string, index: SearchIndex): string {
  const raw = (title || "").trim();
  if (!raw) throw new Error("Note not found: (empty title)");

  const candidates = [raw, raw.replace(/\.md$/i, "")];

  for (const c of candidates) {
    if (index.byPath.has(c)) return c;
  }
  for (const c of candidates) {
    const norm = c.replace(/\.md$/i, "");
    if (index.byPath.has(norm)) return norm;
    // path without extension
    for (const p of index.byPath.keys()) {
      if (p.replace(/\.md$/i, "") === norm) return p;
    }
  }
  const base = basename(raw);
  if (index.byTitle.has(base)) return index.byTitle.get(base)!.path;

  throw new Error(`Note not found: ${raw}`);
}

/**
 * Reads a note from the vault by title (exact basename match).
 * Throws `Note not found: ...` when the title cannot be resolved — the engine
 * decides how to recover from that.
 */
export function readNote(title: string, vault: Vault, index: SearchIndex): Promise<Note> {
  const path = resolveNotePath(title, index);
  return vault.readNote({ path });
}
