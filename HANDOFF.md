# HANDOFF.md - Bible Coder

## Current Context
Bible Coder is being implemented from an empty Git repository at `/Users/kikimac/Documents/New project`.

The product plan is a repo-local Codex plugin plus hosted sync server:
- Free local WEB/KJV Bible reading.
- Paid API.Bible proxy access after licensing confirmation.
- AI-generated reference-first reading and verse plans.
- Progress bars and spaced repetition.
- Sync across Codex, Claude, Gemini, terminal, and machines.
- Stripe Checkout from CLI.
- Premium Prayer Gate `/block` requiring `I have prayed` before Git push.

## Implementation State
Bead 1 scaffold is committed at `e379358069b8900d07e73a33d2f25018d540e464`.

Bead 2 plugin scaffold is committed at `448a68216b397082a37ba75e7328eb0abe629fa5`.

Bead 3 monorepo baseline is committed at `2c7c8532b9547943c994651e3011ca54f51af5a2`.

Bead 4 core Bible engine is committed at `1ae73d1f5c6ce33e2649e18bf62cdb6a8eb3fd6a`.

Bead 5 CLI free tier is committed at `4d6fe54749ba6d04de2c63601d95ef49743bdaf0`.

Bead 6 server sync foundation is committed at `3b20662585e65c5a65ed88c15813afc17626c54a`.

Bead 7 API.Bible proxy gates are committed at `7fb8cc6cd019a75e03472e0056c9f4a1b4a37c0c`.

Bead 8 Stripe billing is committed at `26766bc271e27091a38515ad6b65d304468a56ce`.

Bead 9 MCP integration is committed at `7ad4a7ef4c9e26cde0b0bf93b73ed04960a34157`.

Bead 10 Prayer Gate `/block` is committed at `ecc0ac4fbedeb7bfa78de6de96eb629b3269b30a`.

Bead 11 leaderboard and release polish is committed at `ad59d1c67cbc171967472f663eee67151e1ef195`.

Bead 12 live API.Bible/Stripe validation and MCP/docs hardening is in progress on `codex/feat/live-api-stripe-validation`.

Bead 13 runnable CLI/server demo hardening is in progress on `codex/feat/live-api-stripe-validation`.

Bead 14 plugin install and first-run MCP token reuse is committed at `585e6b8be79a323bf3641e64a6f42a6019097a09`.

Bead 15 Bibe Code first-run UX, Cloudflare Worker production API scaffold, and prompt-blocking capability matrix is committed at `6a47e9b85d4eb7349e0ad14592df2490833be937`.

Bead 16 Cloudflare Worker D1 provisioning, secrets upload, workers.dev deploy, and remote smoke is committed at `cb9a58186a1694dd2c5fe80fe57b694494298dca`.

Bead 17 setup/site/billing hardening is split across implementation commits:
- Site and docs: `d9e07e32ea097f8231d0c8b0bac034c4a0e0b444`
- Setup/goals/MCP UX: `02fa97e0381f1fb70b1dfe6c02d8008502814839`
- Worker billing/email hardening: `b32381809a957145ca0aa148b6de2199378105f9`

Bead 18 ambient coda primitive and local link fix is committed at `56562164368ebde504c41239f5ad377f8bee6c14`.

Bead 21 install-time ambient coda hook UX is committed at `ff251e03dd2c350c1b8a779cee283c59eaf94548`.

Bead 4 added the canonical 66-book metadata, strict reference parser, reference-first plan schema, progress summaries, deterministic progress bars, SM-2-style review scheduler, API.Bible usage budget thresholds, local WEB/KJV sample loader, and policy guard that keeps paid API.Bible text out of model-visible surfaces by default.

Bead 5 added `bible-coder read`, `plan create`, `progress`, `progress record`, `review`, `review record`, `login`, `checkout`, and `sync` command surfaces. Free local commands use core WEB/KJV sample texts and local `state.sqlite`; checkout and sync are explicit placeholders until their beads.

