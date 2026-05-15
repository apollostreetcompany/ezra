import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildServer } from "../apps/server/src/server.js";
import { InMemorySyncStore } from "../apps/server/src/services/sync.js";

const requireFromServer = createRequire(new URL("../apps/server/package.json", import.meta.url));
const Stripe = requireFromServer("stripe");

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY.");
}

const stripe = new Stripe(secretKey);
const lookupKey = process.env.STRIPE_PRICE_LOOKUP_KEY || "bible_coder_premium_monthly";
const unitAmount = Number.parseInt(process.env.STRIPE_PREMIUM_MONTHLY_CENTS ?? "1000", 10);
const currency = process.env.STRIPE_PREMIUM_CURRENCY || "usd";

const account = await stripe.accounts.retrieve();
const price = await ensurePrice();
if (process.env.UPDATE_ENV_LOCAL === "true") {
  updateEnvLocal("STRIPE_PRICE_PREMIUM_MONTHLY", price.id);
}

const store = new InMemorySyncStore();
const app = await buildServer({
  store,
  tokenPepper: process.env.TOKEN_HASH_PEPPER ?? "local-stripe-smoke-token-pepper",
  env: {
    ...process.env,
    STRIPE_PRICE_PREMIUM_MONTHLY: price.id,
    STRIPE_ALLOW_PROMOTION_CODES: process.env.STRIPE_ALLOW_PROMOTION_CODES ?? "true",
    STRIPE_AUTOMATIC_TAX_ENABLED: process.env.STRIPE_AUTOMATIC_TAX_ENABLED ?? "false"
  },
  now: () => new Date().toISOString()
});

try {
  const issued = await app.inject({
    method: "POST",
    url: "/v1/device-tokens",
    payload: { deviceName: "live-stripe-smoke" }
  });
  if (issued.statusCode !== 201) {
    throw new Error(`Device token issue failed with status ${issued.statusCode}`);
  }
  const device = issued.json() as { token: string };
  const checkout = await app.inject({
    method: "POST",
    url: "/v1/checkout/session",
    headers: { authorization: `Bearer ${device.token}` },
    payload: {
      successUrl: "https://bible-coder.local/checkout/success",
      cancelUrl: "https://bible-coder.local/checkout/cancel"
    }
  });
  const checkoutBody = checkout.json() as { id?: string; url?: string };
  const summary = {
    chargesEnabled: account.charges_enabled,
    priceId: price.id,
    lookupKey,
    unitAmount: price.unit_amount,
    currency: price.currency,
    checkoutStatus: checkout.statusCode,
    checkoutUrlPresent: Boolean(checkoutBody.url)
  };
  if (checkout.statusCode !== 201 || !checkoutBody.id || !checkoutBody.url) {
    throw new Error(`Stripe Checkout smoke failed: ${JSON.stringify(summary)}`);
  }
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await app.close();
}

async function ensurePrice(): Promise<{ id: string; unit_amount: number | null; currency: string }> {
  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  if (existing.data[0]) {
    return existing.data[0];
  }
  const product = await stripe.products.create({
    name: "Bible Coder Premium",
    description: "Premium Bible Coder subscription with sync, Stripe entitlement plumbing, Prayer Gate, and licensed API.Bible access after approval.",
    metadata: { app: "bible-coder" }
  }, {
    idempotencyKey: "bible_coder_premium_product"
  });
  return await stripe.prices.create({
    product: product.id,
    unit_amount: unitAmount,
    currency,
    recurring: { interval: "month" },
    lookup_key: lookupKey,
    metadata: { app: "bible-coder", plan: "premium_monthly" }
  }, {
    idempotencyKey: `bible_coder_price_${lookupKey}_${unitAmount}_${currency}`
  });
}

function updateEnvLocal(key: string, value: string): void {
  const path = fileURLToPath(new URL("../.env.local", import.meta.url));
  const current = existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];
  let replaced = false;
  const next = current
    .filter((line) => line.length > 0)
    .map((line) => {
      if (line.startsWith(`${key}=`)) {
        replaced = true;
        return `${key}=${value}`;
      }
      return line;
    });
  if (!replaced) {
    next.push(`${key}=${value}`);
  }
  writeFileSync(path, `${next.join("\n")}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}
