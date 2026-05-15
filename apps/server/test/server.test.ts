import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { ApiBibleClient } from "../src/services/apiBibleClient.js";
import { InMemorySyncStore } from "../src/services/sync.js";
import type { StripeGateway } from "../src/services/stripe.js";

const apps: FastifyInstance[] = [];

afterEach(async () => {
  for (const app of apps.splice(0)) {
    await app.close();
  }
});

describe("Bible Coder server sync foundation", () => {
  it("responds to health checks", async () => {
    const app = await testServer();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, service: "bible-coder-server" });
  });

  it("issues hashed device tokens and rejects unauthenticated sync routes", async () => {
    const store = new InMemorySyncStore();
    const app = await testServer(store);
    const issue = await issueToken(app, "Codex");

    expect(issue.token).toMatch(/^bc_live_/);
    const stored = [...store.deviceTokens.values()][0];
    expect(stored?.tokenHash).toBeTruthy();
    expect(stored?.tokenHash).not.toContain(issue.token);

    const unauthenticated = await app.inject({ method: "GET", url: "/v1/plans" });
    expect(unauthenticated.statusCode).toBe(401);

    const invalidLink = await app.inject({
      method: "POST",
      url: "/v1/device-tokens",
      headers: auth("bc_live_bad_bad"),
      payload: { deviceName: "Bad link" }
    });
    expect(invalidLink.statusCode).toBe(401);
  });

  it("syncs plans across device tokens on the same user", async () => {
    const app = await testServer();
    const first = await issueToken(app, "Codex");
    const secondResponse = await app.inject({
      method: "POST",
      url: "/v1/device-tokens",
      headers: auth(first.token),
      payload: { deviceName: "Claude" }
    });
    const second = secondResponse.json() as DeviceTokenResponse;
    expect(second.userId).toBe(first.userId);

    const create = await app.inject({
      method: "POST",
      url: "/v1/plans",
      headers: auth(first.token),
      payload: {
        title: "Purpose",
        goal: "Remember purpose",
        days: 1,
        items: [{ day: 1, reference: "Romans 8:28", kind: "verse" }]
      }
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({ method: "GET", url: "/v1/plans", headers: auth(second.token) });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({ plans: [{ title: "Purpose", goal: "Remember purpose" }] });
  });

  it("records progress idempotently", async () => {
    const app = await testServer();
    const device = await issueToken(app, "Terminal");
    const payload = {
      idempotencyKey: "progress-1",
      planId: "plan_1",
      referenceId: "john.3.16-3.16",
      action: "completed",
      occurredAt: "2026-05-14T08:00:00.000Z",
      payload: { source: "cli" }
    };

    const first = await app.inject({ method: "POST", url: "/v1/progress", headers: auth(device.token), payload });
    const second = await app.inject({ method: "POST", url: "/v1/progress", headers: auth(device.token), payload });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json().event.id).toBe(first.json().event.id);

    const list = await app.inject({ method: "GET", url: "/v1/progress?planId=plan_1", headers: auth(device.token) });
    expect(list.json().events).toHaveLength(1);
  });

  it("records review events idempotently", async () => {
    const app = await testServer();
    const device = await issueToken(app, "Reviewer");
    const payload = {
      idempotencyKey: "review-1",
      cardId: "romans.8.28-8.28",
      rating: 5,
      occurredAt: "2026-05-14T08:00:00.000Z",
      schedulerBefore: { repetitions: 0 },
      schedulerAfter: { repetitions: 1 }
    };

    const first = await app.inject({ method: "POST", url: "/v1/reviews", headers: auth(device.token), payload });
    const second = await app.inject({ method: "POST", url: "/v1/reviews", headers: auth(device.token), payload });
    expect(first.statusCode).toBe(201);
    expect(second.json().event.id).toBe(first.json().event.id);

    const list = await app.inject({ method: "GET", url: "/v1/reviews", headers: auth(device.token) });
    expect(list.json().events).toHaveLength(1);
  });

  it("keeps premium API.Bible disabled behind the launch gate", async () => {
    const store = new InMemorySyncStore();
    const app = await testServer(store, mockApiBibleClient(), {
      API_BIBLE_KEY: "test-api-key",
      BIBLE_CODER_ALLOWED_PREMIUM_BIBLES: "bible-1"
    });
    const device = await issueToken(app, "Premium");
    store.grantPremium(device.userId);

    const response = await app.inject({
      method: "GET",
      url: "/v1/passages?bibleId=bible-1&passageId=JHN.3.16",
      headers: auth(device.token)
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "premium_catalog_disabled" });
  });

  it("requires a FUMS hash secret when premium API.Bible is enabled in production", async () => {
    await expect(
      buildServer({
        apiBibleClient: mockApiBibleClient(),
        tokenPepper: "test-pepper",
        env: {
          NODE_ENV: "production",
          API_BIBLE_KEY: "test-api-key",
          BIBLE_CODER_ENABLE_PREMIUM_API_BIBLE: "true",
          BIBLE_CODER_ALLOWED_PREMIUM_BIBLES: "bible-1"
        }
      }),
    ).rejects.toThrow(/FUMS_USER_HASH_SECRET/);
  });

  it("redacts paid passage text and FUMS tokens for model-visible output", async () => {
    const store = new InMemorySyncStore();
    const calls: URL[] = [];
    const app = await testServer(store, mockApiBibleClient(calls), premiumEnv());
    const device = await issueToken(app, "Premium");
    store.grantPremium(device.userId);

    const response = await app.inject({
      method: "GET",
      url: "/v1/passages?bibleId=bible-1&passageId=JHN.3.16",
      headers: auth(device.token)
    });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.content).toBeNull();
    expect(body.policy).toMatchObject({ textRedacted: true });
    expect(body.fums).toMatchObject({ required: true, tokenCaptured: true, reportUrl: null });
    expect(calls[0]?.searchParams.get("fums-version")).toBe("3");
    expect(JSON.stringify(body)).not.toContain("paid Scripture text");
    expect(JSON.stringify(body)).not.toContain("fums-token-1");
    expect(JSON.stringify(body)).not.toContain("test-api-key");
  });

  it("lists only allowed premium Bible metadata", async () => {
    const store = new InMemorySyncStore();
    const app = await testServer(store, mockApiBibleClient(), premiumEnv());
    const device = await issueToken(app, "Premium");
    store.grantPremium(device.userId);

    const response = await app.inject({ method: "GET", url: "/v1/bibles", headers: auth(device.token) });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      bibles: [{ id: "bible-1", abbreviation: "NIV", name: "Licensed Bible", copyright: "Licensed copyright" }]
    });
  });

  it("returns paid text only for explicit human display and caches content only in content cache mode", async () => {
    const store = new InMemorySyncStore();
    const calls: URL[] = [];
    const app = await testServer(store, mockApiBibleClient(calls), { ...premiumEnv(), BIBLE_CODER_CACHE_MODE: "content-14d" });
    const device = await issueToken(app, "Premium");
    store.grantPremium(device.userId);

    const first = await app.inject({
      method: "GET",
      url: "/v1/passages?bibleId=bible-1&passageId=JHN.3.16&surface=human",
      headers: auth(device.token)
    });
    const second = await app.inject({
      method: "GET",
      url: "/v1/passages?bibleId=bible-1&passageId=JHN.3.16&surface=human",
      headers: auth(device.token)
    });

    expect(first.json().content).toContain("paid Scripture text");
    expect(first.json().fums.reportUrl).toContain("https://fums.api.bible/f3");
    expect(first.json().fums.reportUrl).not.toContain(device.userId);
    expect(second.json().cache).toMatchObject({ mode: "content-14d", hit: true });
    expect(calls).toHaveLength(1);
  });

  it("redacts paid search snippets by default", async () => {
    const store = new InMemorySyncStore();
    const app = await testServer(store, mockApiBibleClient(), premiumEnv());
    const device = await issueToken(app, "Premium");
    store.grantPremium(device.userId);

    const response = await app.inject({
      method: "GET",
      url: "/v1/search?bibleId=bible-1&query=love",
      headers: auth(device.token)
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().verses[0]).toMatchObject({ reference: "John 3:16", text: null });
    expect(JSON.stringify(response.json())).not.toContain("paid search text");
  });

  it("creates Stripe Checkout sessions with subscription metadata", async () => {
    const stripe = new MockStripeGateway();
    const app = await testServer(new InMemorySyncStore(), undefined, billingEnv(), stripe);
    const device = await issueToken(app, "Billing");

    const response = await app.inject({
      method: "POST",
      url: "/v1/checkout/session",
      headers: auth(device.token),
      payload: { successUrl: "https://example.com/success", cancelUrl: "https://example.com/cancel" }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ id: "cs_test_1", url: "https://checkout.stripe.test/session" });
    expect(stripe.lastCheckout).toMatchObject({
      userId: device.userId,
      deviceId: device.deviceId,
      priceId: "price_premium_monthly",
      allowPromotionCodes: true,
      automaticTaxEnabled: false,
      trialPeriodDays: null,
      idempotencyKey: `checkout_${device.userId}_price_premium_monthly`
    });
  });

  it("verifies Stripe webhooks, ignores duplicates, and activates entitlement", async () => {
    const store = new InMemorySyncStore();
    const stripe = new MockStripeGateway();
    const app = await testServer(store, undefined, billingEnv(), stripe);
    const device = await issueToken(app, "Billing");
    stripe.nextEvent = stripeEvent("evt_checkout", "checkout.session.completed", {
      metadata: { user_id: device.userId },
      client_reference_id: device.userId,
      customer: "cus_123",
      subscription: "sub_123"
    });

    const first = await app.inject({
      method: "POST",
      url: "/v1/stripe/webhook",
      headers: { "stripe-signature": "valid", "content-type": "application/json" },
      payload: JSON.stringify({ id: "evt_checkout" })
    });
    const second = await app.inject({
      method: "POST",
      url: "/v1/stripe/webhook",
      headers: { "stripe-signature": "valid", "content-type": "application/json" },
      payload: JSON.stringify({ id: "evt_checkout" })
    });

    expect(first.json()).toMatchObject({ received: true, duplicate: false, eventId: "evt_checkout" });
    expect(second.json()).toMatchObject({ received: true, duplicate: true, eventId: "evt_checkout" });
    expect(store.hasPremium(device.userId)).toBe(true);
    expect(store.findUserIdByStripeCustomer("cus_123")).toBe(device.userId);
  });

  it("rejects invalid Stripe webhook signatures", async () => {
    const stripe = new MockStripeGateway();
    const app = await testServer(new InMemorySyncStore(), undefined, billingEnv(), stripe);

    const response = await app.inject({
      method: "POST",
      url: "/v1/stripe/webhook",
      headers: { "stripe-signature": "bad", "content-type": "application/json" },
      payload: JSON.stringify({ id: "evt_bad" })
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "invalid_stripe_signature" });
  });

  it("creates billing portal sessions for linked customers and updates subscription entitlement states", async () => {
    const store = new InMemorySyncStore();
    const stripe = new MockStripeGateway();
    const app = await testServer(store, undefined, billingEnv(), stripe);
    const device = await issueToken(app, "Billing");
    store.setStripeCustomer(device.userId, "cus_123");
    store.setStripeSubscription({ userId: device.userId, subscriptionId: "sub_123", status: "active" });

    const portal = await app.inject({
      method: "POST",
      url: "/v1/billing/portal",
      headers: auth(device.token),
      payload: { returnUrl: "https://example.com/account" }
    });
    expect(portal.statusCode).toBe(201);
    expect(portal.json()).toEqual({ id: "bps_test_1", url: "https://billing.stripe.test/session" });

    stripe.nextEvent = stripeEvent("evt_sub_deleted", "customer.subscription.deleted", {
      id: "sub_123",
      customer: "cus_123",
      status: "canceled",
      metadata: { user_id: device.userId },
      items: { data: [] }
    });
    await app.inject({
      method: "POST",
      url: "/v1/stripe/webhook",
      headers: { "stripe-signature": "valid", "content-type": "application/json" },
      payload: JSON.stringify({ id: "evt_sub_deleted" })
    });
    expect(store.hasPremium(device.userId)).toBe(false);
  });

  it("keeps premium during invoice payment failure grace", async () => {
    const store = new InMemorySyncStore();
    const stripe = new MockStripeGateway();
    const app = await testServer(store, undefined, billingEnv(), stripe);
    const device = await issueToken(app, "Billing");
    store.setStripeCustomer(device.userId, "cus_123");
    store.setStripeSubscription({ userId: device.userId, subscriptionId: "sub_123", status: "active" });
    stripe.nextEvent = stripeEvent("evt_invoice_failed", "invoice.payment_failed", {
      id: "in_123",
      customer: "cus_123",
      subscription: "sub_123"
    });

    await app.inject({
      method: "POST",
      url: "/v1/stripe/webhook",
      headers: { "stripe-signature": "valid", "content-type": "application/json" },
      payload: JSON.stringify({ id: "evt_invoice_failed" })
    });

    expect(store.hasPremium(device.userId)).toBe(true);
    expect(store.stripeSubscriptions.get("sub_123")?.status).toBe("past_due");
  });

  it("exposes privacy-minimal Prayer Gate settings and entitlement endpoints", async () => {
    const store = new InMemorySyncStore();
    const app = await testServer(store);
    const device = await issueToken(app, "Prayer Gate");

    const freeEntitlement = await app.inject({ method: "GET", url: "/v1/block/entitlement", headers: auth(device.token) });
    expect(freeEntitlement.statusCode).toBe(200);
    expect(freeEntitlement.json()).toMatchObject({ premium: false, mode: "soft-local", attestation: "I have prayed" });

    const denied = await app.inject({
      method: "PUT",
      url: "/v1/block/settings",
      headers: auth(device.token),
      payload: { enabled: true }
    });
    expect(denied.statusCode).toBe(403);

    store.grantPremium(device.userId);
    const enabled = await app.inject({
      method: "PUT",
      url: "/v1/block/settings",
      headers: auth(device.token),
      payload: { enabled: true, syncAttestations: false }
    });
    expect(enabled.statusCode).toBe(200);
    expect(enabled.json().settings).toMatchObject({ enabled: true, syncAttestations: false });

    const blockedSync = await app.inject({
      method: "POST",
      url: "/v1/prayer-attestations",
      headers: auth(device.token),
      payload: { occurredAt: "2026-05-14T08:00:00.000Z", repoHash: "repo-hash", branch: "main", commitSha: "abc123" }
    });
    expect(blockedSync.statusCode).toBe(409);

    await app.inject({
      method: "PUT",
      url: "/v1/block/settings",
      headers: auth(device.token),
      payload: { enabled: true, syncAttestations: true }
    });
    const attestation = await app.inject({
      method: "POST",
      url: "/v1/prayer-attestations",
      headers: auth(device.token),
      payload: { occurredAt: "2026-05-14T08:00:00.000Z", repoHash: "repo-hash", branch: "main", commitSha: "abc123" }
    });
    expect(attestation.statusCode).toBe(201);
    expect(attestation.json().attestation).toMatchObject({ repoHash: "repo-hash", branch: "main", commitSha: "abc123" });
    expect(JSON.stringify(attestation.json())).not.toContain("I have prayed");
  });

  it("keeps leaderboard opt-in and privacy-minimal", async () => {
    const app = await testServer();
    const device = await issueToken(app, "Leaderboard");

    await app.inject({
      method: "POST",
      url: "/v1/progress",
      headers: auth(device.token),
      payload: {
        idempotencyKey: "leaderboard-progress-1",
        planId: "plan_1",
        referenceId: "john.3.16-3.16",
        action: "completed",
        occurredAt: "2026-05-14T08:00:00.000Z"
      }
    });

    const hidden = await app.inject({ method: "GET", url: "/v1/leaderboard", headers: auth(device.token) });
    expect(hidden.statusCode).toBe(200);
    expect(hidden.json()).toEqual({ entries: [] });

    const profile = await app.inject({
      method: "PUT",
      url: "/v1/leaderboard/profile",
      headers: auth(device.token),
      payload: { optedIn: true, displayName: "Kiki" }
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json().profile).toMatchObject({ optedIn: true, displayName: "Kiki" });

    const visible = await app.inject({ method: "GET", url: "/v1/leaderboard", headers: auth(device.token) });
    expect(visible.statusCode).toBe(200);
    expect(visible.json()).toEqual({ entries: [{ displayName: "Kiki", completedCount: 1 }] });
    expect(JSON.stringify(visible.json())).not.toContain(device.userId);
    expect(JSON.stringify(visible.json())).not.toContain(device.deviceId);
    expect(JSON.stringify(visible.json())).not.toContain("john.3.16");

    await app.inject({
      method: "PUT",
      url: "/v1/leaderboard/profile",
      headers: auth(device.token),
      payload: { optedIn: false, displayName: "Kiki" }
    });
    const afterOptOut = await app.inject({ method: "GET", url: "/v1/leaderboard", headers: auth(device.token) });
    expect(afterOptOut.json()).toEqual({ entries: [] });
  });
});