Bead 6 added Fastify `/health`, `/v1/device-tokens`, `/v1/plans`, `/v1/progress`, and `/v1/reviews`; opaque `bc_live_*` token issuance and SHA-256 hashing with `TOKEN_HASH_PEPPER`; invalid bearer rejection; idempotent progress/review events; Drizzle schema/migration files; and Render deployment skeleton. Tests use an in-memory sync repository; Neon persistence wiring remains future work.

Bead 7 added `/v1/bibles`, `/v1/passages`, and `/v1/search` API.Bible proxy routes; premium launch gate via `BIBLE_CODER_ENABLE_PREMIUM_API_BIBLE`; allowed Bible ID checks; in-memory premium entitlement hooks for tests; FUMS v3 request/report handling; metadata-only cache default; optional `content-14d`; and model-visible redaction for paid text and FUMS report URLs.

Bead 8 added CLI-backed Stripe Checkout session creation, `/v1/checkout/session`, `/v1/billing/portal`, raw-body `/v1/stripe/webhook` signature verification, webhook idempotency, subscription-status entitlement transitions, and contract tests for valid/invalid/duplicate Stripe events.

Bead 9 added a stdio JSON-RPC MCP server with `initialize`, `ping`, `tools/list`, and `tools/call`; schemas for all v1 MCP tools plus read-only `block_status`; local WEB/KJV inline passage/search; reference-first plan creation; server-backed progress, review, billing, and sync calls; and explicit paid API.Bible text redaction for model-visible outputs.

Bead 10 added CLI-only `block enable`, `block disable`, `block status`, `block test`, and `block prompt`; premium entitlement/grace checks at enable time; reversible `pre-push` hook installation with backup/wrapper behavior; exact `I have prayed` prompt handling; local-only attestation logs; `/v1/block/entitlement`, `/v1/block/settings`, and `/v1/prayer-attestations`; and tests proving no hook mutation is exposed through MCP.

Bead 11 added opt-in `/v1/leaderboard` and `/v1/leaderboard/profile`; privacy-minimal leaderboard entries containing only display name and completed count; docs for leaderboard, privacy, release checklist, and deployment preflight; and `make release-check`.

Current state: V1 implementation beads are complete. Public premium API.Bible catalog launch remains blocked on written API.Bible licensing, FUMS, caching, and MCP/model-context confirmation.

