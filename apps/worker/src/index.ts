import {
  handleJsonRpc,
  rateLimitResponse,
  unauthorizedResponse
} from "./mcp/handler.js";
import type { JsonRpcRequest, JsonRpcResponse, Tier } from "./mcp/types.js";
import { TIER_LIMITS } from "./mcp/types.js";

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<{ success: boolean }>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface Env {
  DB: D1Database;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_EZRA_PRO_MONTHLY?: string;
  STRIPE_PRICE_EZRA_MAX_MONTHLY?: string;
  TOKEN_HASH_PEPPER?: string;
  MAGIC_LINK_DEV_ECHO?: string;
  KLAVIYO_PRIVATE_API_KEY?: string;
  KLAVIYO_REVISION?: string;
  EZRA_MCP_UPGRADE_URL?: string;
}

interface DeviceAuth {
  userId: string;
  deviceId: string;
  scopes: string[];
}

interface DeviceTokenRow {
  user_id: string;
  device_id: string;
  scopes: string;
  revoked_at: string | null;
}

interface EntitlementRow {
  status: string;
  grace_until: string | null;
}

interface StripeEventObject {
  id?: string;
  customer?: string | { id?: string };
  subscription?: string;
  metadata?: Record<string, string>;
  status?: string;
  current_period_end?: number;
  amount_refunded?: number;
  amount?: number;
  currency?: string;
  refunded?: boolean;
  customer_email?: string | null;
  customer_details?: { email?: string | null };
  billing_reason?: string;
  items?: { data?: Array<{ price?: { id?: string } }> };
}

const MCP_SCOPE = "mcp:call";
const SYNC_SCOPES = JSON.stringify(["sync:read", "sync:write"]);
const MCP_SCOPES = JSON.stringify([MCP_SCOPE]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return json({}, 204);
    }
    const url = new URL(request.url);
    try {
      if (url.pathname === "/health") {
        return json({ ok: true, service: "ezra-mcp-api", version: "0.1.0" });
      }
      if (url.pathname === "/v1/mcp" && request.method === "POST") {
        return handleMcp(request, env);
      }
      if (url.pathname === "/v1/api-keys" && request.method === "POST") {
        return handleIssueApiKey(request, env);
      }
      if (url.pathname === "/v1/magic-links/request" && request.method === "POST") {
        return handleMagicLinkRequest(request, env);
      }
      if (url.pathname === "/v1/magic-links/verify" && request.method === "POST") {
        return handleMagicLinkVerify(request, env);
      }
      if (url.pathname === "/v1/checkout/session" && request.method === "POST") {
        return handleCheckout(request, env);
      }
      if (url.pathname === "/v1/billing/portal" && request.method === "POST") {
        return handleBillingPortal(request, env);
      }
      if (url.pathname === "/v1/refunds/request" && request.method === "POST") {
        return handleRefundRequest(request, env);
      }
      if (url.pathname === "/v1/stripe/webhook" && request.method === "POST") {
        return handleStripeWebhook(request, env);
      }
      return json({ error: "not_found" }, 404);
    } catch (error) {
      const message = error instanceof Error ? error.message : "worker_error";
      const status = message === "unauthorized" ? 401 : 500;
      return json({ error: message }, status);
    }
  }
};

