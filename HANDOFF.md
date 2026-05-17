# HANDOFF.md - Ezra MCP

## Current Context
Ezra MCP's launch checkout lives at `/Users/kikimac/ezra-mcp`. Bead 31 work is isolated in the worktree `/Users/kikimac/ezra-mcp-collections`.

The product plan:
- Cloudflare Worker hosts both site and API.
- D1 stores WEB verse text plus topic/story/parable indexes.
- `POST /v1/mcp` exposes eleven authenticated lookup/teaching/collection tools.
- Magic-link login issues a private session token.
- `POST /v1/api-keys` issues an `ezra_live_...` MCP API key.
- Stripe Checkout upgrades users to Pro or Max.
- Codex plugin installs a local `ezra-mcp-mcp` stdio bridge and provides setup skills.

## Implementation State
Current branch for Bead 31: `codex/feat/bead-31-custom-verse-collections`.

Bead 25 was committed as `32c6ebbdd903745ca2bd91fbf2f6eecc3c18f1ed`.

Bead 26 was committed and pushed as `fb2d9b4`:
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
- Deployed Worker/static assets. Version: `a7071023-096d-421f-81ad-c9643026e61a`.

Bead 27 was committed and pushed as `dc0ee3a`:
- Forked the Bibe Code landing-page rhythm into Ezra without Bibe branding.
- Used `/Users/kikimac/Downloads/ezra.png` as the header art source and generated site assets: `ezra.png`, `ezra-preview.png`, and `ezra-icon.png`.
- Rewrote landing copy so visible page lines are benefits or setup actions, not process/meta language.
- Added Open Graph, Twitter card, favicon, apple-touch-icon, canonical URL, and theme-color metadata.
- Updated site tests/lint to require the Ezra art paths and reject visible landing-page meta copy.
- Captured Browser screenshots for landing top and pricing at 390px, 768px, and 1280px under `docs/visual-evidence/`.
- Deployed Worker/static assets. Version: `d486f56e-efeb-4714-b184-455e06946b72`.

Bead 28 was committed and pushed as `a94cc9f`:
- Created local accounts with throwaway `example.test` emails against isolated local D1 state.
- Verified local Worker health/static site, magic-link dev echo, account session creation, API key creation, account status, MCP `tools/list`, MCP `get_verse`, and Free-tier usage increment.
- Verified the Ezra CLI login/key/status path stores tokens privately and does not print session/API key values.
- Verified the stdio `ezra-mcp-mcp` bridge uses the saved key and returns `John 3:16`.
- Used local-only `/tmp/ezra-mcp-local-e2e` and `/tmp/ezra-mcp-cli-e2e-config`; production D1, production secrets, and live Stripe were not touched.

Bead 29 is in finalization:
- Added `get_jesus_teachings(mode)` so clients can request Jesus' beliefs, commands, or both.
- The response returns a curated Gospel-grounded starter set with summaries, daily-practice prompts, source refs, and hydrated exact source verses where available.
- Updated site docs, Worker MCP docs, plugin lookup skill, and tests to describe the 8-tool surface.
- Deployed Worker/static assets. Version: `fed55162-cdb9-4f0a-a338-38feb2d22446`.

Bead 31 is in finalization:
- Created worktree `/Users/kikimac/ezra-mcp-collections` on `codex/feat/bead-31-custom-verse-collections`.
- Added D1 migration `0006_verse_collections.sql` with `verse_collections` and `verse_collection_tag_index`.
- Added account API routes for collection create/list/get and three MCP tools: `create_verse_collection`, `get_verse_collection`, `find_verse_collections`.
- Collection storage is reference-only: title, metadata, visibility, `bible_version`, `verse_refs`, `api_bible_tags`, and `global_tags`; no pasted verse text is stored.
- Updated account UI, MCP docs, public docs, site tests, Worker tests, and plugin lookup skill for the 11-tool surface.
- Found and fixed a production Worker 1101 issue by awaiting async route handlers inside the top-level `try`, so auth failures become JSON errors.
- Applied the remote D1 migration and redeployed Worker/static assets. Version: `c2ee753a-4a4b-45ee-90a0-42541d76d37a`.

