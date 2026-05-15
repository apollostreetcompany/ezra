# Beads

This human-readable bead ledger complements `handoff/beads.jsonl`.

## Bead 1 - Scaffold Project Governance
- Status: approved
- Branch: `codex/feat/bead-1-scaffold`
- Commit: `e379358069b8900d07e73a33d2f25018d540e464`
- Validation: `make verify`

## Bead 2 - Plugin Scaffold
- Status: approved
- Branch: `codex/feat/bead-2-plugin-scaffold`
- Commit: `448a68216b397082a37ba75e7328eb0abe629fa5`
- Validation: `make verify`

## Bead 3 - TypeScript Monorepo Baseline
- Status: approved
- Branch: `codex/feat/bead-3-monorepo-baseline`
- Commit: `2c7c8532b9547943c994651e3011ca54f51af5a2`
- Validation: `pnpm install`, `pnpm lint`, `pnpm test`, `pnpm build`, `make verify`

## Bead 4 - Core Bible Engine
- Status: approved
- Branch: `codex/feat/bead-4-core-engine`
- Commit: `1ae73d1f5c6ce33e2649e18bf62cdb6a8eb3fd6a`
- Validation: `pnpm --filter @bible-coder/core lint`, `pnpm --filter @bible-coder/core test`, `pnpm --filter @bible-coder/core build`, `make verify`

## Bead 5 - CLI Free Tier
- Status: approved
- Branch: `codex/feat/bead-5-cli-free-tier`
- Commit: `4d6fe54749ba6d04de2c63601d95ef49743bdaf0`
- Validation: `pnpm --filter @bible-coder/cli lint`, `pnpm --filter @bible-coder/cli test`, `pnpm --filter @bible-coder/cli build`, `make cli-read`, `make verify`

## Bead 6 - Server Sync Foundation
- Status: approved
- Branch: `codex/feat/bead-6-server-sync`
- Commit: `3b20662585e65c5a65ed88c15813afc17626c54a`
- Validation: `pnpm --filter @bible-coder/server lint`, `pnpm --filter @bible-coder/server test`, `pnpm --filter @bible-coder/server build`, `pnpm --filter @bible-coder/server drizzle:check`, `make verify`, local `/health` smoke on port `4177`

## Bead 7 - API.Bible Proxy
- Status: approved
- Branch: `codex/feat/bead-7-api-bible-proxy`
- Commit: `7fb8cc6cd019a75e03472e0056c9f4a1b4a37c0c`
- Validation: `pnpm --filter @bible-coder/server lint`, `pnpm --filter @bible-coder/server test`, `pnpm --filter @bible-coder/server build`, `pnpm --filter @bible-coder/server drizzle:check`, `make verify`

## Bead 8 - Stripe Billing
- Status: approved
- Branch: `codex/feat/bead-8-stripe-billing`
- Commit: `26766bc271e27091a38515ad6b65d304468a56ce`
- Validation: `pnpm --filter @bible-coder/cli lint`, `pnpm --filter @bible-coder/cli test`, `pnpm --filter @bible-coder/server lint`, `pnpm --filter @bible-coder/server test`, `pnpm --filter @bible-coder/server build`, `make verify`

## Bead 9 - MCP Integration
- Status: approved
- Branch: `codex/feat/bead-9-mcp-integration`
- Commit: `7ad4a7ef4c9e26cde0b0bf93b73ed04960a34157`
- Validation: `pnpm --filter @bible-coder/mcp lint`, `pnpm --filter @bible-coder/mcp test`, `pnpm --filter @bible-coder/mcp build`, `make verify`, MCP stdio smoke

## Bead 10 - Prayer Gate /block
- Status: approved
- Branch: `codex/feat/bead-10-prayer-gate`
- Commit: `ecc0ac4fbedeb7bfa78de6de96eb629b3269b30a`
- Validation: `pnpm --filter @bible-coder/cli lint`, `pnpm --filter @bible-coder/cli test`, `pnpm --filter @bible-coder/cli build`, `pnpm --filter @bible-coder/server lint`, `pnpm --filter @bible-coder/server test`, `pnpm --filter @bible-coder/server build`, `pnpm --filter @bible-coder/server drizzle:check`, `make verify`, `make cli-block-status`

## Bead 11 - Leaderboard + Polish
- Status: approved
- Branch: `codex/feat/bead-11-leaderboard-polish`
- Commit: `ad59d1c67cbc171967472f663eee67151e1ef195`
- Validation: `pnpm --filter @bible-coder/server lint`, `pnpm --filter @bible-coder/server test`, `pnpm --filter @bible-coder/server build`, `pnpm --filter @bible-coder/server drizzle:check`, `make release-check`

