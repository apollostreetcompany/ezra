import { afterEach, describe, expect, it } from "vitest";
import worker from "../src/index.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Ezra MCP Cloudflare Worker — billing + account lifecycle", () => {
  it("responds to health checks from ezramcp.com", async () => {
    const response = await worker.fetch(new Request("https://ezramcp.com/health", {
      headers: { origin: "https://ezramcp.com" }
    }), env(new FakeD1()));
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://ezramcp.com");
    await expect(response.json()).resolves.toMatchObject({ ok: true, service: "ezra-mcp-api" });
  });

  it("reuses an existing normalized-email user for magic-link login", async () => {
    const db = new FakeD1();
    db.users.set("usr_existing", { email: "reader@example.com", created_at: "2026-05-16T00:00:00.000Z" });

    const request = await worker.fetch(
      new Request("https://ezramcp.com/v1/magic-links/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "Reader@Example.com" })
      }),
      env(db, { MAGIC_LINK_DEV_ECHO: "true" })
    );

    expect(request.status).toBe(200);
    const requestBody = await request.json() as { devCode: string; delivery: string };
    expect(requestBody.delivery).toBe("dev_echo");
    const [magicLink] = [...db.magicLinks.values()];
    expect(magicLink?.user_id).toBe("usr_existing");

    const verify = await worker.fetch(
      new Request("https://ezramcp.com/v1/magic-links/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "reader@example.com", code: requestBody.devCode })
      }),
      env(db)
    );

    expect(verify.status).toBe(200);
    const token = await verify.json() as { token: string };
    expect(token.token.startsWith("ezra_live_")).toBe(true);
    expect([...db.deviceTokens.values()].some((row) => row.user_id === "usr_existing" && row.scopes.includes("account:read"))).toBe(true);
  });

  it("creates public Pro and Max checkout sessions against existing email identity", async () => {
    const db = new FakeD1();
    db.users.set("usr_paid", { email: "paid@example.com", created_at: "2026-05-16T00:00:00.000Z" });
    const calls: Array<{ url: string; body: string; authorization: string | null }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        body: String(init?.body ?? ""),
        authorization: new Headers(init?.headers).get("authorization")
      });
      return jsonResponse({ id: "cs_test_public", url: "https://checkout.stripe.com/c/test" });
    }) as typeof fetch;

    const proResp = await worker.fetch(
      new Request("https://ezramcp.com/v1/checkout/public-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "Paid@Example.com", tier: "pro" })
      }),
      env(db)
    );
    const maxResp = await worker.fetch(
      new Request("https://ezramcp.com/v1/checkout/public-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "paid@example.com", tier: "max" })
      }),
      env(db)
    );

    expect(proResp.status).toBe(200);
    expect(maxResp.status).toBe(200);
    expect(calls).toHaveLength(2);
    expect(calls[0]!.body).toContain("customer_email=paid%40example.com");
    expect(calls[0]!.body).toContain("client_reference_id=usr_paid");
    expect(calls[0]!.body).toContain("line_items%5B0%5D%5Bprice%5D=price_pro");
    expect(calls[1]!.body).toContain("line_items%5B0%5D%5Bprice%5D=price_max");
    expect(calls[1]!.body).toContain("metadata%5Bsource%5D=public_site");
    expect(calls[1]!.authorization).toBe("Bearer stripe_test_secret_key");
  });

  it("creates authenticated checkout and Stripe Billing Portal sessions", async () => {
    const db = new FakeD1();
    const token = await issueSessionToken(db, "usr_portal");
    db.linkStripeCustomer("usr_portal", "cus_portal");
    const stripeCalls: Array<{ url: string; body: string; authorization: string | null }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      stripeCalls.push({
        url: String(input),
        body: String(init?.body ?? ""),
        authorization: new Headers(init?.headers).get("authorization")
      });
      return jsonResponse(String(input).includes("billing_portal")
        ? { url: "https://billing.stripe.com/p/session/test" }
        : { id: "cs_test_account", url: "https://checkout.stripe.com/c/test" });
    }) as typeof fetch;

    const checkout = await worker.fetch(
      new Request("https://ezramcp.com/v1/checkout/session", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier: "max" })
      }),
      env(db)
    );
    const portal = await worker.fetch(
      new Request("https://ezramcp.com/v1/billing/portal", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ returnUrl: "https://ezramcp.com/account/" })
      }),
      env(db)
    );

    await expect(checkout.json()).resolves.toMatchObject({ url: "https://checkout.stripe.com/c/test", tier: "max" });
    await expect(portal.json()).resolves.toEqual({ url: "https://billing.stripe.com/p/session/test" });
    expect(stripeCalls[0]!.url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(stripeCalls[0]!.body).toContain("metadata%5Bsource%5D=authenticated_account");
    expect(stripeCalls[1]!.url).toBe("https://api.stripe.com/v1/billing_portal/sessions");
    expect(stripeCalls[1]!.body).toContain("return_url=https%3A%2F%2Fezramcp.com%2Faccount%2F");
  });

  it("verifies checkout success and activates entitlement when the webhook is delayed", async () => {
    const db = new FakeD1();
    db.users.set("usr_status", { email: "status@example.com", created_at: "2026-05-16T00:00:00.000Z" });
    globalThis.fetch = (async () => jsonResponse({
      id: "cs_test_status",
      status: "complete",
      payment_status: "paid",
      customer: "cus_status",
      metadata: { user_id: "usr_status", tier: "pro", site: "ezra-mcp" },
      customer_details: { email: "status@example.com" }
    })) as typeof fetch;

    const response = await worker.fetch(
      new Request("https://ezramcp.com/v1/checkout/session-status?session_id=cs_test_status"),
      env(db)
    );

    await expect(response.json()).resolves.toMatchObject({
      checkout: { status: "complete", payment_status: "paid" },
      tier: "pro",
      premium: true,
      next: "/account/"
    });
    expect(db.entitlements.get("usr_status")?.status).toBe("pro");
    expect(db.stripeCustomersByUser.get("usr_status")?.customer_id).toBe("cus_status");
  });

  it("returns authenticated account status with tier, usage, and API key prefix", async () => {
    const db = new FakeD1();
    const token = await issueSessionToken(db, "usr_account", "reader@example.com");
    await issueMcpKey(db, "usr_account", "liveprefix");
    db.entitlements.set("usr_account", { status: "max", current_period_end: null, grace_until: null, updated_at: "now" });
    db.usage.set(`usr_account|${currentMonthKey()}`, { call_count: 7, updated_at: "now" });

    const response = await worker.fetch(
      new Request("https://ezramcp.com/v1/account/status", {
        headers: { authorization: `Bearer ${token}` }
      }),
      env(db)
    );

    await expect(response.json()).resolves.toMatchObject({
      user: { email: "reader@example.com" },
      tier: "max",
      usage: { used: 7, limit: 100000, remaining: 99993 },
      apiKey: { prefix: "liveprefix" },
      billing: { portal: "/v1/billing/portal" }
    });
  });

  it("processes duplicate Stripe checkout webhooks idempotently", async () => {
    const db = new FakeD1();
    db.users.set("usr_checkout", { email: null, created_at: "2026-05-16T00:00:00.000Z" });
    globalThis.fetch = (async () => new Response(null, { status: 202 })) as typeof fetch;
    const event = {
      id: "evt_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_checkout",
          metadata: { user_id: "usr_checkout", tier: "max", site: "ezra-mcp" },
          customer_details: { email: "reader@example.com" }
        }
      }
    };
    const payload = JSON.stringify(event);
    const signature = await stripeSignature(payload, "stripe_webhook_test_secret");
    const makeWebhookRequest = () => new Request("https://ezramcp.com/v1/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: payload
    });

    const first = await worker.fetch(makeWebhookRequest(), env(db));
    const second = await worker.fetch(makeWebhookRequest(), env(db));

    await expect(first.json()).resolves.toEqual({ received: true });
    await expect(second.json()).resolves.toEqual({ received: true, duplicate: true });
    expect(db.entitlements.get("usr_checkout")?.status).toBe("max");
    expect(db.stripeEvents.size).toBe(1);
  });
});

