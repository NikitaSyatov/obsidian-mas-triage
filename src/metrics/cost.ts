export interface Pricing {
  inputPer1M: number;
  outputPer1M: number;
}

// Pricing table - update if model changes (last updated: 2026-10)
const PRICING_TABLE: Record<string, Pricing> = {
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10.0 },
  "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
};

export function getPricingFor(model: string): Pricing {
  if (PRICING_TABLE[model]) {
    return PRICING_TABLE[model];
  }
  throw new Error(`Unknown model pricing: ${model}`);
}

export function computeCost(usage: { inputTokens: number; outputTokens: number }, pricing: Pricing): number {
  const cost = (usage.inputTokens * pricing.inputPer1M + usage.outputTokens * pricing.outputPer1M) / 1_000_000;
  // Round to 6 decimal places
  return Math.round(cost * 1000000) / 1000000;
}
