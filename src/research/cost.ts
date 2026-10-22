import { computeCost, getPricingFor, Pricing } from "../metrics/cost";

export { getPricingFor };
export type { Pricing };

/** Pricing for a model, or a zeroed-out fallback for unknown models. */
export function safePricing(model: string): Pricing {
  try {
    return getPricingFor(model);
  } catch (e) {
    return { inputPer1M: 0, outputPer1M: 0 };
  }
}

/** Cost of an LLM call; unknown models are priced at 0 instead of throwing. */
export function safeCost(model: string, usage: { inputTokens: number; outputTokens: number }): number {
  const p = safePricing(model);
  return computeCost(usage, p);
}
