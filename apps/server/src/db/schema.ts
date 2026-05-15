import { relations, sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    deviceName: text("device_name").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true })
  },
  (table) => [uniqueIndex("device_tokens_token_hash_idx").on(table.tokenHash)],
);

export const plans = pgTable(
  "plans",
  {
    id: text("id").notNull(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    goal: text("goal").notNull(),
    days: integer("days").notNull(),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [primaryKey({ columns: [table.userId, table.id], name: "plans_user_id_id_pk" })],
);

export const planItems = pgTable(
  "plan_items",
  {
    id: text("id").notNull(),
    planId: text("plan_id").notNull(),
    userId: text("user_id").notNull(),
    day: integer("day").notNull(),
    reference: text("reference").notNull(),
    kind: text("kind").notNull(),
    prompt: text("prompt")
  },
  (table) => [primaryKey({ columns: [table.planId, table.id], name: "plan_items_plan_id_id_pk" })],
);

export const progressEvents = pgTable(
  "progress_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    deviceId: text("device_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    planId: text("plan_id").notNull(),
    referenceId: text("reference_id").notNull(),
    action: text("action").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`)
  },
  (table) => [uniqueIndex("progress_events_user_id_idempotency_idx").on(table.userId, table.idempotencyKey)],
);

export const reviewEvents = pgTable(
  "review_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    deviceId: text("device_id").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    cardId: text("card_id").notNull(),
    rating: integer("rating").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    schedulerBeforeJson: jsonb("scheduler_before_json").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    schedulerAfterJson: jsonb("scheduler_after_json").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`)
  },
  (table) => [uniqueIndex("review_events_user_id_idempotency_idx").on(table.userId, table.idempotencyKey)],
);

export const auditLog = pgTable("audit_log", {
  id: text("id").primaryKey(),
  userId: text("user_id"),
  deviceId: text("device_id"),
  event: text("event").notNull(),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const blockSettings = pgTable("block_settings", {
  userId: text("user_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  syncAttestations: boolean("sync_attestations").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const prayerAttestations = pgTable("prayer_attestations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  deviceId: text("device_id").notNull(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  repoHash: text("repo_hash").notNull(),
  branch: text("branch"),
  commitSha: text("commit_sha")
});

export const leaderboardProfiles = pgTable("leaderboard_profiles", {
  userId: text("user_id").primaryKey(),
  optedIn: boolean("opted_in").notNull().default(false),
  displayName: text("display_name").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const userRelations = relations(users, ({ many }) => ({
  deviceTokens: many(deviceTokens),
  plans: many(plans)
}));
