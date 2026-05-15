export interface UsageBudget {
  includedCalls: number;
  warningCalls: number;
  capCalls: number;
}

export const defaultApiBibleBudget: UsageBudget = {
  includedCalls: 300,
  warningCalls: 750,
  capCalls: 1500
};

export type UsageState = "included" | "warning" | "capped";

export function apiBibleUsageState(calls: number, budget: UsageBudget = defaultApiBibleBudget): UsageState {
  if (!Number.isInteger(calls) || calls < 0) {
    throw new Error("API.Bible calls must be a non-negative integer.");
  }
  if (calls >= budget.capCalls) {
    return "capped";
  }
  if (calls >= budget.warningCalls) {
    return "warning";
  }
  return "included";
}
