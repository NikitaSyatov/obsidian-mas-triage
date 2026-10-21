export interface NoteRef {
  path: string;
}

export interface Note {
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
}
