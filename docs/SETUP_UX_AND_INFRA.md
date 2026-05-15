# Bibe Code Setup UX And Cloudflare Infra

## CLI UX Decision

The first-run command is `bible-coder`, which opens a setup wizard branded as:

```text
Bibe Code
Stop Vibe Coding. Start Bibe Coding.
```

Keep the pnpm-installed package exposing the `bible-coder` binary for clarity, even if the user-facing brand is Bibe Code and the domain is `bibecoder.com`. If the unscoped package name `bible-coder` is unavailable at publish time, use `@bibecoder/cli` while preserving the installed binary name `bible-coder`.

## UX Delta From The Earlier Plan

- Local setup now works without asking for a path. It defaults to bundled WEB/KJV, then accepts an optional local Bible folder for common import formats later.
- Cloud setup is the paid path and expects `BIBLE_CODER_API_URL` to point to the Cloudflare Worker API, not a local Fastify server.
- Cloud Bible selection is loaded from `/v1/bibles`, which must return only allowed API.Bible IDs after licensing approval.
- Cloud login now runs before premium Bible catalog selection and stores an opaque sync token privately.
- Goal setup is captured during first run and stored locally as a reference-first plan. Goals are free and exposed through `bible-coder goal`, `bible-coder goal update --goal "..."`, `goal_status`, and `goal_update`.
- Ambient goal display is now represented by `bible-coder hooks run --client <client> --event <event> --mode coda --record`, installed through `bible-coder setup` or `bible-coder hooks install --client all --scope user --mode coda --yes`. Hooks emit `systemMessage` JSON so the coda is human-visible without becoming model-visible context.
- Premium prompt blocking is saved as a preference and verified with `bible-coder block doctor`; automatic prompt-hook mutation should require explicit confirmation per client.

## Cloudflare Runtime

The Cloudflare API lives in `apps/worker`. It currently deploys to `https://bibecoder-api.ryan-borker.workers.dev`, then should be routed to `api.bibecoder.com` once the Cloudflare API token has Workers Routes permission for the `bibecoder.com` zone.

Primary Worker responsibilities:

- Issue opaque sync tokens from `/v1/device-tokens`.
- Support magic-link request/verify endpoints.
- List only allowed premium Bible versions at `/v1/bibles`.
- Proxy paid API.Bible passages from `/v1/passages` with model-visible redaction by default.
- Create Stripe Checkout Sessions from `/v1/checkout/session`.
- Verify Stripe webhook signatures at `/v1/stripe/webhook`.
- Create Stripe Billing Portal Sessions from `/v1/billing/portal`.
- Accept support-routed refund requests from `/v1/refunds/request`.
- Emit optional Klaviyo lifecycle events when `KLAVIYO_PRIVATE_API_KEY` is configured.

Cloudflare D1 is the v1 data store because it is the simplest single-vendor path for Workers. The existing Fastify server remains useful for local contract tests and earlier implementation evidence, but production CLI traffic should target Cloudflare.

## Required Cloudflare Secrets

Set these with Wrangler or the Cloudflare dashboard, never in committed files:

- `API_BIBLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_PREMIUM_MONTHLY`
- `TOKEN_HASH_PEPPER`
- `FUMS_USER_HASH_SECRET`
- `KLAVIYO_PRIVATE_API_KEY` for lifecycle email events.

`BIBLE_CODER_ALLOWED_PREMIUM_BIBLES` must stay empty until API.Bible confirms commercial licensing for the exact translations. An empty value returns no premium catalog from `/v1/bibles`.

## Validation

```bash
pnpm --filter @bible-coder/cli test
pnpm --filter @bible-coder/worker lint
pnpm --filter @bible-coder/worker test
```
