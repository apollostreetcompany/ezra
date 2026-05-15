import { parseReference, referenceId } from "../references/parser.js";

export type PlanKind = "reading" | "verse" | "topical";

export interface PlanItem {
  id: string;
  day: number;
  reference: string;
  kind: PlanKind;
  prompt?: string;
}

export type PlanItemInput = Omit<PlanItem, "id"> & { id?: string };

export interface BiblePlan {
  id: string;
  title: string;
  goal: string;
  days: number;
  items: PlanItem[];
}

export function createPlan(input: Omit<BiblePlan, "id" | "items"> & { id?: string; items: PlanItemInput[] }): BiblePlan {
  if (!input.title.trim()) {
    throw new Error("Plan title is required.");
  }
  if (!input.goal.trim()) {
    throw new Error("Plan goal is required.");
  }
  if (!Number.isInteger(input.days) || input.days <= 0) {
    throw new Error("Plan days must be a positive integer.");
  }
  const items = input.items.map((item, index) => validatePlanItem(item, input.days, index));
  return {
    id: input.id ?? stablePlanId(input.title, input.goal, items),
    title: input.title,
    goal: input.goal,
    days: input.days,
    items
  };
}

function validatePlanItem(item: PlanItemInput, days: number, index: number): PlanItem {
  if (!Number.isInteger(item.day) || item.day < 1 || item.day > days) {
    throw new Error(`Plan item ${index + 1} has invalid day.`);
  }
  const parsed = parseReference(item.reference);
  return { ...item, id: item.id || referenceId(parsed) };
}

function stablePlanId(title: string, goal: string, items: PlanItem[]): string {
  const seed = `${title}|${goal}|${items.map((item) => `${item.day}:${item.reference}`).join(",")}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return `plan_${hash.toString(16).padStart(8, "0")}`;
}