function env(db: FakeD1, overrides: Partial<Parameters<typeof worker.fetch>[1]> = {}): Parameters<typeof worker.fetch>[1] {
  return {
    DB: db,
    TOKEN_HASH_PEPPER: "pepper",
    STRIPE_SECRET_KEY: "stripe_test_secret_key",
    STRIPE_WEBHOOK_SECRET: "stripe_webhook_test_secret",
    STRIPE_PRICE_EZRA_PRO_MONTHLY: "price_pro",
    STRIPE_PRICE_EZRA_MAX_MONTHLY: "price_max",
    EZRA_MCP_UPGRADE_URL: "https://ezramcp.com/pro/",
    ...overrides
  };
}

async function issueSessionToken(db: FakeD1, userId: string, email: string | null = null): Promise<string> {
  db.users.set(userId, { email, created_at: "2026-05-16T00:00:00.000Z" });
  const token = `ezra_live_session_${userId}`;
  const hash = await sha256Hex(`pepper${token}`);
  db.deviceTokens.set(hash, {
    id: `dtok_${userId}`,
    user_id: userId,
    token_hash: hash,
    token_prefix: `sess_${userId}`,
    scopes: JSON.stringify(["account:read", "account:write"]),
    revoked_at: null,
    created_at: "2026-05-16T00:00:00.000Z"
  });
  return token;
}

