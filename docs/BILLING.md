# Ezra MCP Billing

Ezra MCP has three tiers:

| Tier | Price | Monthly `tools/call` limit |
| --- | ---: | ---: |
| Free | $0 | 20 |
| Pro | $20/month | 10,000 |
| Max | $100/month | 100,000 |

## Public Checkout

The site starts checkout without an existing session:

```http
POST /v1/checkout/public-session
Content-Type: application/json

{
  "email": "reader@example.com",
  "tier": "pro"
}
```

The Worker normalizes the email, reuses an existing user when present, creates a Stripe Checkout Session, and stores `metadata.user_id`, `metadata.tier`, `metadata.site`, and `metadata.source`.

## Authenticated Checkout

CLI/account checkout uses:

```http
POST /v1/checkout/session
Authorization: Bearer <session-token>
```

This path uses the same Stripe prices and same entitlement metadata as public checkout.

## Success Verification

Stripe webhooks remain the source of truth, but the success page repairs delayed webhook state:

```http
GET /v1/checkout/session-status?session_id=cs_test_...
```

If Stripe reports a complete session with Ezra metadata, the Worker links the Stripe customer and activates the Pro or Max entitlement.

## Account and Portal

```http
GET /v1/account/status
POST /v1/billing/portal
```

`/v1/account/status` returns tier, usage, entitlement state, and the latest API key prefix. `/v1/billing/portal` creates a short-lived Stripe Billing Portal URL for the linked customer.

## Launch Blockers

Remote checkout is blocked until:

- `STRIPE_PRICE_EZRA_PRO_MONTHLY` points to Ezra Pro Monthly at $20/month.
- `STRIPE_PRICE_EZRA_MAX_MONTHLY` points to Ezra Max Monthly at $100/month.
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `TOKEN_HASH_PEPPER` are set as Worker secrets.
- Stripe webhook target is `https://ezramcp.com/v1/stripe/webhook`.
