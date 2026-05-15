# DEPLOYMENT.md - Bible Coder

## Current Deployment Assumptions
- Production API target: Cloudflare Worker at `https://bibecoder-api.ryan-borker.workers.dev` until the Cloudflare API token has zone route permission for `api.bibecoder.com`.
- Production site target: Cloudflare Pages at `https://bibecoder.pages.dev`; custom domain `bibecoder.com` is active on Pages.
- Production database target: Cloudflare D1.
- Fastify server target: local contract tests and optional legacy Render experiments.
- Runtime: Cloudflare Workers for production, Node.js service for local Fastify.
- Local CLI runtime: Node 22+, including built-in SQLite support for `~/.config/bible-coder/state.sqlite`.
- Fastify service bind requirement: `0.0.0.0:$PORT`.
- Package manager: pnpm.
- Worker build command: `pnpm --filter @bible-coder/worker build`.
- Worker deploy command: `pnpm --filter @bible-coder/worker deploy`.
- Site build command: `pnpm --filter @bible-coder/site build`.
- Site deploy command: `wrangler pages deploy apps/site/dist --project-name bibecoder --commit-dirty=true`.
- Fastify server build command: `pnpm --filter @bible-coder/server build`.
- Fastify server start command: `node apps/server/dist/server.js`.
- Health endpoint: `/health`.

## Required Environment Variables
- `DATABASE_URL`
- `API_BIBLE_KEY`
- `API_BIBLE_BASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `BIBLE_CODER_API_URL`
- `BIBLE_CODER_TOKEN`
- `STRIPE_PRICE_PREMIUM_MONTHLY`
- `STRIPE_ALLOW_PROMOTION_CODES`
- `STRIPE_AUTOMATIC_TAX_ENABLED`
- `STRIPE_TRIAL_PERIOD_DAYS`
- `TOKEN_HASH_PEPPER`
- `FUMS_USER_HASH_SECRET`
- `BIBLE_CODER_ENABLE_PREMIUM_API_BIBLE`
- `BIBLE_CODER_CACHE_MODE`
- `BIBLE_CODER_CACHE_TTL_DAYS`
- `BIBLE_CODER_ALLOWED_PREMIUM_BIBLES`
- `KLAVIYO_PRIVATE_API_KEY`
- `KLAVIYO_REVISION`

Defaults:
- `API_BIBLE_BASE_URL=https://rest.api.bible/v1`
- `BIBLE_CODER_ENABLE_PREMIUM_API_BIBLE=false`
- `STRIPE_ALLOW_PROMOTION_CODES=true`
- `STRIPE_AUTOMATIC_TAX_ENABLED=false`
- `BIBLE_CODER_CACHE_MODE=metadata-only`
- `BIBLE_CODER_CACHE_TTL_DAYS=14` only after API.Bible written approval for content caching.
- `KLAVIYO_REVISION=2026-04-15`

Cloudflare Worker production also requires:

- D1 binding: `DB`
- Route: `api.bibecoder.com/*` after the Cloudflare token includes Workers Routes permission for the `bibecoder.com` zone.
- Secrets set with Wrangler or the Cloudflare dashboard, never committed.
- `BIBLE_CODER_ALLOWED_PREMIUM_BIBLES` empty until API.Bible confirms commercial licensing in writing.
- `KLAVIYO_PRIVATE_API_KEY` optional; lifecycle email events are skipped until set.

## Local CLI Run Path
- Build and view CLI help: `make cli-help`.
- Smoke local WEB read: `make cli-read`.
- Check ambient client hook status: `make cli-hooks-doctor`.
- Local config override for tests or isolated runs: `BIBLE_CODER_CONFIG_DIR=/tmp/bible-coder bible-coder ...`.
- Local auth file: `~/.config/bible-coder/auth.json`, mode `0600`.
- Local state DB: `~/.config/bible-coder/state.sqlite`, mode `0600`.
- Ambient coda hook configs are installed explicitly by `bible-coder setup` or `bible-coder hooks install --client all --scope user --mode coda --yes`; the hook adapter emits JSON `systemMessage` and does not use model-visible `additionalContext`.
- Server sync, Stripe Checkout, API.Bible proxying, and Prayer Gate hook mutation have local contract coverage.
- Prayer Gate enablement checks cached premium entitlement via `BIBLE_CODER_PREMIUM`, `BIBLE_CODER_ENTITLEMENT`, or `BIBLE_CODER_PREMIUM_GRACE_UNTIL` until normal entitlement sync refresh is wired into the CLI.
- Live API.Bible smoke path: create ignored `.env.local` with `API_BIBLE_KEY`, `BIBLE_CODER_ALLOWED_PREMIUM_BIBLES`, `FUMS_USER_HASH_SECRET`, and run `make live-api-bible-smoke`.

## Cloudflare Worker Run Path
- Build/lint Worker: `pnpm --filter @bible-coder/worker lint`.
- Local Worker dev: `pnpm --filter @bible-coder/worker dev`.
- Create production D1 DB: `wrangler d1 create bibecoder-prod`.
- Apply migrations: `wrangler d1 migrations apply bibecoder-prod --remote`.
- Deploy: `pnpm --filter @bible-coder/worker deploy`.
- Custom domain route: add `api.bibecoder.com/*` back to `apps/worker/wrangler.jsonc` after the API token can edit Workers routes for the zone.
- Current deployed Worker version: `ae8769e2-694b-467b-ba72-899cee766309`.
- Remote D1 write privilege: confirmed with a harmless `audit_log` insert on 2026-05-15.
- Current Stripe webhook target: `https://bibecoder-api.ryan-borker.workers.dev/v1/stripe/webhook` until `api.bibecoder.com` route permission is fixed.

Set required secrets before first deploy:

```bash
cd apps/worker
wrangler secret put API_BIBLE_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put STRIPE_PRICE_PREMIUM_MONTHLY
wrangler secret put TOKEN_HASH_PEPPER
wrangler secret put FUMS_USER_HASH_SECRET
wrangler secret put KLAVIYO_PRIVATE_API_KEY
```

## Cloudflare Pages Run Path
- Build site: `pnpm --filter @bible-coder/site build`.
- Deployed project: `bibecoder`.
- Current Pages URL: `https://bibecoder.pages.dev`.
- Current production deployment URL: `https://fdd7550f.bibecoder.pages.dev`.
- Latest preview deployment URL: `https://dc9f7046.bibecoder.pages.dev`.
- Custom domain: `bibecoder.com`, active on Cloudflare Pages.
- DNS state as of 2026-05-15: dashboard DNS shows `CNAME bibecoder.com -> bibecoder.pages.dev` with Cloudflare proxy enabled. Public resolvers return Cloudflare edge A records for `bibecoder.com`; an edge-forced HTTPS smoke returned HTTP 200. The Pages domains API reports `status: active` with `verification_data.status: active`. Local resolver cache may still need time to catch up on machines that recently saw the missing-record state.
- Rollback: use Cloudflare Pages deployment rollback to the previous successful deployment.

## Deploy Preflight
Before deploy-affecting beads are marked complete:
1. Run `make release-check`.
2. Confirm lockfile matches manifests.
3. Confirm server binds `0.0.0.0:$PORT`.
4. Confirm health endpoint responds.
5. Record smoke URL check.
6. Record rollback path.

## Rollback Path
- Cloudflare Worker rollback: use Cloudflare Workers deployment rollback to the previous successful version.
- D1 rollback: use D1 time-travel backup/restore if a migration corrupts production data.
- Render rollback applies only if the optional Fastify service is deployed.