Live validation state:
- API.Bible endpoint `https://rest.api.bible/v1` works through the server smoke path with the local test key stored only in ignored `.env.local`.
- API.Bible smoke confirms `/v1/bibles`, human-surface passage fetch, attribution, FUMS token capture, and model-visible paid-text redaction.
- Stripe CLI is installed and account access works with the secret in `/Users/kikimac/.hermes/.env`.
- Stripe live smoke creates or reuses the `$10/month` `bible_coder_premium_monthly` price and creates a Checkout Session through the server route.
- Stripe plugin was requested but is not available in the active Codex plugin set; validation uses Stripe CLI and server-side Stripe SDK.
- CLI `login` now saves a server-issued sync token when `BIBLE_CODER_API_URL` is set, without printing the token.
- CLI `sync` now uploads local plans and progress events to the running server with the saved token.
- A local demo on port `3187` completed login, plan creation, progress recording, sync upload, and Stripe Checkout URL generation with URL output redacted.
- This Codex config has the `bible-coder` marketplace enabled and `bible-coder@bible-coder` enabled.
- This Codex config has a global `bible-coder` MCP server registered with `BIBLE_CODER_API_URL=http://127.0.0.1:3187`.
- The MCP server can now read the private sync token saved by `bible-coder login`, so token pasting is not required for the local demo.
- The user-facing brand is now Bibe Code at `bibecoder.com`, with the line "Stop Vibe Coding. Start Bibe Coding."
- Running `bible-coder` with no arguments starts a tested first-run wizard. Local setup defaults to bundled WEB/KJV; Cloud setup expects `BIBLE_CODER_API_URL`, loads `/v1/bibles`, runs login, and can request Stripe Checkout.
- Production infra direction changed from Render/Neon as primary to Cloudflare Worker + D1 at `api.bibecoder.com`; `apps/worker` now contains the Worker scaffold, D1 migration, Stripe Checkout/webhook logic, magic-link endpoints, and API.Bible proxy surface.
- The Worker is deployed at `https://bibecoder-api.ryan-borker.workers.dev`; health, closed premium catalog, and device-token issuance smoke tests passed. Custom `api.bibecoder.com` route failed because the current Cloudflare API token lacks zone route permission.
- Prompt blocking research is captured in `docs/PROMPT_BLOCKING_MATRIX.md`: Codex and Claude Code use `UserPromptSubmit`, Gemini CLI uses `BeforeAgent`, and unsupported app surfaces must warn rather than claim coverage.
- D1 remote write privilege is confirmed with a harmless `audit_log` insert; D1 is not the blocker for `api.bibecoder.com`.
- `bible-coder` / `bible-coder setup` now runs cloud login before premium Bible catalog selection. It stores the opaque sync token privately and continues setup when the premium catalog is empty.
- Goals are free. Users can inspect and update them with `bible-coder goal`, `bible-coder goal update --goal "..."`, and MCP tools `goal_status` / `goal_update`.
- Bibe Code site is deployed to Cloudflare Pages at `https://bibecoder.pages.dev`; deployment URL `https://4219af6a.bibecoder.pages.dev`. `bibecoder.com` was added as a Pages custom domain but remains pending/not resolving.
- Worker billing hardening added `/v1/billing/portal`, `/v1/refunds/request`, Stripe `charge.refunded` handling, and optional Klaviyo lifecycle events. `KLAVIYO_PRIVATE_API_KEY` was not present locally, so Klaviyo is wired but disabled.
- Stripe webhook endpoint is updated to the workers.dev API until `api.bibecoder.com` routing works.
- The intended UX is ambient coda first: agent clients should show the next Bible verse without the user explicitly asking. Current branch now has `bible-coder hooks doctor|install|uninstall|run`; `bible-coder setup` asks whether to install ambient coda hooks for Codex, Claude Code, and Gemini CLI, and answering yes writes user config for all three.
- This machine has ambient coda hooks installed in `~/.codex/hooks.json`, `~/.claude/settings.json`, and `~/.gemini/settings.json`. The installed hook command is `bible-coder hooks run ... --mode coda`, which emits JSON `systemMessage` and avoids model-visible `additionalContext`.
- Local hook smoke: `bible-coder hooks doctor --client all` reports Codex/Claude/Gemini installed. `bible-coder hooks run --client codex --event SessionStart --mode coda` returns a JSON coda for the current goal. One earlier `--record` smoke advanced the local `Read Genesis` goal from John 3:16 to Romans 8:28.
- The previous local-link docs were wrong for pnpm 10. Use `make link-local`, which builds and symlinks `bible-coder` and `bible-coder-mcp` into `~/.local/bin`.
- Bead 22 refreshed the landing page with the supplied `jesus-one.png` hero image, benefit-led "What you get" copy, and a high-contrast streetwear/vector aesthetic.
- Bead 22 OpenProse run artifacts for the responsive and anti-slop workflows are under `.prose/runs/20260515-035032-2e732a/`.
- Bead 22 visual evidence is in `docs/visual-evidence/bead-20-landing-390.png`, `docs/visual-evidence/bead-20-landing-768.png`, and `docs/visual-evidence/bead-20-landing-1280.png`.
- Production Pages deploy is live at `https://bibecoder.pages.dev` with deployment `https://fdd7550f.bibecoder.pages.dev`; preview alias is `https://dc9f7046.bibecoder.pages.dev`.
- DNS remediation removed the mistaken Worker custom-domain binding `bibecoder.com -> bibecoder-api` and re-added `bibecoder.com` to the `bibecoder` Pages project.
- Dashboard DNS now shows `CNAME bibecoder.com -> bibecoder.pages.dev` with Cloudflare proxy enabled. Public resolvers return Cloudflare edge A records, an edge-forced HTTPS smoke returned HTTP 200, and Cloudflare Pages reports `bibecoder.com` as active. If a local machine still cannot resolve it, treat that as resolver cache/propagation rather than a missing DNS record.
- The current landing/DNS branch is `codex/feat/bead-20-landing-page-dns`. The separate transactional-email worktree is `/Users/kikimac/Documents/bible-coder-transactional-email` on `codex/feat/bead-23-transactional-email`; do not modify it from this worktree.
- PR #1 is open at `https://github.com/apollostreetcompany/bible-coder/pull/1` against `codex/feat/live-api-stripe-validation` because the remote has no `main` branch. A clean-runner CI failure showed `make verify` linted before workspace `dist` declarations existed, so `Makefile` now builds before linting.

