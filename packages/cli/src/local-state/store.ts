import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { applySm2Review, createReviewCard, type BiblePlan, type PlanItem, type PlanKind, type ReviewCard } from "@bible-coder/core";
import { chmodIfExists, ensureLocalPaths, readOrCreateAuth, type LocalAuth, type LocalPaths } from "./paths.js";

type DatabaseSync = InstanceType<(typeof import("node:sqlite"))["DatabaseSync"]>;

export interface StoredPlan extends BiblePlan {
  createdAt: string;
}

export interface StoredPlanItem extends PlanItem {
  completedAt: string | null;
}

export interface PlanProgress {
  plan: StoredPlan;
  total: number;
  completed: number;
}

export interface NextReview {
  card: ReviewCard;
  planId: string;
  reference: string;
}

export interface StoredProgressEvent {
  idempotencyKey: string;
  planId: string;
  itemId: string;
  action: string;
  occurredAt: string;
}

export class LocalStateStore {
  private constructor(private readonly db: DatabaseSync) {}

  static async open(paths: LocalPaths): Promise<LocalStateStore> {
    ensureLocalPaths(paths);
    const existsBeforeOpen = existsSync(paths.statePath);
    const sqlite = await loadSqlite();
    const db = new sqlite.DatabaseSync(paths.statePath);
    if (!existsBeforeOpen) {
      chmodIfExists(paths.statePath, 0o600);
    }
    const store = new LocalStateStore(db);
    store.migrate();
    chmodIfExists(paths.statePath, 0o600);
    return store;
  }

  close(): void {
    this.db.close();
  }

  ensureAuth(paths: LocalPaths, now: string): LocalAuth {
    return readOrCreateAuth(paths, now, () => randomBytes(10).toString("hex"));
  }