async function handleMcp(request: Request, env: Env): Promise<Response> {
  let body: JsonRpcRequest;
  try {
    body = await readJson<JsonRpcRequest>(request);
  } catch {
    return jsonRpcResponse({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }
  const id = body?.id ?? null;
  const auth = await authenticate(request, env);
  if (!auth || !auth.scopes.includes(MCP_SCOPE)) {
    return jsonRpcResponse(unauthorizedResponse(id), 401);
  }

  // tools/call is the only metered method; initialize and tools/list are free.
  const method = body?.method ?? "";
  if (method === "tools/call") {
    const usage = await checkAndIncrementUsage(env, auth.userId, new Date());
    if (!usage.ok) {
      return jsonRpcResponse(
        rateLimitResponse(id, usage.limit, usage.used, usage.tier, upgradeUrl(env)),
        429
      );
    }
  }
  const response = await handleJsonRpc(body, { env, upgradeUrl: upgradeUrl(env) });
  return jsonRpcResponse(response, 200);
}

async function handleIssueApiKey(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  const now = new Date().toISOString();
  const body = await readJson<{ name?: string }>(request);
  const token = await generateToken(required(env.TOKEN_HASH_PEPPER, "TOKEN_HASH_PEPPER"));
  await env.DB
    .prepare(
      "INSERT INTO device_tokens (id, user_id, token_hash, token_prefix, device_name, scopes, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      `dtok_${crypto.randomUUID()}`,
      auth.userId,
      token.hash,
      token.prefix,
      body.name?.trim() || "Ezra MCP API Key",
      MCP_SCOPES,
      now,
      now
    )
    .run();
  const tier = await getUserTier(env, auth.userId);
  const used = await currentMonthUsage(env, auth.userId, new Date());
  const limit = TIER_LIMITS[tier];
  return json({
    key: token.value,
    prefix: token.prefix,
    tier,
    free_calls_remaining: Math.max(0, limit - used)
  }, 201);
}

async function handleMagicLinkRequest(request: Request, env: Env): Promise<Response> {
  const now = new Date();
  const body = await readJson<{ email?: string }>(request);
  const email = normalizeEmail(body.email);
  const userId = `usr_${crypto.randomUUID()}`;
  const code = randomHex(18);
  const codeHash = await sha256Hex(`${required(env.TOKEN_HASH_PEPPER, "TOKEN_HASH_PEPPER")}:${code}`);
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO users (id, email, created_at) VALUES (?, ?, ?)").bind(userId, email, now.toISOString()).run();
  await env.DB
    .prepare("INSERT INTO magic_links (id, email, code_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(`mlink_${crypto.randomUUID()}`, email, codeHash, userId, now.toISOString(), expiresAt)
    .run();
  return json({
    ok: true,
    delivery: env.MAGIC_LINK_DEV_ECHO === "true" ? "dev_echo" : "email_provider_pending",
    ...(env.MAGIC_LINK_DEV_ECHO === "true" ? { devCode: code } : {})
  });
}

async function handleMagicLinkVerify(request: Request, env: Env): Promise<Response> {
  const now = new Date().toISOString();
  const body = await readJson<{ email?: string; code?: string; deviceName?: string }>(request);
  const email = normalizeEmail(body.email);
  const code = String(body.code ?? "").trim();
  if (!code) {
    return json({ error: "missing_code" }, 400);
  }
  const codeHash = await sha256Hex(`${required(env.TOKEN_HASH_PEPPER, "TOKEN_HASH_PEPPER")}:${code}`);
  const row = await env.DB
    .prepare("SELECT id, user_id, expires_at, consumed_at FROM magic_links WHERE email = ? AND code_hash = ?")
    .bind(email, codeHash)
    .first<{ id: string; user_id: string; expires_at: string; consumed_at: string | null }>();
  if (!row || row.consumed_at || row.expires_at < now) {
    return json({ error: "invalid_or_expired_code" }, 401);
  }
  await env.DB.prepare("UPDATE magic_links SET consumed_at = ? WHERE id = ?").bind(now, row.id).run();
  const token = await generateToken(required(env.TOKEN_HASH_PEPPER, "TOKEN_HASH_PEPPER"));
  await env.DB
    .prepare(
      "INSERT INTO device_tokens (id, user_id, token_hash, token_prefix, device_name, scopes, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(`dtok_${crypto.randomUUID()}`, row.user_id, token.hash, token.prefix, body.deviceName?.trim() || "Magic link session", SYNC_SCOPES, now, now)
    .run();
  return json({ token: token.value });
}

async function handleCheckout(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  const body = await readJson<{ successUrl?: string; cancelUrl?: string; tier?: string }>(request);
  const tier = body.tier === "max" ? "max" : "pro";
  const price = tier === "max"
    ? required(env.STRIPE_PRICE_EZRA_MAX_MONTHLY, "STRIPE_PRICE_EZRA_MAX_MONTHLY")
    : required(env.STRIPE_PRICE_EZRA_PRO_MONTHLY, "STRIPE_PRICE_EZRA_PRO_MONTHLY");
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("success_url", body.successUrl || "https://ezra-mcp.com/checkout/success");
  params.set("cancel_url", body.cancelUrl || "https://ezra-mcp.com/checkout/cancel");
  params.set("client_reference_id", auth.userId);
  params.set("line_items[0][price]", price);
  params.set("line_items[0][quantity]", "1");
  params.set("metadata[user_id]", auth.userId);
  params.set("metadata[device_id]", auth.deviceId);
  params.set("metadata[tier]", tier);
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${required(env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY")}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: params
  });
  if (!response.ok) {
    return json({ error: "stripe_checkout_failed" }, 502);
  }
  const session = await response.json() as { url?: string };
  return json({ url: session.url ?? null, tier });
}

async function handleBillingPortal(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  const body = await readJson<{ returnUrl?: string }>(request);
  const customer = await env.DB
    .prepare("SELECT customer_id FROM stripe_customers WHERE user_id = ?")
    .bind(auth.userId)
    .first<{ customer_id: string }>();
  if (!customer) {
    return json({ error: "stripe_customer_missing" }, 404);
  }
  const params = new URLSearchParams();
  params.set("customer", customer.customer_id);
  params.set("return_url", normalizeReturnUrl(body.returnUrl, "https://ezra-mcp.com/account"));
  const response = await stripePost(env, "/v1/billing_portal/sessions", params);
  if (!response.ok) {
    return json({ error: "stripe_billing_portal_failed" }, 502);
  }
  const session = await response.json() as { url?: string };
  return json({ url: session.url ?? null });
}

async function handleRefundRequest(request: Request, env: Env): Promise<Response> {
  const auth = await requireAuth(request, env);
  const now = new Date().toISOString();
  const body = await readJson<{
    email?: string;
    chargeId?: string;
    invoiceId?: string;
    amount?: number;
    reason?: string;
    message?: string;
  }>(request);
  const customer = await env.DB
    .prepare("SELECT customer_id FROM stripe_customers WHERE user_id = ?")
    .bind(auth.userId)
    .first<{ customer_id: string }>();
  if (!customer) {
    return json({ error: "stripe_customer_missing" }, 404);
  }
  const storedEmail = await findUserEmail(env, auth.userId);
  const email = normalizeOptionalEmail(body.email) ?? storedEmail;
  const requestId = `ref_${crypto.randomUUID()}`;
  const metadata = {
    chargeId: cleanText(body.chargeId, 128),
    invoiceId: cleanText(body.invoiceId, 128),
    amount: typeof body.amount === "number" && Number.isFinite(body.amount) ? Math.max(0, Math.trunc(body.amount)) : null,
    reason: cleanText(body.reason, 120),
    message: cleanText(body.message, 1000)
  };
  await env.DB
    .prepare(
      "INSERT INTO refund_requests (id, user_id, device_id, stripe_customer_id, email, status, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(requestId, auth.userId, auth.deviceId, customer.customer_id, email, "requested", JSON.stringify(metadata), now)
    .run();
  await audit(env, auth.userId, auth.deviceId, "refund_requested", { requestId, stripeCustomerId: customer.customer_id }, now);
  await sendKlaviyoEvent(env, {
    email,
    metric: "Refund Requested",
    uniqueId: requestId,
    time: now,
    properties: {
      requestId,
      userId: auth.userId,
      hasChargeId: Boolean(metadata.chargeId),
      hasInvoiceId: Boolean(metadata.invoiceId),
      amount: metadata.amount,
      reason: metadata.reason
    }
  });
  return json({ status: "received", requestId, autoRefunded: false }, 202);
}

async function handleStripeWebhook(request: Request, env: Env): Promise<Response> {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";
  const webhookSecret = required(env.STRIPE_WEBHOOK_SECRET, "STRIPE_WEBHOOK_SECRET");
  if (!(await verifyStripeSignature(payload, signature, webhookSecret))) {
    return json({ error: "invalid_signature" }, 400);
  }
  const event = JSON.parse(payload) as {
    id: string;
    type: string;
    data?: { object?: StripeEventObject };
  };
  const now = new Date().toISOString();
  const existing = await env.DB.prepare("SELECT id FROM stripe_events WHERE id = ?").bind(event.id).first<{ id: string }>();
  if (existing) {
    return json({ received: true, duplicate: true });
  }
  const object = event.data?.object;
  const userId = object?.metadata?.user_id;
  const customerId = stripeCustomerId(object);
  if (event.type === "checkout.session.completed" && userId && customerId) {
    await env.DB.prepare("INSERT OR REPLACE INTO stripe_customers (customer_id, user_id, created_at) VALUES (?, ?, ?)").bind(customerId, userId, now).run();
    const email = normalizeOptionalEmail(object?.customer_details?.email ?? object?.customer_email);
    if (email) {
      await env.DB.prepare("UPDATE users SET email = ? WHERE id = ?").bind(email, userId).run();
    }
    const tier = parseTierFromMetadata(object?.metadata) ?? "pro";
    await setEntitlement(env, userId, tier, null, now);
    await sendKlaviyoEvent(env, {
      email: email ?? await findUserEmail(env, userId),
      metric: "Started Subscription",
      uniqueId: event.id,
      time: now,
      properties: { userId, stripeCustomerId: customerId, source: "stripe", tier }
    });
  } else if (event.type === "invoice.payment_failed" && customerId) {
    const customer = await env.DB.prepare("SELECT user_id FROM stripe_customers WHERE customer_id = ?").bind(customerId).first<{ user_id: string }>();
    if (customer) {
      await setEntitlement(env, customer.user_id, "past_due", null, now);
      await sendKlaviyoEvent(env, {
        email: await findUserEmail(env, customer.user_id),
        metric: "Payment Failed",
        uniqueId: event.id,
        time: now,
        properties: { userId: customer.user_id, stripeCustomerId: customerId, source: "stripe" }
      });
    }
  } else if (event.type.startsWith("customer.subscription.") && customerId) {
    const customer = await env.DB.prepare("SELECT user_id FROM stripe_customers WHERE customer_id = ?").bind(customerId).first<{ user_id: string }>();
    if (customer) {
      const stripeStatus = object?.status ?? "unknown";
      const periodEnd = object?.current_period_end ? new Date(object.current_period_end * 1000).toISOString() : null;
      const priceId = firstPriceId(object);
      const tier = priceTier(env, priceId);
      const isActive = stripeStatus === "active" || stripeStatus === "trialing";
      const isCanceled = event.type === "customer.subscription.deleted" || stripeStatus === "canceled";
      const status = isCanceled ? "canceled" : isActive && tier ? tier : stripeStatus;
      await setEntitlement(env, customer.user_id, status, periodEnd, now);
      if (isCanceled) {
        await sendKlaviyoEvent(env, {
          email: await findUserEmail(env, customer.user_id),
          metric: "Subscription Canceled",
          uniqueId: event.id,
          time: now,
          properties: { userId: customer.user_id, stripeCustomerId: customerId, source: "stripe", status }
        });
      }
    }
  } else if (event.type === "charge.refunded" && customerId) {
    const customer = await env.DB.prepare("SELECT user_id FROM stripe_customers WHERE customer_id = ?").bind(customerId).first<{ user_id: string }>();
    if (customer) {
      await audit(env, customer.user_id, null, "stripe_refund_processed", {
        chargeId: object?.id ?? null,
        stripeCustomerId: customerId,
        amountRefunded: object?.amount_refunded ?? null,
        chargeAmount: object?.amount ?? null,
        currency: object?.currency ?? null,
        fullyRefunded: Boolean(object?.refunded)
      }, now);
      await sendKlaviyoEvent(env, {
        email: await findUserEmail(env, customer.user_id),
        metric: "Refund Processed",
        uniqueId: event.id,
        time: now,
        properties: {
          userId: customer.user_id,
          stripeCustomerId: customerId,
          chargeId: object?.id ?? null,
          amountRefunded: object?.amount_refunded ?? null,
          currency: object?.currency ?? null,
          fullyRefunded: Boolean(object?.refunded)
        }
      });
    }
  }
  await env.DB.prepare("INSERT INTO stripe_events (id, type, processed_at) VALUES (?, ?, ?)").bind(event.id, event.type, now).run();
  return json({ received: true });
}

async function authenticate(request: Request, env: Env): Promise<DeviceAuth | undefined> {
  const token = bearer(request);
  if (!token) {
    return undefined;
  }
  const hash = await sha256Hex(`${required(env.TOKEN_HASH_PEPPER, "TOKEN_HASH_PEPPER")}${token}`);
  const row = await env.DB
    .prepare("SELECT user_id, id AS device_id, scopes, revoked_at FROM device_tokens WHERE token_hash = ?")
    .bind(hash)
    .first<DeviceTokenRow>();
  if (!row || row.revoked_at) {
    return undefined;
  }
  await env.DB.prepare("UPDATE device_tokens SET last_seen_at = ? WHERE token_hash = ?").bind(new Date().toISOString(), hash).run();
  let scopes: string[] = [];
  try {
    const parsed = JSON.parse(row.scopes);
    if (Array.isArray(parsed)) {
      scopes = parsed.filter((value): value is string => typeof value === "string");
    }
  } catch {
    scopes = [];
  }
  return { userId: row.user_id, deviceId: row.device_id, scopes };
}

async function requireAuth(request: Request, env: Env): Promise<DeviceAuth> {
  const auth = await authenticate(request, env);
  if (!auth) {
    throw new Error("unauthorized");
  }
  return auth;
}

async function getUserTier(env: Env, userId: string): Promise<Tier> {
  const row = await env.DB.prepare("SELECT status, grace_until FROM entitlements WHERE user_id = ?").bind(userId).first<EntitlementRow>();
  if (!row) return "free";
  if (row.status === "max" || row.status === "pro") return row.status;
  if (row.status === "active" || row.status === "trialing") return "pro";
  if (row.status === "past_due" && row.grace_until && row.grace_until >= new Date().toISOString()) {
    return "pro";
  }
  return "free";
}

async function checkAndIncrementUsage(
  env: Env,
  userId: string,
  now: Date
): Promise<{ ok: boolean; limit: number; used: number; tier: Tier }> {
  const tier = await getUserTier(env, userId);
  const limit = TIER_LIMITS[tier];
  const period = monthKey(now);
  const nowIso = now.toISOString();
  await env.DB
    .prepare(
      "INSERT INTO usage_counters (user_id, period_yyyy_mm, call_count, updated_at) VALUES (?, ?, 0, ?) ON CONFLICT(user_id, period_yyyy_mm) DO NOTHING"
    )
    .bind(userId, period, nowIso)
    .run();
  const row = await env.DB
    .prepare("SELECT call_count FROM usage_counters WHERE user_id = ? AND period_yyyy_mm = ?")
    .bind(userId, period)
    .first<{ call_count: number }>();
  const used = row?.call_count ?? 0;
  if (used >= limit) {
    return { ok: false, limit, used, tier };
  }
  await env.DB
    .prepare(
      "UPDATE usage_counters SET call_count = call_count + 1, updated_at = ? WHERE user_id = ? AND period_yyyy_mm = ?"
    )
    .bind(nowIso, userId, period)
    .run();
  return { ok: true, limit, used: used + 1, tier };
}

async function currentMonthUsage(env: Env, userId: string, now: Date): Promise<number> {
  const row = await env.DB
    .prepare("SELECT call_count FROM usage_counters WHERE user_id = ? AND period_yyyy_mm = ?")
    .bind(userId, monthKey(now))
    .first<{ call_count: number }>();
  return row?.call_count ?? 0;
}

function monthKey(now: Date): string {
  const year = now.getUTCFullYear();
  const month = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${year}-${month}`;
}

async function setEntitlement(env: Env, userId: string, status: string, currentPeriodEnd: string | null, now: string): Promise<void> {
  const graceUntil = status === "past_due" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null;
  await env.DB
    .prepare(
      "INSERT OR REPLACE INTO entitlements (user_id, status, current_period_end, grace_until, updated_at) VALUES (?, ?, ?, ?, ?)",
    )
    .bind(userId, status || "unknown", currentPeriodEnd, graceUntil, now)
    .run();
}

function parseTierFromMetadata(metadata: Record<string, string> | undefined): Tier | null {
  const value = metadata?.tier;
  if (value === "pro" || value === "max") return value;
  return null;
}

function firstPriceId(object: StripeEventObject | undefined): string | undefined {
  return object?.items?.data?.[0]?.price?.id;
}

function priceTier(env: Env, priceId: string | undefined): Tier | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_EZRA_MAX_MONTHLY) return "max";
  if (priceId === env.STRIPE_PRICE_EZRA_PRO_MONTHLY) return "pro";
  return null;
}

function upgradeUrl(env: Env): string {
  return env.EZRA_MCP_UPGRADE_URL || "https://ezra-mcp.com/upgrade";
}

async function stripePost(env: Env, path: string, params: URLSearchParams): Promise<Response> {
  return fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${required(env.STRIPE_SECRET_KEY, "STRIPE_SECRET_KEY")}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: params
  });
}

async function sendKlaviyoEvent(
  env: Env,
  event: { email?: string | null | undefined; metric: string; uniqueId: string; time: string; properties: Record<string, unknown> },
): Promise<{ sent: boolean; skipped: boolean }> {
  const apiKey = env.KLAVIYO_PRIVATE_API_KEY;
  if (!apiKey || !event.email) {
    return { sent: false, skipped: true };
  }
  const body = {
    data: {
      type: "event",
      attributes: {
        metric: { data: { type: "metric", attributes: { name: event.metric } } },
        profile: { data: { type: "profile", attributes: { email: event.email } } },
        properties: event.properties,
        time: event.time,
        unique_id: event.uniqueId
      }
    }
  };
  try {
    const response = await fetch("https://a.klaviyo.com/api/events", {
      method: "POST",
      headers: {
        authorization: `Klaviyo-API-Key ${apiKey}`,
        "content-type": "application/vnd.api+json",
        accept: "application/vnd.api+json",
        revision: env.KLAVIYO_REVISION || "2026-04-15"
      },
      body: JSON.stringify(body)
    });
    return { sent: response.ok, skipped: false };
  } catch {
    return { sent: false, skipped: false };
  }
}

async function findUserEmail(env: Env, userId: string): Promise<string | undefined> {
  const row = await env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(userId).first<{ email: string | null }>();
  return normalizeOptionalEmail(row?.email);
}

async function audit(env: Env, userId: string | null, deviceId: string | null, event: string, metadata: Record<string, unknown>, now: string): Promise<void> {
  await env.DB
    .prepare("INSERT INTO audit_log (id, user_id, device_id, event, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(`audit_${crypto.randomUUID()}`, userId, deviceId, event, JSON.stringify(metadata), now)
    .run();
}

async function generateToken(pepper: string): Promise<{ value: string; prefix: string; hash: string }> {
  const random = randomHex(32);
  const prefix = random.slice(0, 12);
  const value = `ezra_live_${prefix}_${random}`;
  return { value, prefix, hash: await sha256Hex(`${pepper}${value}`) };
}

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  const pieces = header.split(",").reduce<{ timestamp: string | null; signatures: string[] }>(
    (accumulator, part) => {
      const [key, value] = part.split("=");
      if (key === "t" && value) {
        accumulator.timestamp = value;
      } else if (key === "v1" && value) {
        accumulator.signatures.push(value);
      }
      return accumulator;
    },
    { timestamp: null, signatures: [] },
  );
  if (!pieces.timestamp || pieces.signatures.length === 0) {
    return false;
  }
  const timestampSeconds = Number.parseInt(pieces.timestamp, 10);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) {
    return false;
  }
  const key = await crypto.subtle.importKey("raw", encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encode(`${pieces.timestamp}.${payload}`));
  const expected = hex(new Uint8Array(digest));
  return pieces.signatures.some((signature) => constantTimeEqual(expected, signature));
}

function bearer(request: Request): string | undefined {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1];
}

async function readJson<T>(request: Request): Promise<T> {
  const text = await request.text();
  return text ? JSON.parse(text) as T : {} as T;
}

function json(payload: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "https://ezra-mcp.com",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "authorization,content-type,stripe-signature"
    }
  });
}

function jsonRpcResponse(payload: JsonRpcResponse, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST,OPTIONS",
      "access-control-allow-headers": "authorization,content-type"
    }
  });
}

function normalizeEmail(value: unknown): string {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("valid_email_required");
  }
  return email;
}

function normalizeOptionalEmail(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return normalizeEmail(value);
}

function normalizeReturnUrl(value: unknown, fallback: string): string {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const candidate = String(value);
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
      throw new Error("invalid_return_url");
    }
    return url.toString();
  } catch {
    throw new Error("invalid_return_url");
  }
}

function required(value: string | undefined, label: string): string {
  if (!value) {
    throw new Error(`${label}_required`);
  }
  return value;
}

function cleanText(value: unknown, maxLength: number): string | null {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function stripeCustomerId(object: StripeEventObject | undefined): string | undefined {
  if (typeof object?.customer === "string") {
    return object.customer;
  }
  if (object?.customer && typeof object.customer.id === "string") {
    return object.customer.id;
  }
  return undefined;
}

function randomHex(size: number): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return hex(bytes);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encode(value));
  return hex(new Uint8Array(digest));
}

function encode(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let result = 0;
  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return result === 0;
}
