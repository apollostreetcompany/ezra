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

Bead 25 was committed locally as `32c6ebbdd903745ca2bd91fbf2f6eecc3c18f1ed`.

Bead 26 is in finalization:
- Removed active inherited surfaces and replaced the plugin path with `plugins/ezra-mcp`.
- Rewrote CLI and stdio MCP bridge as Ezra account/key helpers.
- Added public checkout, checkout status verification, and account status Worker endpoints.
- Added checkout/account site pages.
- Added Worker static assets config for `apps/site/dist` with Worker-first `/v1/*` and `/health`.
- Updated validation and deployment docs.
- Added Browser evidence under `docs/visual-evidence/` at 390px, 768px, and 1280px.
- Fixed mobile MCP docs overflow found in screenshots.
- Created distinct D1 `ezra-mcp-prod` id `13f487c0-02fc-44da-814c-252925bb59da`.
- Created live Stripe prices: Pro `price_1TXZF0G0PuTic3weMLi26vTU`, Max `price_1TXZF0G0PuTic3weRYdzZTBh`.
- Created Stripe webhook endpoint for `https://ezramcp.com/v1/stripe/webhook`.
- Uploaded Worker secrets without printing secret values.
- Applied D1 migrations through `0005_pericope_ranges.sql` and loaded seed data.
- Deployed Worker/static assets. Current version: `a7071023-096d-421f-81ad-c9643026e61a`.

Validation passed:
- `pnpm verify`
- `pnpm --filter @ezra-mcp/worker seed:build`
- remote D1 count check: 386 topics, 23,396 verses, 709 pericope ranges
- live Worker smoke: health, home, unauthenticated MCP, authenticated `get_verse`, and public checkout
- root-domain forced-resolution smoke: health, home, unauthenticated MCP, and public checkout

Known concern:
- Seed generation skipped `Psalms 114:9`, `Psalms 114:10`, and `Psalms 137:10` because those refs have no WEB text in local seed inputs.
- This Mac's system resolver still cached the earlier NXDOMAIN for `ezramcp.com` after custom-domain creation. `dig` returns Cloudflare A/AAAA records, and `curl --resolve` reaches the Worker. Recheck normal `curl https://ezramcp.com/health` after local resolver cache catches up.
- `www.ezramcp.com` is not configured yet.

## Important Constraints
- Remote origin: `https://github.com/apollostreetcompany/ezra.git`.
- Do not print secrets or saved tokens during validation.
- Do not add graphify to v1.
- Keep `main` deployable and do not commit directly to `main`.

## Next Engineer Notes
Start with `pnpm verify`. If it fails, prioritize full workspace package consistency before feature polish.

Before launch:
- Recheck normal DNS from a fresh resolver: `curl https://ezramcp.com/health`.
- Run a real magic-link account test with a controlled inbox.
- Optionally add `www.ezramcp.com` after DNS/route permissions are confirmed.
