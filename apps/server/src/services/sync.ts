import { randomUUID } from "node:crypto";
import { createPlan, type BiblePlan, type PlanItemInput } from "@bible-coder/core";
import { generateDeviceToken, hashDeviceToken } from "./token.js";

export interface DeviceAuth {
  userId: string;
  deviceId: string;
  scopes: string[];
}

export interface DeviceTokenRecord extends DeviceAuth {
  id: string;
  tokenHash: string;
  tokenPrefix: string;
  deviceName: string;
  createdAt: string;
  lastSeenAt: string;
  revokedAt: string | null;
}

export interface DeviceTokenIssue {
  token: string;
  record: DeviceTokenRecord;
}

export interface PlanCreateInput {
  id?: string;
  title: string;
  goal: string;
  days: number;
  items: PlanItemInput[];
}

export interface StoredPlan extends BiblePlan {
  userId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProgressEventInput {
  idempotencyKey: string;
  planId: string;
  referenceId: string;
  action: string;
  occurredAt: string;
  payload?: Record<string, unknown>;
}

export interface ProgressEvent extends ProgressEventInput {
  id: string;
  userId: string;
  deviceId: string;
}

export interface ReviewEventInput {
  idempotencyKey: string;
  cardId: string;
  rating: number;
  occurredAt: string;
  schedulerBefore?: Record<string, unknown>;
  schedulerAfter?: Record<string, unknown>;
}

export interface ReviewEvent extends ReviewEventInput {
  id: string;
  userId: string;
  deviceId: string;
}

export interface BlockSettingsInput {
  enabled?: boolean;
  syncAttestations?: boolean;
}

export interface BlockSettings {
  userId: string;
  enabled: boolean;
  syncAttestations: boolean;
  updatedAt: string;
}

export interface PrayerAttestationInput {
  occurredAt: string;
  repoHash: string;
  branch?: string;
  commitSha?: string;
}

export interface PrayerAttestation extends PrayerAttestationInput {
  id: string;
  userId: string;
  deviceId: string;
}

export interface LeaderboardProfileInput {
  optedIn?: boolean;
  displayName?: string;
}

export interface LeaderboardProfile {
  userId: string;
  optedIn: boolean;
  displayName: string;
  updatedAt: string;
}

export interface LeaderboardEntry {
  displayName: string;
  completedCount: number;
}

export class InMemorySyncStore {
  readonly users = new Map<string, { id: string; createdAt: string }>();
  readonly deviceTokens = new Map<string, DeviceTokenRecord>();
  readonly plans = new Map<string, StoredPlan>();
  readonly progressEvents = new Map<string, ProgressEvent>();
  readonly reviewEvents = new Map<string, ReviewEvent>();
  readonly premiumUsers = new Set<string>();
  readonly stripeCustomers = new Map<string, { userId: string; customerId: string }>();
  readonly stripeSubscriptions = new Map<string, { userId: string; subscriptionId: string; status: string; currentPeriodEnd: string | null }>();
  readonly processedStripeEvents = new Set<string>();
  readonly blockSettings = new Map<string, BlockSettings>();
  readonly prayerAttestations = new Map<string, PrayerAttestation>();
  readonly leaderboardProfiles = new Map<string, LeaderboardProfile>();

  createDeviceToken(input: { pepper: string; now: string; deviceName?: string; scopes?: string[]; userId?: string }): DeviceTokenIssue {
    const userId = input.userId ?? `usr_${randomUUID()}`;
    this.users.set(userId, this.users.get(userId) ?? { id: userId, createdAt: input.now });
    const generated = generateDeviceToken(input.pepper);
    const record: DeviceTokenRecord = {
      id: `dtok_${randomUUID()}`,
      userId,
      deviceId: `dev_${randomUUID()}`,
      tokenHash: generated.tokenHash,
      tokenPrefix: generated.tokenPrefix,
      deviceName: input.deviceName?.trim() || "Unnamed device",
      scopes: input.scopes && input.scopes.length > 0 ? input.scopes : ["sync:read", "sync:write"],
      createdAt: input.now,
      lastSeenAt: input.now,
      revokedAt: null
    };
    this.deviceTokens.set(record.tokenHash, record);
    return { token: generated.token, record };
  }

  authenticate(token: string, pepper: string, now: string): DeviceAuth | undefined {
    const record = this.deviceTokens.get(hashDeviceToken(token, pepper));
    if (!record || record.revokedAt) {
      return undefined;
    }
    record.lastSeenAt = now;
    return { userId: record.userId, deviceId: record.deviceId, scopes: [...record.scopes] };
  }

  savePlan(auth: DeviceAuth, input: PlanCreateInput, now: string): StoredPlan {
    const plan = createPlan(input);
    const existing = this.plans.get(`${auth.userId}:${plan.id}`);
    const stored: StoredPlan = {
      ...plan,
      userId: auth.userId,
      version: existing ? existing.version + 1 : 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };
    this.plans.set(`${auth.userId}:${stored.id}`, stored);
    return stored;
  }