interface DeviceTokenResponse {
  token: string;
  userId: string;
  deviceId: string;
}

async function testServer(store = new InMemorySyncStore(), apiBibleClient?: ApiBibleClient, env?: NodeJS.ProcessEnv, stripeGateway?: StripeGateway): Promise<FastifyInstance> {
  const app = await buildServer({
    store,
    apiBibleClient,
    env,
    stripeGateway,
    tokenPepper: "test-pepper",
    now: () => "2026-05-14T08:00:00.000Z"
  });
  apps.push(app);
  return app;
}

async function issueToken(app: FastifyInstance, deviceName: string): Promise<DeviceTokenResponse> {
  const response = await app.inject({
    method: "POST",
    url: "/v1/device-tokens",
    payload: { deviceName }
  });
  expect(response.statusCode).toBe(201);
  return response.json() as DeviceTokenResponse;
}

function auth(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

function premiumEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    API_BIBLE_KEY: "test-api-key",
    BIBLE_CODER_ENABLE_PREMIUM_API_BIBLE: "true",
    BIBLE_CODER_ALLOWED_PREMIUM_BIBLES: "bible-1",
    BIBLE_CODER_CACHE_MODE: "metadata-only",
    BIBLE_CODER_CACHE_TTL_DAYS: "14",
    FUMS_USER_HASH_SECRET: "test-fums-secret"
  };
}

function billingEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    STRIPE_SECRET_KEY: "sk_test_123",
    STRIPE_WEBHOOK_SECRET: "stripe_webhook_secret_fixture",
    STRIPE_PRICE_PREMIUM_MONTHLY: "price_premium_monthly"
  };
}

function mockApiBibleClient(calls: URL[] = []): ApiBibleClient {
  return new ApiBibleClient({
    apiKey: "test-api-key",
    fetchImpl: async (input) => {
      const url = new URL(String(input));
      calls.push(url);
      if (url.pathname.endsWith("/search")) {
        return jsonResponse({
          data: {
            query: "love",
            limit: 10,
            offset: 0,
            total: 1,
            verseCount: 1,
            verses: [{ id: "JHN.3.16", bibleId: "bible-1", reference: "John 3:16", text: "paid search text" }],
            passages: []
          },
          meta: { fumsToken: "fums-token-1" }
        });
      }
      if (url.pathname.endsWith("/bibles")) {
        return jsonResponse({ data: [{ id: "bible-1", abbreviation: "NIV", name: "Licensed Bible", copyright: "Licensed copyright" }] });
      }
      return jsonResponse({
        data: {
          id: "JHN.3.16",
          bibleId: "bible-1",
          reference: "John 3:16",
          content: "<p>paid Scripture text</p>",
          verseCount: 1,
          copyright: "Licensed copyright"
        },
        meta: { fumsToken: "fums-token-1" }
      });
    }
  });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

class MockStripeGateway implements StripeGateway {
  lastCheckout: unknown;
  nextEvent = stripeEvent("evt_default", "checkout.session.completed", {});

  async createCheckoutSession(input: {
    userId: string;
    deviceId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    allowPromotionCodes: boolean;
    automaticTaxEnabled: boolean;
    trialPeriodDays: number | null;
    idempotencyKey: string;
  }): Promise<{ id: string; url: string | null }> {
    this.lastCheckout = input;
    return { id: "cs_test_1", url: "https://checkout.stripe.test/session" };
  }

  async createBillingPortalSession(): Promise<{ id: string; url: string }> {
    return { id: "bps_test_1", url: "https://billing.stripe.test/session" };
  }

  constructWebhookEvent(_rawBody: Buffer, signature: string) {
    if (signature !== "valid") {
      throw new Error("Invalid signature");
    }
    return this.nextEvent;
  }
}

function stripeEvent(id: string, type: string, object: Record<string, unknown>) {
  return {
    id,
    type,
    data: { object }
  } as never;
}
