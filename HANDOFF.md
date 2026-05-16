# HANDOFF.md - Ezra MCP

## Current Context
Ezra MCP lives at `/Users/kikimac/ezra-mcp`. It is being separated from inherited Bible Coder/Bibe Code code into its own hosted HTTP MCP product and Codex plugin.

The product plan:
- Cloudflare Worker hosts both site and API.
- D1 stores WEB verse text plus topic/story/parable indexes.
- `POST /v1/mcp` exposes seven authenticated lookup tools.
- Magic-link login issues a private session token.
- `POST /v1/api-keys` issues an `ezra_live_...` MCP API key.
- Stripe Checkout upgrades users to Pro or Max.
- Codex plugin installs a local `ezra-mcp-mcp` stdio bridge and provides setup skills.

## Implementation State
Current branch: `codex/feat/ezra-full-plugin-launch`.

Bead 1 is in progress:
- Removed active inherited surfaces and replaced the plugin path with `plugins/ezra-mcp`.
- Rewrote CLI and stdio MCP bridge as Ezra account/key helpers.
- Added public checkout, checkout status verification, and account status Worker endpoints.
- Added checkout/account site pages.
- Added Worker static assets config for `apps/site/dist` with Worker-first `/v1/*` and `/health`.
- Updated validation and deployment docs.

Validation passed:
- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `make verify`
- `make release-check`
- `pnpm secret:scan`
- `pnpm --filter @ezra-mcp/worker seed:build`

Known concern:
- Browser visual testing at 390px, 768px, and 1280px still needs to be captured before launch. Browser tooling was not exposed in this session and Playwright is not installed.
- Seed generation skipped `Psalms 114:9`, `Psalms 114:10`, and `Psalms 137:10` because those refs have no WEB text in local seed inputs.

## Important Constraints
- No remote exists yet; do not push.
- Do not deploy or run remote D1 migrations until `apps/worker/wrangler.jsonc` has a distinct Ezra D1 database id.
- Do not print secrets or saved tokens during validation.
- Do not add graphify to v1.
- Keep `main` deployable and do not commit directly to `main`.

## Next Engineer Notes
Start with `make verify`. If it fails, prioritize full workspace package consistency before feature polish.

Before launch:
- Create `ezra-mcp-prod` D1 and update the Wrangler id.
- Create Stripe prices for Pro and Max.
- Upload Worker secrets.
- Browser-test the site at 390px, 768px, and 1280px.
- Configure DNS and Stripe webhook only after local verification passes.