  listPlans(auth: DeviceAuth): StoredPlan[] {
    return [...this.plans.values()].filter((plan) => plan.userId === auth.userId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  recordProgress(auth: DeviceAuth, input: ProgressEventInput): ProgressEvent {
    const eventKey = `${auth.userId}:${input.idempotencyKey}`;
    const existing = this.progressEvents.get(eventKey);
    if (existing) {
      return existing;
    }
    const event: ProgressEvent = {
      ...input,
      id: `pevt_${randomUUID()}`,
      userId: auth.userId,
      deviceId: auth.deviceId,
      payload: input.payload ?? {}
    };
    this.progressEvents.set(eventKey, event);
    return event;
  }

  listProgress(auth: DeviceAuth, planId?: string): ProgressEvent[] {
    return [...this.progressEvents.values()]
      .filter((event) => event.userId === auth.userId && (planId === undefined || event.planId === planId))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }

  recordReview(auth: DeviceAuth, input: ReviewEventInput): ReviewEvent {
    const eventKey = `${auth.userId}:${input.idempotencyKey}`;
    const existing = this.reviewEvents.get(eventKey);
    if (existing) {
      return existing;
    }
    const event: ReviewEvent = {
      ...input,
      id: `revt_${randomUUID()}`,
      userId: auth.userId,
      deviceId: auth.deviceId,
      schedulerBefore: input.schedulerBefore ?? {},
      schedulerAfter: input.schedulerAfter ?? {}
    };
    this.reviewEvents.set(eventKey, event);
    return event;
  }

  listReviews(auth: DeviceAuth): ReviewEvent[] {
    return [...this.reviewEvents.values()]
      .filter((event) => event.userId === auth.userId)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  }

  grantPremium(userId: string): void {
    this.premiumUsers.add(userId);
  }

  revokePremium(userId: string): void {
    this.premiumUsers.delete(userId);
  }

  hasPremium(userId: string): boolean {
    return this.premiumUsers.has(userId);
  }

  setStripeCustomer(userId: string, customerId: string): void {
    this.stripeCustomers.set(customerId, { userId, customerId });
  }

  findUserIdByStripeCustomer(customerId: string): string | undefined {
    return this.stripeCustomers.get(customerId)?.userId;
  }

  setStripeSubscription(input: { userId: string; subscriptionId: string; status: string; currentPeriodEnd?: string | null }): void {
    this.stripeSubscriptions.set(input.subscriptionId, {
      userId: input.userId,
      subscriptionId: input.subscriptionId,
      status: input.status,
      currentPeriodEnd: input.currentPeriodEnd ?? null
    });
    if (input.status === "active" || input.status === "trialing" || input.status === "past_due") {
      this.grantPremium(input.userId);
    } else {
      this.revokePremium(input.userId);
    }
  }

  markStripeEventProcessed(eventId: string): boolean {
    if (this.processedStripeEvents.has(eventId)) {
      return false;
    }
    this.processedStripeEvents.add(eventId);
    return true;
  }

  getBlockSettings(auth: DeviceAuth, now: string): BlockSettings {
    return this.blockSettings.get(auth.userId) ?? { userId: auth.userId, enabled: false, syncAttestations: false, updatedAt: now };
  }

  setBlockSettings(auth: DeviceAuth, input: BlockSettingsInput, now: string): BlockSettings {
    const existing = this.getBlockSettings(auth, now);
    const settings: BlockSettings = {
      userId: auth.userId,
      enabled: input.enabled ?? existing.enabled,
      syncAttestations: input.syncAttestations ?? existing.syncAttestations,
      updatedAt: now
    };
    this.blockSettings.set(auth.userId, settings);
    return settings;
  }

  recordPrayerAttestation(auth: DeviceAuth, input: PrayerAttestationInput): PrayerAttestation {
    const attestation: PrayerAttestation = {
      id: `patt_${randomUUID()}`,
      userId: auth.userId,
      deviceId: auth.deviceId,
      occurredAt: input.occurredAt,
      repoHash: input.repoHash
    };
    if (input.branch !== undefined) {
      attestation.branch = input.branch;
    }
    if (input.commitSha !== undefined) {
      attestation.commitSha = input.commitSha;
    }
    this.prayerAttestations.set(attestation.id, attestation);
    return attestation;
  }

  getLeaderboardProfile(auth: DeviceAuth, now: string): LeaderboardProfile {
    return this.leaderboardProfiles.get(auth.userId) ?? { userId: auth.userId, optedIn: false, displayName: "", updatedAt: now };
  }

  setLeaderboardProfile(auth: DeviceAuth, input: LeaderboardProfileInput, now: string): LeaderboardProfile {
    const existing = this.getLeaderboardProfile(auth, now);
    const profile: LeaderboardProfile = {
      userId: auth.userId,
      optedIn: input.optedIn ?? existing.optedIn,
      displayName: normalizeDisplayName(input.displayName ?? existing.displayName),
      updatedAt: now
    };
    this.leaderboardProfiles.set(auth.userId, profile);
    return profile;
  }

  listLeaderboardEntries(limit = 25): LeaderboardEntry[] {
    return [...this.leaderboardProfiles.values()]
      .filter((profile) => profile.optedIn && profile.displayName.length > 0)
      .map((profile) => ({
        displayName: profile.displayName,
        completedCount: this.completedProgressCount(profile.userId)
      }))
      .sort((a, b) => b.completedCount - a.completedCount || a.displayName.localeCompare(b.displayName))
      .slice(0, limit);
  }

  private completedProgressCount(userId: string): number {
    return [...this.progressEvents.values()].filter((event) => event.userId === userId && event.action === "completed").length;
  }
}

function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 40);
}
