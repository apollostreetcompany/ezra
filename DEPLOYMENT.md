# DEPLOYMENT.md - Ezra MCP

## Current Deployment Assumptions
- Production target: Cloudflare Worker at `https://ezramcp.com`.
- Worker serves both API/MCP routes and static site assets.
- API routes: `/health`, `/v1/*`.
- MCP endpoint: `POST /v1/mcp`.
- Static site build output: `apps/site/dist`.
- Database: Cloudflare D1, database name `ezra-mcp-prod`.
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
Remote deployment is blocked until a distinct D1 id is configured.

1. Create D1:
   ```bash
   wrangler d1 create ezra-mcp-prod
   ```
2. Replace `REPLACE_WITH_EZRA_MCP_PROD_D1_ID` in `apps/worker/wrangler.jsonc`.
3. Apply migrations:
   ```bash
   cd apps/worker
   wrangler d1 migrations apply ezra-mcp-prod --remote
   ```
4. Load seed SQL:
   ```bash
   wrangler d1 execute ezra-mcp-prod --file=seed.sql --remote
   ```
5. Deploy:
   ```bash
   pnpm --filter @ezra-mcp/site build
   pnpm --filter @ezra-mcp/worker deploy
   ```

If D1 rejects the single seed file, split it by table or chunked statement groups before retrying.

Current seed builder behavior:
- Requires `bible_verses.json`, `bible_topics.json`, `bible_pericopes.json`, and `web_text.json`.
- Excludes refs with no WEB text instead of writing empty verse rows.
- Current excluded refs from local data: `Psalms 114:9`, `Psalms 114:10`, `Psalms 137:10`.

## Cloudflare Static Assets
Worker static assets are configured from `apps/worker/wrangler.jsonc`:
- `assets.directory = ../site/dist`
- `assets.binding = ASSETS`
- `assets.run_worker_first = ["/v1/*", "/health"]`

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