## Important Constraints
- No direct commits to `main`.
- Server owns API.Bible and Stripe secrets.
- Local clients store only opaque sync tokens.
- Paid Bible text must not be sent to AI prompts for plan generation.
- Prayer Gate verifies attestation only, not prayer.
- Prayer Gate hook mutation is CLI-only; MCP v1 may expose read-only `block_status` but not enable/disable.
- Prayer Gate hook reads from `/dev/tty`, not stdin, because Git passes ref data through stdin.
- Existing Git hooks must be backed up and wrapped, never silently overwritten.
- API.Bible premium catalog stays behind a disabled feature flag until commercial catalog, FUMS, MCP/native display, and cache terms are confirmed in writing.
- Default production cache mode is `metadata-only`; `content-14d` requires written approval.
- Paid API.Bible text is redacted from model-visible MCP output by default.
- FUMS user IDs must be non-PII HMACs, not emails, Stripe IDs, GitHub handles, repo names, or raw tokens.

## Proconsult Input
The user provided the Proconsult hardening output directly in chat. It is treated as authoritative v1 hardening input and preserved in `docs/V1_PLAN.md`.

## Next Engineer Notes
Start with `make release-check`. Do not enable or advertise premium API.Bible catalog access until written approval is attached for commercial subscription use, translations, overage pricing, FUMS, caching, and MCP/model-visible output rules.

For live checks and the local runnable demo, use `docs/LIVE_SMOKE_TESTING.md`; never print or commit `.env.local` or `/Users/kikimac/.hermes/.env`.

Before the next Worker deploy, keep `BIBLE_CODER_ALLOWED_PREMIUM_BIBLES` empty until API.Bible approval. To move from workers.dev to `api.bibecoder.com`, fix Cloudflare zone Workers Routes/DNS token permissions, restore the route, redeploy, then update the Stripe webhook endpoint.

Next UX work: live-smoke a brand-new Codex session. If Codex asks to review/trust the non-managed hook, open `/hooks` and approve it. Then layer Prayer Gate blocking on top of the prompt-hook framework for paid Pray/Read/Both modes.

Proconsult review completed on 2026-05-15 after one failed browser-cookie attempt and one successful browser retry. Advisory conclusion:
- Do not mutate agent-client hooks during package install or plugin install.
- Keep `bible-coder setup` as the detector/explainer.
- Add explicit `bible-coder hooks doctor/install/uninstall/run` commands.
- Default hook output should be user-visible JSON `systemMessage` rather than raw stdout or model-visible `additionalContext`.
- Codex and Claude are the first launch targets; Gemini remains experimental until `systemMessage` display is smoke-tested.
- Prompt `/block` must use JSON decisions and an attestation handshake, not `/dev/tty`.
