import { describe, it, expect } from "vitest";
import { createResearchEngine, RESEARCH_ENGINE_IDS } from "../../src/research/engines";
import { BaselineEngine } from "../../src/research/engines/BaselineEngine";
import { ReActEngine } from "../../src/research/engines/ReActEngine";

describe("research engine factory", () => {
  it("creates the baseline engine", () => {
    const engine = createResearchEngine("baseline");
    expect(engine).toBeInstanceOf(BaselineEngine);
    expect(engine.id).toBe("baseline");
  });

  it("creates the react engine", () => {
    const engine = createResearchEngine("react");
    expect(engine).toBeInstanceOf(ReActEngine);
    expect(engine.id).toBe("react");
  });

  it("throws for an unknown engine", () => {
    expect(() => createResearchEngine("nope")).toThrow(/Unknown research engine/);
  });

  it("exposes the implemented engine ids", () => {
    expect(RESEARCH_ENGINE_IDS).toEqual(["baseline", "react"]);
  });

  // --- остальные техники Deep Research: по одной за шаг ---------------------
  it.todo("E1 CoT: движок chain-of-thought с тем же контрактом ResearchEngine");
  it.todo("E3 ToT: движок tree-of-thought с ветвлением и самооценкой");
  it.todo("E4 Self-Reflection: стадия черновик → критика → правка");
  it.todo("E5 LLM Compiler: DAG подзадач, спланированный заранее");
});
