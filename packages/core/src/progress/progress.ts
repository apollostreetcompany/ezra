export interface ProgressSummary {
  total: number;
  completed: number;
  percent: number;
}

export function summarizeProgress(total: number, completed: number): ProgressSummary {
  if (!Number.isInteger(total) || total < 0) {
    throw new Error("Total must be a non-negative integer.");
  }
  if (!Number.isInteger(completed) || completed < 0) {
    throw new Error("Completed must be a non-negative integer.");
  }
  const boundedCompleted = Math.min(completed, total);
  const percent = total === 0 ? 0 : Math.round((boundedCompleted / total) * 100);
  return { total, completed: boundedCompleted, percent };
}

export function progressBar(summary: ProgressSummary, width = 20): string {
  if (!Number.isInteger(width) || width <= 0) {
    throw new Error("Progress bar width must be a positive integer.");
  }
  const filled = summary.total === 0 ? 0 : Math.round((summary.percent / 100) * width);
  return `${"#".repeat(filled)}${"-".repeat(width - filled)} ${summary.percent}%`;
}
