export function checkBudget(costs: number[], totalBudgetUsd: number): { exceeded: boolean; total: number; overBy: number } {
  const total = costs.reduce((a, b) => a + (b || 0), 0);
  const exceeded = total > totalBudgetUsd;
  const overBy = exceeded ? total - totalBudgetUsd : 0;
  return { exceeded, total, overBy };
}