## Bead 12 - Live API.Bible/Stripe Validation
- Status: approved
- Branch: `codex/feat/live-api-stripe-validation`
- Commit: `f5559dcaaae873220b86564bfe56abce31440ee4`
- Validation: `pnpm --filter @bible-coder/server lint`, `pnpm --filter @bible-coder/server test`, `pnpm --filter @bible-coder/server build`, `pnpm --filter @bible-coder/mcp lint`, `pnpm --filter @bible-coder/mcp test`, `pnpm --filter @bible-coder/mcp build`, `make live-api-bible-smoke`, `make live-stripe-smoke`, Stripe CLI filtered price lookup, `make release-check`

## Bead 13 - Runnable CLI/Server Demo
- Status: approved
- Branch: `codex/feat/live-api-stripe-validation`
- Commit: `7c91e3a25a957be019a63aac311c1cd8b8057407`
- Validation: `pnpm --filter @bible-coder/cli lint`, `pnpm --filter @bible-coder/cli test`, `pnpm --filter @bible-coder/cli build`, local server demo on port `3187`, `make live-api-bible-smoke`, `make live-stripe-smoke`, `make release-check`

## Bead 14 - Install Plugin Into This Codex
- Status: approved
- Branch: `codex/feat/live-api-stripe-validation`
- Commit: `585e6b8be79a323bf3641e64a6f42a6019097a09`
- Validation: Codex marketplace added, plugin enabled, MCP server registered, global commands linked, MCP install smoke, `pnpm --filter @bible-coder/mcp lint`, `pnpm --filter @bible-coder/mcp test`, `pnpm --filter @bible-coder/mcp build`, `make release-check`

## Bead 15 - Bibe Setup And Cloudflare API
- Status: approved
- Branch: `codex/feat/live-api-stripe-validation`
- Commit: `6a47e9b85d4eb7349e0ad14592df2490833be937`
- Validation: `pnpm --filter @bible-coder/cli lint`, `pnpm --filter @bible-coder/cli test`, `pnpm --filter @bible-coder/worker lint`, `pnpm --filter @bible-coder/worker test`, piped `bible-coder` first-run smoke, `make release-check`

## Bead 16 - Cloudflare Worker Deploy
- Status: approved
- Branch: `codex/feat/live-api-stripe-validation`
- Commit: `cb9a58186a1694dd2c5fe80fe57b694494298dca`
- Validation: D1 created and migrated, Worker secrets uploaded, Worker deployed to `https://bibecoder-api.ryan-borker.workers.dev`, `/health` smoke, `/v1/bibles` launch-gate smoke, `/v1/device-tokens` token issuance smoke, `make release-check`

## Bead 17 - Bibe Site, Setup Goals, Billing Email
- Status: approved
- Branch: `codex/feat/live-api-stripe-validation`
- Commit: `b32381809a957145ca0aa148b6de2199378105f9`
- Related commits: `d9e07e32ea097f8231d0c8b0bac034c4a0e0b444`, `02fa97e0381f1fb70b1dfe6c02d8008502814839`
- Validation: Bibe Code site built and deployed to Cloudflare Pages, D1 remote write confirmed, setup smoke confirms login runs and token is stored privately, Worker billing portal/refund/Klaviyo tests pass, `make release-check`

## Bead 18 - Ambient Coda Primitive
- Status: approved
- Branch: `codex/feat/live-api-stripe-validation`
- Commit: `56562164368ebde504c41239f5ad377f8bee6c14`
- Validation: `pnpm --filter @bible-coder/cli test`, `pnpm --filter @bible-coder/mcp test`, `make link-local`, `bible-coder coda`, `make release-check`

## Bead 21 - Install-Time Ambient Coda Hooks
- Status: approved
- Branch: `codex/feat/bead-20-landing-page-dns`
- Commit: `ff251e03dd2c350c1b8a779cee283c59eaf94548`
- Validation: `pnpm --filter @bible-coder/cli test`, `pnpm --filter @bible-coder/cli lint`, `pnpm --filter @bible-coder/cli build`, `make link-local`, `bible-coder hooks doctor --client all`, `bible-coder hooks install --client all --scope user --mode coda --yes`, `bible-coder hooks run --client codex --event SessionStart --mode coda`, `make release-check`, `make cli-hooks-doctor`

## Bead 22 - Landing Page Refresh And DNS Remediation
- Status: concerns
- Branch: `codex/feat/bead-20-landing-page-dns`
- Commit: `befb0aeceb5bb1f7e60b19ee8a3f99605682920f`
- Validation: OpenProse run trace, `pnpm --filter @bible-coder/site lint`, `pnpm --filter @bible-coder/site test`, `pnpm --filter @bible-coder/site build`, Chrome screenshots at 390/768/1280, `make validate-docs`, `make release-check`, Pages deploy smoke
- Concern: `https://bibecoder.pages.dev` is live, but `bibecoder.com` remains pending because Cloudflare DNS edit access is unavailable for creating `CNAME @ -> bibecoder.pages.dev`.
