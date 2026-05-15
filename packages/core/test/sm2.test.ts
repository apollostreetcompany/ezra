import { describe, expect, it } from "vitest";
import { applySm2Review, createReviewCard } from "../src/reviews/sm2.js";

describe("SM-2 scheduler", () => {
  it("schedules first successful review for tomorrow", () => {
    const card = createReviewCard("john.3.16", "2026-05-14T00:00:00.000Z");
    const next = applySm2Review(card, { quality: 5, reviewedAt: "2026-05-14T00:00:00.000Z" });
    expect(next.repetitions).toBe(1);
    expect(next.intervalDays).toBe(1);
    expect(next.dueAt).toBe("2026-05-15T00:00:00.000Z");
  });

  it("resets repetitions after a failed review", () => {
    const card = { ...createReviewCard("rom.8.28", "2026-05-14T00:00:00.000Z"), repetitions: 3, intervalDays: 14 };
    const next = applySm2Review(card, { quality: 2, reviewedAt: "2026-05-14T00:00:00.000Z" });
    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(1);
  });
});
