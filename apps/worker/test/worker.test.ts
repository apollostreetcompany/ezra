import { afterEach, describe, expect, it } from "vitest";
import worker from "../src/index.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("Ezra MCP Cloudflare Worker — billing + lifecycle", () => {
  it("responds to health checks", async () => {
    const response = await worker.fetch(new Request("https://api.ezra-mcp.com/health"), env(new FakeD1()));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, service: "ezra-mcp-api" });
  });

  it("creates a Stripe Billing Portal session for an authenticated customer", async () => {
    const db = new FakeD1();
    const token = await issueSessionToken(db);
    const userId = [...db.users.keys()][0]!;
    db.linkStripeCustomer(userId, "cus_portal");
    const stripeCalls: Array<{ url: string; body: string; authorization: string | null }> = [];
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      stripeCalls.push({
        url: String(input),
        body: String(init?.body ?? ""),
        authorization: new Headers(init?.headers).get("authorization")
      });
      return jsonResponse({ url: "https://billing.stripe.com/p/session/test" });
    }) as typeof fetch;

    const response = await worker.fetch(
      new Request("https://api.ezra-mcp.com/v1/billing/portal", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ returnUrl: "https://ezra-mcp.com/account" })
      }),
      env(db),
    );

    await expect(response.json()).resolves.toEqual({ url: "https://billing.stripe.com/p/session/test" });
    expect(response.status).toBe(200);
    expect(stripeCalls).toHaveLength(1);
    expect(stripeCalls[0]!.url).toBe("https://api.stripe.com/v1/billing_portal/sessions");
    expect(stripeCalls[0]!.body).toContain("customer=cus_portal");
    expect(stripeCalls[0]!.authorization).toBe("Bearer stripe_test_secret_key");
  });

  it("creates a checkout session with the pro price by default and the max price on request", async () => {
    const db = new FakeD1();
    const token = await issueSessionToken(db);
    const calls: string[] = [];
    globalThis.fetch = (async (_: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(init?.body ?? ""));
      return jsonResponse({ url: "https://checkout.stripe.com/c/test" });
    }) as typeof fetch;

    const proResp = await worker.fetch(
      new Request("https://api.ezra-mcp.com/v1/checkout/session", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({})
      }),
      env(db),
    );
    expect(proResp.status).toBe(200);
    expect(calls[0]).toContain("price_pro");
    expect(calls[0]).toContain("metadata%5Btier%5D=pro");

    const maxResp = await worker.fetch(
      new Request("https://api.ezra-mcp.com/v1/checkout/session", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        body: JSON.stringify({ tier: "max" })
      }),
      env(db),
    );
    expect(maxResp.status).toBe(200);
    expect(calls[1]).toContain("price_max");
    expect(calls[1]).toContain("metadata%5Btier%5D=max");
  });

  it("processes a Stripe checkout.session.completed webhook and writes the tier into entitlements", async () => {
    const db = new FakeD1();
    db.users.set("usr_checkout", { email: null });
    globalThis.fetch = (async () => new Response(null, { status: 202 })) as typeof fetch;
    const event = {
      id: "evt_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          customer: "cus_checkout",
          metadata: { user_id: "usr_checkout", tier: "max" },
          customer_details: { email: "reader@example.com" }
        }
      }
    };
    const payload = JSON.stringify(event);

    const response = await worker.fetch(
      new Request("https://api.ezra-mcp.com/v1/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": await stripeSignature(payload, "stripe_webhook_test_secret") },
        body: payload
      }),
      env(db, { KLAVIYO_PRIVATE_API_KEY: "klaviyo_test_private_key" }),
    );

    await expect(response.json()).resolves.toEqual({ received: true });
    expect(db.entitlements.get("usr_checkout")?.status).toBe("max");
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
    EZRA_MCP_UPGRADE_URL: "https://ezra-mcp.com/upgrade",
    ...overrides
  };
}

async function issueSessionToken(db: FakeD1): Promise<string> {
  // Simulate magic-link verify by injecting a session-scope device token directly.
  const userId = `usr_${db.users.size + 1}`;
  db.users.set(userId, { email: null });
  const token = `ezra_live_session_${userId}`;
  const hash = await sha256Hex(`pepper${token}`);
  db.deviceTokens.set(hash, { id: `dtok_${userId}`, user_id: userId, scopes: JSON.stringify(["sync:read", "sync:write"]), revoked_at: null });
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

class FakeD1 {
  users = new Map<string, { email: string | null }>();
  deviceTokens = new Map<string, { id: string; user_id: string; scopes: string; revoked_at: string | null }>();
  stripeCustomersByUser = new Map<string, { customer_id: string; created_at: string }>();
  stripeCustomersByCustomer = new Map<string, { user_id: string; created_at: string }>();
  stripeEvents = new Set<string>();
  entitlements = new Map<string, { status: string; current_period_end: string | null; grace_until: string | null; updated_at: string }>();
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
    if (q.includes("FROM device_tokens WHERE token_hash")) {
      const row = this.db.deviceTokens.get(String(this.values[0]));
      return row ? ({ user_id: row.user_id, device_id: row.id, scopes: row.scopes, revoked_at: row.revoked_at } as T) : null;
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
      return row ? ({ status: row.status, grace_until: row.grace_until } as T) : null;
    }
    return null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results?: T[] }> {
    return { results: [] };
  }

  async run(): Promise<{ success: boolean }> {
    const q = this.query;
    if (q.startsWith("INSERT OR IGNORE INTO users")) return { success: true };
    if (q.startsWith("UPDATE users SET email")) return { success: true };
    if (q.startsWith("INSERT INTO device_tokens")) return { success: true };
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
    if (q.startsWith("INSERT INTO audit_log")) {
      this.db.auditLog.push({ event: String(this.values[3]) });
      return { success: true };
    }
    if (q.startsWith("INSERT INTO refund_requests") || q.startsWith("INSERT INTO magic_links") || q.startsWith("UPDATE magic_links")) {
      return { success: true };
    }
    return { success: true };
  }
}