async function issueMcpKey(db: FakeD1, userId: string, prefix = "mcp_prefix"): Promise<string> {
  const token = `ezra_live_mcp_${userId}`;
  const hash = await sha256Hex(`pepper${token}`);
  db.deviceTokens.set(hash, {
    id: `dtok_mcp_${userId}`,
    user_id: userId,
    token_hash: hash,
    token_prefix: prefix,
    scopes: JSON.stringify(["mcp:call"]),
    revoked_at: null,
    created_at: "2026-05-16T01:00:00.000Z"
  });
  return token;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function stripeSignature(payload: string, secret: string): Promise<string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  return `t=${timestamp},v1=${[...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

interface UserRow {
  email: string | null;
  created_at: string;
}

interface DeviceTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  token_prefix: string;
  scopes: string;
  revoked_at: string | null;
  created_at: string;
}

interface MagicLinkRow {
  id: string;
  email: string;
  code_hash: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
}

interface EntitlementRow {
  status: string;
  current_period_end: string | null;
  grace_until: string | null;
  updated_at: string;
}

interface UsageRow {
  call_count: number;
  updated_at: string;
}

class FakeD1 {
  users = new Map<string, UserRow>();
  deviceTokens = new Map<string, DeviceTokenRow>();
  magicLinks = new Map<string, MagicLinkRow>();
  stripeCustomersByUser = new Map<string, { customer_id: string; created_at: string }>();
  stripeCustomersByCustomer = new Map<string, { user_id: string; created_at: string }>();
  stripeEvents = new Set<string>();
  entitlements = new Map<string, EntitlementRow>();
  usage = new Map<string, UsageRow>();
  auditLog: Array<{ event: string }> = [];

  prepare(query: string): FakeStatement {
    return new FakeStatement(this, query);
  }

  linkStripeCustomer(userId: string, customerId: string): void {
    this.stripeCustomersByCustomer.set(customerId, { user_id: userId, created_at: new Date().toISOString() });
    this.stripeCustomersByUser.set(userId, { customer_id: customerId, created_at: new Date().toISOString() });
  }
}

class FakeStatement {
  private values: unknown[] = [];
  constructor(private readonly db: FakeD1, private readonly query: string) {}

  bind(...values: unknown[]): FakeStatement {
    this.values = values;
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const q = this.query;
    if (q.includes("SELECT id FROM users WHERE email")) {
      const email = String(this.values[0]);
      const match = [...this.db.users.entries()].find(([, row]) => row.email === email);
      return match ? ({ id: match[0] } as T) : null;
    }
    if (q.includes("SELECT email FROM users WHERE id")) {
      const row = this.db.users.get(String(this.values[0]));
      return row ? ({ email: row.email } as T) : null;
    }
    if (q.includes("FROM device_tokens WHERE token_hash")) {
      const row = this.db.deviceTokens.get(String(this.values[0]));
      return row ? ({ user_id: row.user_id, device_id: row.id, scopes: row.scopes, revoked_at: row.revoked_at } as T) : null;
    }
    if (q.includes("SELECT token_prefix FROM device_tokens WHERE user_id")) {
      const userId = String(this.values[0]);
      const row = [...this.db.deviceTokens.values()]
        .filter((candidate) => candidate.user_id === userId && candidate.scopes.includes("mcp:call") && !candidate.revoked_at)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      return row ? ({ token_prefix: row.token_prefix } as T) : null;
    }
    if (q.includes("SELECT id, user_id, expires_at, consumed_at FROM magic_links")) {
      const [email, codeHash] = this.values.map(String);
      const row = [...this.db.magicLinks.values()].find((candidate) => candidate.email === email && candidate.code_hash === codeHash);
      return row ? ({ id: row.id, user_id: row.user_id, expires_at: row.expires_at, consumed_at: row.consumed_at } as T) : null;
    }
    if (q.includes("SELECT customer_id FROM stripe_customers WHERE user_id")) {
      return (this.db.stripeCustomersByUser.get(String(this.values[0])) as T) ?? null;
    }
    if (q.includes("SELECT user_id FROM stripe_customers WHERE customer_id")) {
      return (this.db.stripeCustomersByCustomer.get(String(this.values[0])) as T) ?? null;
    }
    if (q.includes("SELECT id FROM stripe_events WHERE id")) {
      return this.db.stripeEvents.has(String(this.values[0])) ? ({ id: this.values[0] } as T) : null;
    }
    if (q.includes("FROM entitlements WHERE user_id")) {
      const row = this.db.entitlements.get(String(this.values[0]));
      return row ? ({ status: row.status, current_period_end: row.current_period_end, grace_until: row.grace_until } as T) : null;
    }
    if (q.includes("FROM usage_counters WHERE user_id")) {
      const row = this.db.usage.get(`${String(this.values[0])}|${String(this.values[1])}`);
      return row ? ({ call_count: row.call_count } as T) : null;
    }
    return null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results?: T[] }> {
    return { results: [] };
  }

  async run(): Promise<{ success: boolean }> {
    const q = this.query;
    if (q.startsWith("INSERT OR IGNORE INTO users")) {
      const [id, email, createdAt] = this.values.map(String);
      const existing = [...this.db.users.values()].some((row) => row.email === email);
      if (!existing && !this.db.users.has(id)) {
        this.db.users.set(id, { email, created_at: createdAt });
      }
      return { success: true };
    }
    if (q.startsWith("UPDATE users SET email")) {
      const row = this.db.users.get(String(this.values[1]));
      if (row) {
        row.email = String(this.values[0]);
      }
      return { success: true };
    }
    if (q.startsWith("INSERT INTO magic_links")) {
      const [id, email, codeHash, userId, createdAt, expiresAt] = this.values.map(String);
      this.db.magicLinks.set(id, { id, email, code_hash: codeHash, user_id: userId, created_at: createdAt, expires_at: expiresAt, consumed_at: null });
      return { success: true };
    }
    if (q.startsWith("UPDATE magic_links SET consumed_at")) {
      const row = this.db.magicLinks.get(String(this.values[1]));
      if (row) {
        row.consumed_at = String(this.values[0]);
      }
      return { success: true };
    }
    if (q.startsWith("INSERT INTO device_tokens")) {
      const [id, userId, tokenHash, tokenPrefix, , scopes, createdAt] = this.values.map(String);
      this.db.deviceTokens.set(tokenHash, { id, user_id: userId, token_hash: tokenHash, token_prefix: tokenPrefix, scopes, revoked_at: null, created_at: createdAt });
      return { success: true };
    }
    if (q.startsWith("UPDATE device_tokens SET last_seen_at")) return { success: true };
    if (q.startsWith("INSERT OR REPLACE INTO stripe_customers")) {
      this.db.linkStripeCustomer(String(this.values[1]), String(this.values[0]));
      return { success: true };
    }
    if (q.startsWith("INSERT INTO stripe_events")) {
      this.db.stripeEvents.add(String(this.values[0]));
      return { success: true };
    }
    if (q.startsWith("INSERT OR REPLACE INTO entitlements")) {
      this.db.entitlements.set(String(this.values[0]), {
        status: String(this.values[1]),
        current_period_end: this.values[2] as string | null,
        grace_until: this.values[3] as string | null,
        updated_at: String(this.values[4])
      });
      return { success: true };
    }
    if (q.startsWith("INSERT INTO usage_counters")) {
      const key = `${String(this.values[0])}|${String(this.values[1])}`;
      if (!this.db.usage.has(key)) {
        this.db.usage.set(key, { call_count: 0, updated_at: String(this.values[2]) });
      }
      return { success: true };
    }
    if (q.startsWith("UPDATE usage_counters SET call_count")) {
      const key = `${String(this.values[1])}|${String(this.values[2])}`;
      const row = this.db.usage.get(key);
      if (row) {
        this.db.usage.set(key, { call_count: row.call_count + 1, updated_at: String(this.values[0]) });
      }
      return { success: true };
    }
    if (q.startsWith("INSERT INTO audit_log")) {
      this.db.auditLog.push({ event: String(this.values[3]) });
      return { success: true };
    }
    if (q.startsWith("INSERT INTO refund_requests")) return { success: true };
    return { success: true };
  }
}
