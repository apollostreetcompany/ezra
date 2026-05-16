# DEPLOYMENT.md - Ezra MCP

## Current Deployment Assumptions
- Production target: Cloudflare Worker at `https://ezramcp.com`.
- Worker serves both API/MCP routes and static site assets.
- API routes: `/health`, `/v1/*`.
- MCP endpoint: `POST /v1/mcp`.
- Static site build output: `apps/site/dist`.
- Database: Cloudflare D1, database name `ezra-mcp-prod`.
- D1 id: `13f487c0-02fc-44da-814c-252925bb59da`.
- Current deployed Worker version: `a7071023-096d-421f-81ad-c9643026e61a`.
- Package manager: pnpm.
- Runtime: Node 22+ for local CLI/MCP bridge, Cloudflare Workers for production.

## Required Environment Variables
Worker secrets:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_EZRA_PRO_MONTHLY`
- `STRIPE_PRICE_EZRA_MAX_MONTHLY`
- `TOKEN_HASH_PEPPER`

Worker optional secrets/vars:
- `KLAVIYO_PRIVATE_API_KEY`
- `KLAVIYO_REVISION=2026-04-15`
- `EZRA_MCP_UPGRADE_URL=https://ezramcp.com/pro/`

Local CLI/MCP:
- `EZRA_MCP_API_URL` defaults to `https://ezramcp.com`.
- `EZRA_MCP_SESSION_TOKEN` can override saved login session token.
- `EZRA_MCP_API_KEY` can override saved MCP API key.
- `EZRA_MCP_CONFIG_DIR` can isolate local auth state.

## Local Run Paths
- Install dependencies: `pnpm install`.
- Full verification: `make verify`.
- Build site: `pnpm --filter @ezra-mcp/site build`.
- Build Worker: `pnpm --filter @ezra-mcp/worker build`.
- Run Worker locally: `pnpm --filter @ezra-mcp/worker dev`.
- Link local CLI/MCP bridge: `make link-local`.
- CLI smoke: `make cli-status`.
- MCP bridge smoke: `make mcp-bridge-smoke`.

## Cloudflare Worker Run Path
Production deployment is live. Use this path for redeploys.

1. Confirm D1:
   ```bash
   wrangler d1 list | rg ezra-mcp-prod
   ```
2. Apply migrations:
   ```bash
   cd apps/worker
   wrangler d1 migrations apply DB --remote
   ```
3. Load seed SQL:
   ```bash
   wrangler d1 execute DB --remote --file seed.sql
   ```
4. Deploy:
   ```bash
   pnpm --filter @ezra-mcp/site build
   cd apps/worker
   wrangler deploy --domain ezramcp.com
   ```

Do not source `/Users/kikimac/.hermes/.env` for `wrangler deploy`; that file's Cloudflare API token can upload Worker code but cannot manage routes. The local Wrangler OAuth session has the route/custom-domain permissions.

Current seed builder behavior:
- Requires `bible_verses.json`, `bible_topics.json`, `bible_pericopes.json`, and `web_text.json`.
- Excludes refs with no WEB text instead of writing empty verse rows.
- Does not emit explicit `BEGIN TRANSACTION`/`COMMIT`; remote D1 import rejects raw transaction wrappers.
- Stores repeated pericope names as separate `(name, verse_range)` rows.
- Current excluded refs from local data: `Psalms 114:9`, `Psalms 114:10`, `Psalms 137:10`.

## Cloudflare Static Assets
Worker static assets are configured from `apps/worker/wrangler.jsonc`:
- `assets.directory = ../site/dist`
- `assets.binding = ASSETS`
- `assets.run_worker_first = ["/v1/*", "/health"]`
- route: `ezramcp.com/*`
- custom domain: `ezramcp.com`

`www.ezramcp.com` is not configured in the current Worker file. Add it later only after confirming Cloudflare DNS/route permissions for the `www` hostname.

## Production Smoke Evidence
Captured on 2026-05-16:
- `pnpm verify` passed.
- D1 seed counts: 386 topics, 23,396 verses, 709 pericope ranges.
- Worker deployed version: `a7071023-096d-421f-81ad-c9643026e61a`.
- `https://ezra-mcp-api.ryan-borker.workers.dev/health` returned 200.
- Live authenticated MCP smoke on `workers.dev` returned `John 3:16` with verse text.
- Public Pro checkout smoke on `workers.dev` returned a Stripe Checkout URL.
- `dig` returns Cloudflare A/AAAA records for `ezramcp.com`.
- `curl --resolve ezramcp.com:443:172.67.189.11 https://ezramcp.com/health` returned 200.
- Root-domain static home, unauthenticated MCP, and Max checkout smokes passed with forced DNS resolution.

Local caveat:
- This Mac's `getaddrinfo`/curl resolver still cached the earlier missing-host result for `ezramcp.com` during the smoke window. Public DNS answered correctly via `dig`, and forced edge resolution hit the deployed Worker successfully.

## Visual Evidence
Browser screenshots are stored in `docs/visual-evidence/`:
- Landing: `bead-26-landing-390.png`, `bead-26-landing-768.png`, `bead-26-landing-1280.png`
- Pro: `bead-26-pro-390.png`, `bead-26-pro-768.png`, `bead-26-pro-1280.png`
- Account: `bead-26-account-390.png`, `bead-26-account-768.png`, `bead-26-account-1280.png`
- MCP docs: `bead-26-mcp-390.png`, `bead-26-mcp-768.png`, `bead-26-mcp-1280.png`
- Checkout success: `bead-26-checkout-success-390.png`, `bead-26-checkout-success-768.png`, `bead-26-checkout-success-1280.png`
- Pricing grid: `bead-26-pricing-390.png`, `bead-26-pricing-768.png`, `bead-26-pricing-1280.png`

## Deploy Preflight
Before deploy-affecting beads are marked complete:
1. Run `make verify`.
2. Confirm lockfile matches manifests.
3. Confirm `apps/worker/wrangler.jsonc` uses the real Ezra D1 id, not a Bible Coder id.
4. Confirm required Worker secrets exist.
5. Confirm `/health` responds after deploy.
6. Smoke `POST /v1/mcp` with a real key.
7. Record rollback path.

## Rollback Path
- Worker rollback: use Cloudflare Workers deployment rollback to the previous successful version.
- D1 rollback: use D1 time-travel backup/restore if a migration or seed corrupts production data.
