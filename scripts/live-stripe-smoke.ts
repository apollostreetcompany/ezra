const secretKey = process.env.STRIPE_SECRET_KEY;
const proPrice = process.env.STRIPE_PRICE_EZRA_PRO_MONTHLY;
const maxPrice = process.env.STRIPE_PRICE_EZRA_MAX_MONTHLY;

if (!secretKey) {
  throw new Error("Missing STRIPE_SECRET_KEY.");
}
if (!proPrice || !maxPrice) {
  throw new Error("Missing STRIPE_PRICE_EZRA_PRO_MONTHLY or STRIPE_PRICE_EZRA_MAX_MONTHLY.");
}

const [account, pro, max] = await Promise.all([
  stripeGet<{ charges_enabled?: boolean }>("/v1/account"),
  stripeGet<{ id: string; active: boolean; unit_amount: number | null; currency: string; recurring?: { interval?: string } }>(`/v1/prices/${encodeURIComponent(proPrice)}`),
  stripeGet<{ id: string; active: boolean; unit_amount: number | null; currency: string; recurring?: { interval?: string } }>(`/v1/prices/${encodeURIComponent(maxPrice)}`)
]);

const summary = {
  chargesEnabled: Boolean(account.charges_enabled),
  pro: publicPriceSummary(pro),
  max: publicPriceSummary(max)
};

if (!pro.active || pro.unit_amount !== 2000 || pro.currency !== "usd" || pro.recurring?.interval !== "month") {
  throw new Error(`Ezra Pro price is not configured as $20/month USD: ${JSON.stringify(summary.pro)}`);
}
if (!max.active || max.unit_amount !== 10000 || max.currency !== "usd" || max.recurring?.interval !== "month") {
  throw new Error(`Ezra Max price is not configured as $100/month USD: ${JSON.stringify(summary.max)}`);
}

console.log(JSON.stringify(summary, null, 2));

async function stripeGet<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.stripe.com${path}`, {
    headers: { authorization: `Bearer ${secretKey}` }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Stripe request failed for ${path}: ${response.status}`);
  }
  return body as T;
}

function publicPriceSummary(price: { id: string; active: boolean; unit_amount: number | null; currency: string; recurring?: { interval?: string } }) {
  return {
    idPrefix: price.id.slice(0, 12),
    active: price.active,
    unitAmount: price.unit_amount,
    currency: price.currency,
    interval: price.recurring?.interval ?? null
  };
}
