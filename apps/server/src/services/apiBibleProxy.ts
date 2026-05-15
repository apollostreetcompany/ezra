import { checkPremiumBibleAccess, parseAllowedBibleIds } from "./entitlements.js";
import { buildFumsReportUrl, createFumsSessionId, hmacFumsUserId } from "./fums.js";
import type { ApiBibleClient, ApiBiblePassageData, ApiBibleSearchData } from "./apiBibleClient.js";
import type { DeviceAuth, InMemorySyncStore } from "./sync.js";

export type ApiBibleSurface = "model" | "human";
export type ApiBibleCacheMode = "metadata-only" | "content-14d";

export interface ApiBibleProxyOptions {
  enabled: boolean;
  apiKey: string | undefined;
  allowedBibleIds: string[];
  cacheMode: ApiBibleCacheMode;
  cacheTtlDays: number;
  fumsUserHashSecret: string;
  client: ApiBibleClient;
  now: () => string;
}

export interface DisplayPolicy {
  surface: ApiBibleSurface;
  textRedacted: boolean;
  reason: string;
}

export interface ProxiedPassage {
  bibleId: string;
  passageId: string;
  reference: string;
  content: string | null;
  verseCount: number;
  attribution: string;
  copyright: string;
  fums: {
    required: boolean;
    tokenCaptured: boolean;
    reportUrl: string | null;
  };
  cache: {
    mode: ApiBibleCacheMode;
    hit: boolean;
  };
  policy: DisplayPolicy;
}

export interface ProxiedSearch {
  bibleId: string;
  query: string;
  total: number;
  verses: Array<{ id: string; reference: string; text: string | null }>;
  passages: Array<{ id: string; reference: string; content: string | null; copyright: string }>;
  fums: {
    required: boolean;
    tokenCaptured: boolean;
    reportUrl: string | null;
  };
  policy: DisplayPolicy;
}

interface CacheEntry {
  expiresAt: number;
  passage: ApiBiblePassageData;
  fumsToken: string | undefined;
}

export class ApiBibleProxyService {
  private readonly passageCache = new Map<string, CacheEntry>();

  constructor(private readonly store: InMemorySyncStore, private readonly options: ApiBibleProxyOptions) {}

  async listBibles(auth: DeviceAuth): Promise<{ bibles: Array<{ id: string; abbreviation: string; name: string; copyright: string | null }> }> {
    this.assertBaseAccess(auth, this.options.allowedBibleIds[0] ?? "");
    const response = await this.options.client.listBibles();
    const bibles = response.data
      .filter((bible) => this.options.allowedBibleIds.includes(bible.id))
      .map((bible) => ({
        id: bible.id,
        abbreviation: bible.abbreviation,
        name: bible.name,
        copyright: bible.copyright ?? null
      }));
    return { bibles };
  }

  async getPassage(auth: DeviceAuth, input: { bibleId: string; passageId: string; surface: ApiBibleSurface }): Promise<ProxiedPassage> {
    this.assertBaseAccess(auth, input.bibleId);
    const cacheKey = `${input.bibleId}:${input.passageId}`;
    const cached = this.getCachedPassage(cacheKey);
    const response = cached ?? (await this.options.client.getPassage({ bibleId: input.bibleId, passageId: input.passageId }));
    if (!cached && this.options.cacheMode === "content-14d") {
      this.cachePassage(cacheKey, response.data, response.meta?.fumsToken);
    }
    const policy = displayPolicy(input.surface);
    const fumsToken = response.meta?.fumsToken;
    return {
      bibleId: input.bibleId,
      passageId: input.passageId,
      reference: response.data.reference,
      content: policy.textRedacted ? null : response.data.content,
      verseCount: response.data.verseCount,
      attribution: response.data.copyright,
      copyright: response.data.copyright,
      fums: {
        required: true,
        tokenCaptured: Boolean(fumsToken),
        reportUrl: fumsToken && !policy.textRedacted ? this.buildFumsUrl(auth, fumsToken) : null
      },
      cache: {
        mode: this.options.cacheMode,
        hit: Boolean(cached)
      },
      policy
    };
  }

