# CONTINUITY.md - Ezra MCP

## Goal (incl. success criteria)
Build Ezra MCP as a separate hosted Cloudflare Worker MCP product plus Codex plugin. V1 is successful when users can visit `https://ezramcp.com`, request a magic link, create an `ezra_live_...` API key, configure any MCP client, call the 8 Bible lookup/teaching tools, upgrade to Pro/Max through Stripe, manage billing, and install the repo-local Codex plugin/CLI bridge without any Bibe/Bible Coder branding or local Bible-goal surfaces.

## Constraints/Assumptions
- Repo path: `/Users/kikimac/ezra-mcp`.
- Separate data repo: `/Users/kikimac/ezra-bible-data`.
- Graphify is out of scope; D1 inverted indexes are the v1 query path.
- GitHub remote `origin`: `https://github.com/apollostreetcompany/ezra.git`.
- Production Worker is deployed; `ezramcp.com` is attached as a Worker custom domain and route, and normal DNS smoke passes from this Mac.
- Current branch: `codex/feat/ezra-full-plugin-launch`.
- Bead 29 risk class: High because it adds a public MCP tool contract, though it does not change schema, auth, billing, or deployment config.

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
12. Confirmed Cloudflare D1 database `ezra-mcp-prod` id: `13f487c0-02fc-44da-814c-252925bb59da`.
13. Stripe live prices were created: Pro `price_1TXZF0G0PuTic3weMLi26vTU`, Max `price_1TXZF0G0PuTic3weRYdzZTBh`.
14. D1 pericopes use `(name, verse_range)` as the primary key because canonical pericope names can repeat across multiple ranges.
15. `get_pericope` aggregates all ranges for a repeated name and returns top-level combined `verse_refs`, `topics`, `verses`, plus per-range `segments`.
16. Worker deployment version `a7071023-096d-421f-81ad-c9643026e61a` is live on `https://ezra-mcp-api.ryan-borker.workers.dev` and attached to `ezramcp.com`.
17. Bead 27 landing copy must stay user-facing: every visible landing-page line is either a benefit or a how-to, with no process/meta language about the project itself.
18. Worker deployment version `d486f56e-efeb-4714-b184-455e06946b72` serves the refreshed landing assets with the Ezra portrait header, social preview, and favicon.
19. Local account E2E validation uses isolated local D1 persistence under `/tmp/ezra-mcp-local-e2e` and does not touch production D1 or production secrets.
20. Local Wrangler 4.87.0 cannot run the configured Worker compatibility date `2026-05-15`; use Wrangler 4.92.0+ for exact local runtime parity, or a local-only `--compatibility-date 2026-05-07` override for account/MCP smoke tests.
21. Real prompts asking for Jesus' beliefs, commands, or both are handled by the public `get_jesus_teachings(mode)` MCP tool. The response is intentionally labeled as a curated Gospel-grounded starter set, not an exhaustive list of every saying of Jesus.

## State

### Done
- [x] Initial Ezra Worker HTTP MCP surface started with 7 lookup tools.
- [x] Static site exists for landing, pro, MCP docs, privacy, and terms.
- [x] Seed SQL and ignored data inputs exist locally under `apps/worker/`.
- [x] RepoPrompt code map built for current implementation pass.
- [x] Branch `codex/feat/ezra-full-plugin-launch` created from `main`.
- [x] Bead 1 implementation completed: Ezra plugin, CLI, MCP bridge, Worker checkout/account APIs, Worker static assets config, site checkout/account pages, docs, and validation scripts.
- [x] Automated validation passed: `pnpm build`, `pnpm lint`, `pnpm test`, `make verify`, `make release-check`, `pnpm secret:scan`, Worker seed build.
- [x] Remote origin configured as `https://github.com/apollostreetcompany/ezra.git`.
- [x] Browser visual evidence captured under `docs/visual-evidence/` for landing, Pro, account, MCP docs, checkout success, and pricing at 390px/768px/1280px.
- [x] Mobile MCP docs overflow fixed after browser screenshot review.
- [x] Distinct Cloudflare D1 database created, migrations applied through `0005_pericope_ranges.sql`, and seed loaded: 386 topics, 23,396 verses, 709 pericope ranges.
- [x] Stripe Pro/Max products and prices created; Worker Stripe/Klaviyo/token secrets uploaded without printing secret values.
- [x] Worker deployed with static assets and custom domain attachment.
- [x] Production smoke passed on `workers.dev`: health, static home, unauthenticated MCP error, authenticated `get_verse` against D1, and public Pro checkout.
- [x] Root-domain smoke passed with forced DNS resolution: health, static home, unauthenticated MCP error, and public Max checkout.
- [x] Bead 27 landing refresh deployed: Bibe-style header rhythm, supplied Ezra portrait, benefit/how-to copy, social preview, favicon, local Browser evidence at 390px/768px/1280px, and normal `ezramcp.com` smoke checks.
- [x] Bead 28 local E2E passed: local Worker/D1 health and static site, magic-link account creation, session token issuance, API key creation, account status, MCP `tools/list`, MCP `get_verse`, free usage increment, CLI private token/key storage, and stdio MCP bridge lookup.
- [x] Bead 29 implemented and deployed: `get_jesus_teachings(mode)` returns Jesus' beliefs, commands, or both as a curated Gospel-grounded starter set; Worker docs/site/plugin references now describe the 8-tool surface; Worker version `fed55162-cdb9-4f0a-a338-38feb2d22446` is live.

### Now
- Bead 29 finalization: commit and push the deployed Jesus teachings tool changes.

### Next
- Add optional `www.ezramcp.com` route/DNS later if desired.
- Run an authenticated production `get_jesus_teachings` smoke once a production API key is available in the shell or a controlled inbox login is completed.
- Run a live account magic-link test with a real inbox before public announcement.

## Open Questions
- UNCONFIRMED: Whether Klaviyo events are landing in the intended production list/flow.
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
- Local E2E persistence: `/tmp/ezra-mcp-local-e2e`
- Local CLI E2E config: `/tmp/ezra-mcp-cli-e2e-config`