  savePlan(plan: BiblePlan, createdAt: string): void {
    this.db.exec("BEGIN");
    try {
      this.db
        .prepare("INSERT OR REPLACE INTO plans (id, title, goal, days, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(plan.id, plan.title, plan.goal, plan.days, createdAt);
      const itemStatement = this.db.prepare(
        "INSERT OR REPLACE INTO plan_items (plan_id, id, day, reference, kind, prompt, completed_at) VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT completed_at FROM plan_items WHERE plan_id = ? AND id = ?), NULL))",
      );
      const reviewStatement = this.db.prepare(
        "INSERT OR IGNORE INTO review_cards (id, plan_id, reference, due_at, interval_days, ease_factor, repetitions) VALUES (?, ?, ?, ?, ?, ?, ?)",
      );
      for (const item of plan.items) {
        itemStatement.run(plan.id, item.id, item.day, item.reference, item.kind, item.prompt ?? null, plan.id, item.id);
        const card = createReviewCard(item.id, createdAt);
        reviewStatement.run(card.id, plan.id, item.reference, card.dueAt, card.intervalDays, card.easeFactor, card.repetitions);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  listPlans(): StoredPlan[] {
    return this.db
      .prepare("SELECT id, title, goal, days, created_at FROM plans ORDER BY created_at DESC, id ASC")
      .all()
      .map(planFromRow);
  }

  getPlan(planId?: string): StoredPlan | undefined {
    const row =
      planId === undefined
        ? this.db.prepare("SELECT id, title, goal, days, created_at FROM plans ORDER BY created_at DESC, id ASC LIMIT 1").get()
        : this.db.prepare("SELECT id, title, goal, days, created_at FROM plans WHERE id = ?").get(planId);
    return row ? planFromRow(row) : undefined;
  }

  getPlanItems(planId: string): StoredPlanItem[] {
    return this.db
      .prepare("SELECT id, day, reference, kind, prompt, completed_at FROM plan_items WHERE plan_id = ? ORDER BY day ASC, id ASC")
      .all(planId)
      .map(planItemFromRow);
  }

  markProgress(planId: string, itemId: string, completedAt: string): StoredPlanItem {
    const item = this.db.prepare("SELECT id FROM plan_items WHERE plan_id = ? AND id = ?").get(planId, itemId);
    if (!item) {
      throw new Error(`Plan item not found: ${itemId}`);
    }
    this.db
      .prepare("UPDATE plan_items SET completed_at = COALESCE(completed_at, ?) WHERE plan_id = ? AND id = ?")
      .run(completedAt, planId, itemId);
    this.db
      .prepare("INSERT OR IGNORE INTO progress_events (idempotency_key, plan_id, item_id, action, occurred_at) VALUES (?, ?, ?, ?, ?)")
      .run(`${planId}:${itemId}:completed`, planId, itemId, "completed", completedAt);
    const row = this.db.prepare("SELECT id, day, reference, kind, prompt, completed_at FROM plan_items WHERE plan_id = ? AND id = ?").get(planId, itemId);
    if (!row) {
      throw new Error(`Plan item not found after update: ${itemId}`);
    }
    return planItemFromRow(row);
  }

  planProgress(planId?: string): PlanProgress | undefined {
    const plan = this.getPlan(planId);
    if (!plan) {
      return undefined;
    }
    const row = this.db
      .prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN completed_at IS NULL THEN 0 ELSE 1 END) AS completed FROM plan_items WHERE plan_id = ?")
      .get(plan.id) as CountRow | undefined;
    return { plan, total: Number(row?.total ?? 0), completed: Number(row?.completed ?? 0) };
  }

  listProgressEvents(planId?: string): StoredProgressEvent[] {
    const rows =
      planId === undefined
        ? this.db.prepare("SELECT idempotency_key, plan_id, item_id, action, occurred_at FROM progress_events ORDER BY occurred_at ASC, id ASC").all()
        : this.db
            .prepare("SELECT idempotency_key, plan_id, item_id, action, occurred_at FROM progress_events WHERE plan_id = ? ORDER BY occurred_at ASC, id ASC")
            .all(planId);
    return rows.map(progressEventFromRow);
  }

  nextReview(now: string): NextReview | undefined {
    const row = this.db
      .prepare(
        "SELECT id, plan_id, reference, due_at, interval_days, ease_factor, repetitions FROM review_cards WHERE due_at <= ? ORDER BY due_at ASC, id ASC LIMIT 1",
      )
      .get(now);
    return row ? nextReviewFromRow(row) : undefined;
  }

  recordReview(cardId: string, quality: 0 | 1 | 2 | 3 | 4 | 5, reviewedAt: string): ReviewCard {
    const row = this.db.prepare("SELECT id, due_at, interval_days, ease_factor, repetitions FROM review_cards WHERE id = ?").get(cardId);
    if (!row) {
      throw new Error(`Review card not found: ${cardId}`);
    }
    const before = reviewCardFromRow(row);
    const after = applySm2Review(before, { quality, reviewedAt });
    this.db
      .prepare("UPDATE review_cards SET due_at = ?, interval_days = ?, ease_factor = ?, repetitions = ? WHERE id = ?")
      .run(after.dueAt, after.intervalDays, after.easeFactor, after.repetitions, after.id);
    this.db
      .prepare("INSERT INTO review_events (card_id, rating, occurred_at, scheduler_before_json, scheduler_after_json) VALUES (?, ?, ?, ?, ?)")
      .run(after.id, quality, reviewedAt, JSON.stringify(before), JSON.stringify(after));
    return after;
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS plans (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        goal TEXT NOT NULL,
        days INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS plan_items (
        plan_id TEXT NOT NULL,
        id TEXT NOT NULL,
        day INTEGER NOT NULL,
        reference TEXT NOT NULL,
        kind TEXT NOT NULL,
        prompt TEXT,
        completed_at TEXT,
        PRIMARY KEY (plan_id, id)
      );
      CREATE TABLE IF NOT EXISTS progress_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        idempotency_key TEXT NOT NULL UNIQUE,
        plan_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        action TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS review_cards (
        id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        reference TEXT NOT NULL,
        due_at TEXT NOT NULL,
        interval_days INTEGER NOT NULL,
        ease_factor REAL NOT NULL,
        repetitions INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS review_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id TEXT NOT NULL,
        rating INTEGER NOT NULL,
        occurred_at TEXT NOT NULL,
        scheduler_before_json TEXT NOT NULL,
        scheduler_after_json TEXT NOT NULL
      );
    `);
  }
}

interface CountRow {
  total: number;
  completed: number | null;
}

function planFromRow(row: unknown): StoredPlan {
  const value = row as Record<string, unknown>;
  return {
    id: String(value.id),
    title: String(value.title),
    goal: String(value.goal),
    days: Number(value.days),
    items: [],
    createdAt: String(value.created_at)
  };
}

function planItemFromRow(row: unknown): StoredPlanItem {
  const value = row as Record<string, unknown>;
  const item: StoredPlanItem = {
    id: String(value.id),
    day: Number(value.day),
    reference: String(value.reference),
    kind: String(value.kind) as PlanKind,
    completedAt: value.completed_at === null ? null : String(value.completed_at)
  };
  if (value.prompt !== null && value.prompt !== undefined) {
    item.prompt = String(value.prompt);
  }
  return item;
}

function progressEventFromRow(row: unknown): StoredProgressEvent {
  const value = row as Record<string, unknown>;
  return {
    idempotencyKey: String(value.idempotency_key),
    planId: String(value.plan_id),
    itemId: String(value.item_id),
    action: String(value.action),
    occurredAt: String(value.occurred_at)
  };
}

function reviewCardFromRow(row: unknown): ReviewCard {
  const value = row as Record<string, unknown>;
  return {
    id: String(value.id),
    dueAt: String(value.due_at),
    intervalDays: Number(value.interval_days),
    easeFactor: Number(value.ease_factor),
    repetitions: Number(value.repetitions)
  };
}

function nextReviewFromRow(row: unknown): NextReview {
  const value = row as Record<string, unknown>;
  return {
    card: reviewCardFromRow(row),
    planId: String(value.plan_id),
    reference: String(value.reference)
  };
}

async function loadSqlite(): Promise<typeof import("node:sqlite")> {
  const processWithWarning = process as NodeJS.Process & { emitWarning: (warning: string | Error, ...args: unknown[]) => void };
  const originalEmitWarning = processWithWarning.emitWarning;
  processWithWarning.emitWarning = function suppressSqliteWarning(warning: string | Error, ...args: unknown[]): void {
    if (String(warning).includes("SQLite is an experimental feature")) {
      return;
    }
    Reflect.apply(originalEmitWarning, process, [warning, ...args]);
  };
  try {
    return await import("node:sqlite");
  } finally {
    processWithWarning.emitWarning = originalEmitWarning;
  }
}
