export const defaultConfig = {
  paths: {
    inbox: "00-Inbox/",
    resultsDir: "experiments/results/",
  },
  model: "gpt-4o-mini",
  maxTokensPerNote: 1024,
  totalBudgetUsd: 5.0,
  temperature: 0,
  seed: 12345,
  prices: {
    // Prices per 1M tokens; update if model changes
    inputPer1M: 0.15,
    outputPer1M: 0.6,
  },
};