  async search(auth: DeviceAuth, input: { bibleId: string; query: string; surface: ApiBibleSurface; limit?: number; offset?: number }): Promise<ProxiedSearch> {
    this.assertBaseAccess(auth, input.bibleId);
    const response = await this.options.client.search(input);
    const policy = displayPolicy(input.surface);
    const fumsToken = response.meta?.fumsToken;
    return {
      bibleId: input.bibleId,
      query: response.data.query,
      total: response.data.total,
      verses: response.data.verses.map((verse) => ({
        id: verse.id,
        reference: verse.reference,
        text: policy.textRedacted ? null : verse.text
      })),
      passages: response.data.passages.map((passage) => ({
        id: passage.id,
        reference: passage.reference,
        content: policy.textRedacted ? null : passage.content,
        copyright: passage.copyright
      })),
      fums: {
        required: true,
        tokenCaptured: Boolean(fumsToken),
        reportUrl: fumsToken && !policy.textRedacted ? this.buildFumsUrl(auth, fumsToken) : null
      },
      policy
    };
  }

  private assertBaseAccess(auth: DeviceAuth, bibleId: string): void {
    const decision = checkPremiumBibleAccess(this.store, auth, {
      enabled: this.options.enabled,
      apiKey: this.options.apiKey,
      allowedBibleIds: this.options.allowedBibleIds,
      bibleId
    });
    if (!decision.allowed) {
      throw new ApiBibleAccessError(decision.reason);
    }
  }

  private getCachedPassage(cacheKey: string): { data: ApiBiblePassageData; meta?: { fumsToken?: string } } | undefined {
    const entry = this.passageCache.get(cacheKey);
    if (!entry || entry.expiresAt <= Date.parse(this.options.now())) {
      this.passageCache.delete(cacheKey);
      return undefined;
    }
    const cached = { data: entry.passage } as { data: ApiBiblePassageData; meta?: { fumsToken?: string } };
    if (entry.fumsToken) {
      cached.meta = { fumsToken: entry.fumsToken };
    }
    return cached;
  }

  private cachePassage(cacheKey: string, passage: ApiBiblePassageData, fumsToken: string | undefined): void {
    const ttlMs = Math.min(this.options.cacheTtlDays, 14) * 24 * 60 * 60 * 1000;
    this.passageCache.set(cacheKey, { passage, fumsToken, expiresAt: Date.parse(this.options.now()) + ttlMs });
  }

  private buildFumsUrl(auth: DeviceAuth, fumsToken: string): string {
    return buildFumsReportUrl({
      fumsToken,
      deviceId: auth.deviceId,
      sessionId: createFumsSessionId(),
      userIdHash: hmacFumsUserId(this.options.fumsUserHashSecret, auth.userId)
    });
  }
}

export class ApiBibleAccessError extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

export function displayPolicy(surface: ApiBibleSurface): DisplayPolicy {
  if (surface === "human") {
    return { surface, textRedacted: false, reason: "Explicit human display surface requested." };
  }
  return {
    surface,
    textRedacted: true,
    reason: "Paid API.Bible text is redacted from model-visible output by default."
  };
}

export function apiBibleProxyOptionsFromEnv(env: NodeJS.ProcessEnv, client: ApiBibleClient, now: () => string): Omit<ApiBibleProxyOptions, "client" | "now"> & { client: ApiBibleClient; now: () => string } {
  const enabled = env.BIBLE_CODER_ENABLE_PREMIUM_API_BIBLE === "true";
  return {
    enabled,
    apiKey: env.API_BIBLE_KEY,
    allowedBibleIds: parseAllowedBibleIds(env.BIBLE_CODER_ALLOWED_PREMIUM_BIBLES),
    cacheMode: env.BIBLE_CODER_CACHE_MODE === "content-14d" ? "content-14d" : "metadata-only",
    cacheTtlDays: readCacheTtlDays(env.BIBLE_CODER_CACHE_TTL_DAYS),
    fumsUserHashSecret: resolveFumsSecret(env, enabled),
    client,
    now
  };
}

function readCacheTtlDays(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "14", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 14;
}

function resolveFumsSecret(env: NodeJS.ProcessEnv, premiumEnabled: boolean): string {
  if (env.FUMS_USER_HASH_SECRET) {
    return env.FUMS_USER_HASH_SECRET;
  }
  if (premiumEnabled && env.NODE_ENV === "production") {
    throw new Error("FUMS_USER_HASH_SECRET is required when premium API.Bible is enabled in production.");
  }
  return "dev-only-fums-secret";
}
