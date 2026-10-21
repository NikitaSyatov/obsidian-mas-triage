export interface TriageResult {
  folder: string;
  tags: string[];
  links: string[]; // [[wikilinks]] suggestions
  entities: {
    people: string[];
    projects: string[];
    dates: string[];
    concepts: string[];
  };
  confidence: number; // 0..1
  reasoning?: string;
}
