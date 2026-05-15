import { describe, expect, it } from "vitest";
import { apiBibleUsageState, defaultApiBibleBudget } from "../src/entitlements/usage.js";

describe("apiBibleUsageState", () => {
  it("keeps paid usage included through the 300-call budget", () => {
    expect(defaultApiBibleBudget.includedCalls).toBe(300);
    expect(apiBibleUsageState(300)).toBe("included");
  });

  it("warns at 750 calls and caps at 1,500 calls", () => {
    expect(apiBibleUsageState(749)).toBe("included");
    expect(apiBibleUsageState(750)).toBe("warning");
    expect(apiBibleUsageState(1499)).toBe("warning");
    expect(apiBibleUsageState(1500)).toBe("capped");
  });
});
