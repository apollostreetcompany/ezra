import { describe, expect, it } from "vitest";
import { progressBar, summarizeProgress } from "../src/progress/progress.js";

describe("progress", () => {
  it("summarizes bounded progress", () => {
    expect(summarizeProgress(10, 3)).toEqual({ total: 10, completed: 3, percent: 30 });
    expect(summarizeProgress(10, 50)).toEqual({ total: 10, completed: 10, percent: 100 });
  });

  it("renders stable progress bars", () => {
    expect(progressBar(summarizeProgress(4, 1), 8)).toBe("##------ 25%");
  });
});
