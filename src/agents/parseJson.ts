import * as fs from "fs";
import * as path from "path";

export function parseAgentJson(raw: string): { ok: boolean; data?: any; error?: string } {
  let text = raw.trim();
  // remove markdown code blocks
  const m = text.match(/```json\s*([\s\S]*?)\s*```/i) || text.match(/```\s*([\s\S]*?)\s*```/);
  if (m) {
    text = m[1].trim();
  }
  try {
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

export function loadPrompt(name: string): string {
  try {
    const p = path.resolve(process.cwd(), "prompts", name);
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8");
  } catch (e) {}
  return "";
}
