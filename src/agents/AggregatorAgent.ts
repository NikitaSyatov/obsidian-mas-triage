import { TriageResult } from "../types/triage-result";
import { AgentOutput } from "../types/agent";

export class AggregatorAgent {
  run(outputs: AgentOutput[]): TriageResult {
    const classification = outputs.find((o) => o.field === "classification");
    const linksOut = outputs.find((o) => o.field === "links");
    const entitiesOut = outputs.find((o) => o.field === "entities");

    const folder = classification && (classification.value as any)?.folder ? (classification.value as any).folder : "";
    const tagsRaw = classification && (classification.value as any)?.tags ? (classification.value as any).tags : [];
    const tags = Array.from(new Set(tagsRaw));

    const links = linksOut && Array.isArray(linksOut.value) ? linksOut.value : [];

    const entitiesRaw = entitiesOut && Array.isArray(entitiesOut.value) ? entitiesOut.value : [];
    const entitiesMap = new Map();
    for (const e of entitiesRaw) {
      entitiesMap.set(`${e.type}:${e.value}`, e);
    }
    const entitiesArr = Array.from(entitiesMap.values()) as any[];
    const entities: any = {
      people: entitiesArr.filter((e: any) => e.type === "person").map((e: any) => String(e.value)),
      projects: entitiesArr.filter((e: any) => e.type === "project").map((e: any) => String(e.value)),
      dates: entitiesArr.filter((e: any) => e.type === "date").map((e: any) => String(e.value)),
      concepts: entitiesArr.filter((e: any) => e.type === "concept").map((e: any) => String(e.value)),
    };

    const confidences = outputs.map((o) => o.confidence).filter((c) => typeof c === "number");
    const confidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

    const reasoningParts: string[] = [];
    for (const o of outputs) {
      if (o.reasoningSteps && o.reasoningSteps.length) {
        reasoningParts.push(`[${o.field}] ${o.reasoningSteps.join(" | ")}`);
      }
    }

    return {
      folder,
      tags: tags as string[],
      links: links as string[],
      entities: entities as any,
      confidence,
      reasoning: reasoningParts.join(" \n"),
    };
  }
}
