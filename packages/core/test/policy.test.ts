import { describe, expect, it } from "vitest";
import { apiBibleUsageState } from "../src/entitlements/usage.js";
import { decideModelVisiblePassagePolicy } from "../src/policy/aiTextPolicy.js";

describe("policy", () => {
  it("uses the hardened API.Bible call budget", () => {
    expect(apiBibleUsageState(299)).toBe("included");
    expect(apiBibleUsageState(750)).toBe("warning");
    expect(apiBibleUsageState(1500)).toBe("capped");
  });

  it("redacts paid text from model-visible outputs by default", () => {
    expect(decideModelVisiblePassagePolicy("local-free").mayReturnInlineToModel).toBe(true);
    expect(decideModelVisiblePassagePolicy("api-bible-paid").mayReturnInlineToModel).toBe(false);
  });
});