Validation passed:
- `pnpm verify`
- `pnpm --filter @ezra-mcp/worker seed:build`
- remote D1 count check: 386 topics, 23,396 verses, 709 pericope ranges
- live Worker smoke: health, home, unauthenticated MCP, authenticated `get_verse`, and public checkout
- root-domain forced-resolution smoke: health, home, unauthenticated MCP, and public checkout
- Bead 27 validation: `make verify`
- Bead 27 live smoke: normal-DNS `https://ezramcp.com/health`, refreshed home HTML, `ezra-icon.png`, and unauthenticated MCP missing-key response
- Bead 28 validation: local account/API/MCP E2E, local CLI/MCP bridge E2E, `pnpm --filter @ezra-mcp/worker test`, `pnpm --filter @ezra-mcp/cli test`, and `pnpm --filter @ezra-mcp/mcp test`
- Bead 29 validation: `pnpm --filter @ezra-mcp/worker test -- mcp.test.ts`, `pnpm --filter @ezra-mcp/worker test`, `pnpm --filter @ezra-mcp/site test`, `pnpm --filter @ezra-mcp/site lint`, `pnpm validate:docs`, `pnpm secret:scan`, `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm verify`, `make verify`, and `git diff --check`
- Bead 29 live smoke: `https://ezramcp.com/health`, `/mcp/` docs containing `get_jesus_teachings` and "The 8 tools", and unauthenticated `/v1/mcp` missing-key response. Authenticated production new-tool smoke was skipped because this shell had no `EZRA_MCP_API_KEY` or saved production API key.
- Bead 31 validation: TDD failure for collection API/tool contracts before implementation, `pnpm --filter @ezra-mcp/worker test -- mcp.test.ts worker.test.ts`, `pnpm --filter @ezra-mcp/worker test`, `pnpm --filter @ezra-mcp/site test`, `pnpm --filter @ezra-mcp/site lint`, `pnpm --filter @ezra-mcp/worker build`, `pnpm validate:docs`, `pnpm secret:scan`, `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm verify`, `make verify`, local D1 migration apply, browser screenshots at 390px/768px/1280px, remote D1 migration apply, and production deploy.
- Bead 31 live smoke: `https://ezramcp.com/health`, `/account/` collection UI markers, `/mcp/` 11-tool docs markers, remote D1 table check, and unauthenticated `/v1/collections` JSON 401. Authenticated production collection smoke was skipped because this shell had no production account session token.

Known concern:
- Seed generation skipped `Psalms 114:9`, `Psalms 114:10`, and `Psalms 137:10` because those refs have no WEB text in local seed inputs.
- `www.ezramcp.com` is not configured yet.
- A real inbox account flow is still needed before public announcement to verify live email delivery and authenticated production collection creation.

## Important Constraints
- Remote origin: `https://github.com/apollostreetcompany/ezra.git`.
- Do not print secrets or saved tokens during validation.
- Do not add graphify to v1.
- Keep `main` deployable and do not commit directly to `main`.

## Next Engineer Notes
Start from the worktree branch if continuing Bead 31: `/Users/kikimac/ezra-mcp-collections` on `codex/feat/bead-31-custom-verse-collections`. Run `pnpm verify` before edits. If it fails, prioritize full workspace package consistency before feature polish.

Before launch:
- Run a real magic-link account test with a controlled inbox.
- Optionally add `www.ezramcp.com` after DNS/route permissions are confirmed.
- Use Wrangler 4.92.0+ for exact local parity with Worker compatibility date `2026-05-15`; Wrangler 4.87.0 requires a local-only compatibility-date override for smoke testing.
