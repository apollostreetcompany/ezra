import type { DeviceAuth, InMemorySyncStore } from "./sync.js";

export interface PremiumAccessDecision {
  allowed: boolean;
  reason: "active" | "premium_catalog_disabled" | "not_entitled" | "bible_not_allowed" | "missing_api_key";
}

export interface PremiumAccessOptions {
  enabled: boolean;
  apiKey: string | undefined;
  allowedBibleIds: string[];
  bibleId: string;
}

export function checkPremiumBibleAccess(store: InMemorySyncStore, auth: DeviceAuth, options: PremiumAccessOptions): PremiumAccessDecision {
  if (!options.enabled) {
    return { allowed: false, reason: "premium_catalog_disabled" };
  }
  if (!options.apiKey) {
    return { allowed: false, reason: "missing_api_key" };
  }
  if (!store.hasPremium(auth.userId)) {
    return { allowed: false, reason: "not_entitled" };
  }
  if (!options.allowedBibleIds.includes(options.bibleId)) {
    return { allowed: false, reason: "bible_not_allowed" };
  }
  return { allowed: true, reason: "active" };
}

export function parseAllowedBibleIds(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
