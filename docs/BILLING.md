# Billing

Bible Coder premium is planned as a `$10/month` Stripe subscription.

## Checkout Flow
1. CLI creates or refreshes a device token.
2. CLI calls `/v1/checkout/session`.
3. Server creates a Stripe Checkout Session using `STRIPE_PRICE_PREMIUM_MONTHLY`.
4. CLI opens or prints the Checkout URL.
5. Stripe webhook verifies raw body signature.
6. Webhook idempotently records event ID.
7. Webhook activates entitlement.
8. CLI polls `sync_status` until entitlement is active.

Bead 8 implementation status:
- CLI `bible-coder checkout` calls `/v1/checkout/session` when `BIBLE_CODER_API_URL` and `BIBLE_CODER_TOKEN` are set; otherwise it prints the required configuration.
- Server route `/v1/checkout/session` creates a subscription Checkout Session with `client_reference_id`, `metadata.user_id`, `metadata.device_id`, and subscription metadata.
- Server route `/v1/stripe/webhook` verifies Stripe signatures against the raw request body before processing.
- Server route `/v1/billing/portal` creates Stripe Billing Portal sessions for linked customers.
- Webhook event IDs are processed idempotently.
- Checkout Session creation uses a server-side idempotency key per user and price.
- Promotion codes are enabled by default and can be disabled with `STRIPE_ALLOW_PROMOTION_CODES=false`.
- Stripe automatic tax is off by default until tax registrations are confirmed; enable with `STRIPE_AUTOMATIC_TAX_ENABLED=true`.
- Optional trials can be configured with `STRIPE_TRIAL_PERIOD_DAYS`.

## Entitlement States
- `active`: full paid access.
- `trialing`: full paid access if enabled.
- `past_due`: grace period; no new premium API.Bible fetch after grace.
- `canceled`: free only after period end.
- `unpaid`: free only.
- `incomplete`: no paid access.

Do not model `$9.41` as final net revenue. It is card-fee-only net before tax, Stripe Billing, disputes, currency conversion, refunds, and API.Bible/license cost.

## Stripe References
- Checkout Sessions support `client_reference_id`, metadata, and subscription mode: <https://docs.stripe.com/api/checkout/sessions/create>
- Stripe webhook signature verification requires the raw request body: <https://docs.stripe.com/webhooks/signature>
- Billing Portal sessions provide a Stripe-hosted subscription management URL: <https://docs.stripe.com/api/customer_portal/sessions/create>
