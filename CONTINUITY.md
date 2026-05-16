# CONTINUITY.md - Ezra MCP

## Goal (incl. success criteria)
Build Ezra MCP as a separate hosted Cloudflare Worker MCP product plus Codex plugin. V1 is successful when users can visit `https://ezramcp.com`, request a magic link, create an `ezra_live_...` API key, configure any MCP client, call the 7 Bible lookup tools, upgrade to Pro/Max through Stripe, manage billing, and install the repo-local Codex plugin/CLI bridge without any Bibe/Bible Coder branding or local Bible-goal surfaces.

## Constraints/Assumptions
- Repo path: `/Users/kikimac/ezra-mcp`.
- Separate data repo: `/Users/kikimac/ezra-bible-data`.
- Graphify is out of scope; D1 inverted indexes are the v1 query path.
- No remote is configured yet; do not push until the user adds one.
- No remote deploy, seed, or Stripe webhook cutover until `ezra-mcp-prod` has a distinct D1 database id and Stripe price ids are configured.
- Current branch: `codex/feat/ezra-full-plugin-launch`.
- Bead 1 risk class: High because it touches plugin packaging, CLI/MCP bridge, public Worker APIs, auth, billing, deployment config, and launch pages.

## Key Decisions
1. Ezra MCP is a separate product from Bible Coder/Bibe Code; old Bibe files are process input only.
2. V1 ships as a full Codex plugin plus hosted HTTP MCP endpoint.
3. The production API/site target is a single Cloudflare Worker at `ezramcp.com`, using Worker static assets for site files and Worker-first routing for `/v1/*` plus `/health`.
4. The active local CLI is `ezra-mcp`; it saves session/API keys privately under `EZRA_MCP_CONFIG_DIR` or `~/.config/ezra-mcp`.
5. The active local MCP bridge is `ezra-mcp-mcp`; it forwards JSON-RPC to the hosted `/v1/mcp` endpoint with `EZRA_MCP_API_KEY` or the saved API key.
6. D1 data tables (`topics`, `verses`, `pericopes`) remain the canonical lookup store; Vectorize is deferred until natural-language search demand exists.
7. Free, Pro, and Max tiers map to 20, 10,000, and 100,000 metered `tools/call` requests per UTC month.
8. Magic-link request reuses an existing normalized-email user where possible to connect public checkout, account login, and later API keys.
9. Public checkout supports Pro and Max; checkout success can verify Stripe session status and repair entitlement if the webhook is delayed.
10. The inherited Bible Coder D1 database id must not be used for Ezra deployment.
11. Seed generation excludes catalog refs with no WEB text instead of writing empty verse text. Current excluded refs: `Psalms 114:9`, `Psalms 114:10`, and `Psalms 137:10`.

## State

### Done
- [x] Initial Ezra Worker HTTP MCP surface exists with 7 lookup tools.
- [x] Static site exists for landing, pro, MCP docs, privacy, and terms.
- [x] Seed SQL and ignored data inputs exist locally under `apps/worker/`.
- [x] RepoPrompt code map built for current implementation pass.
- [x] Branch `codex/feat/ezra-full-plugin-launch` created from `main`.
- [x] Bead 1 implementation completed: Ezra plugin, CLI, MCP bridge, Worker checkout/account APIs, Worker static assets config, site checkout/account pages, docs, and validation scripts.
- [x] Automated validation passed: `pnpm build`, `pnpm lint`, `pnpm test`, `make verify`, `make release-check`, `pnpm secret:scan`, Worker seed build.

### Now
- Bead 1 is ready for review with concerns: browser visual testing at 390px/768px/1280px is still pending because no Browser tool or Playwright runtime is available in this session.

### Next
- Capture browser visual evidence for `/`, `/pro/`, `/account/`, `/checkout/success/`, and `/mcp/` at 390px, 768px, and 1280px before launch.
- Create a distinct Cloudflare D1 database for `ezra-mcp-prod` and update `apps/worker/wrangler.jsonc`.
- Create Stripe products/prices for Ezra Pro Monthly and Ezra Max Monthly and upload Worker secrets.
- Point `ezramcp.com` at the Worker and configure Stripe webhook target `https://ezramcp.com/v1/stripe/webhook`.

## Open Questions
- UNCONFIRMED: Final GitHub remote URL.
- UNCONFIRMED: Distinct Cloudflare D1 database id for `ezra-mcp-prod`.
- UNCONFIRMED: Stripe price ids for Ezra Pro and Ezra Max.
- UNCONFIRMED: Whether Klaviyo should be enabled for launch or kept skipped.
- UNCONFIRMED: Whether the three missing-text source refs should be repaired upstream in `/Users/kikimac/ezra-bible-data` or intentionally excluded from v1 seed output.

## Working Set
- `AGENTS.md`
- `CONTINUITY.md`
- `HANDOFF.md`
- `MISTAKES.md`
- `DEPLOYMENT.md`
- `Makefile`
- `.agents/plugins/marketplace.json`
- `plugins/ezra-mcp/`
- `packages/cli/`
- `packages/mcp/`
- `apps/worker/src/index.ts`
- `apps/worker/src/mcp/`
- `apps/worker/migrations/`
- `apps/worker/wrangler.jsonc`
- `apps/site/src/`
- `scripts/validate-docs.sh`
- `scripts/validate-plugin.mjs`
- `scripts/link-local-bin.sh`
- `handoff/beads.jsonl`
