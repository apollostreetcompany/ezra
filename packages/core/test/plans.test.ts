import { describe, expect, it } from "vitest";
import { createPlan } from "../src/plans/schema.js";

describe("plans", () => {
  it("creates a reference-first plan with stable generated id", () => {
    const plan = createPlan({
      title: "Courage",
      goal: "Pray before shipping",
      days: 1,
      items: [{ day: 1, reference: "Joshua 1:9", kind: "verse" }]
    });
    expect(plan.id).toMatch(/^plan_/);
    expect(plan.items[0]?.id).toBe("joshua.1.9-1.9");
  });

  it("rejects out-of-range days", () => {
    expect(() =>
      createPlan({
        title: "Bad",
        goal: "Bad",
        days: 1,
        items: [{ day: 2, reference: "John 3:16", kind: "verse" }]
      })
    ).toThrow(/invalid day/);
  });
});
