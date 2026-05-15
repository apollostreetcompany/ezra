# CONTINUITY.md - Bible Coder

## Goal (incl. success criteria)
Build Bible Coder as a repo-local Codex plugin plus hosted sync server. V1 is successful when users can install the plugin, receive an ambient local WEB/KJV verse coda during agent coding sessions, create AI-assisted reference-based Bible plans, track progress and spaced repetition, sync across clients with generated tokens, use Stripe Checkout for paid features, and enable Prayer Gate `/block` mode requiring personal attestation before protected prompts or Git push.

## Constraints/Assumptions
- Repo path: `/Users/kikimac/Documents/New project`.
- GitHub remote: `https://github.com/apollostreetcompany/bible-coder`.
- No direct commits to `main`; implementation uses `codex/feat/bead-1-scaffold` and follow-on `codex/*` branches.
- Free WEB/KJV texts are local assets and must not consume API.Bible calls.
- Paid API.Bible access is server-proxied and gated by written licensing confirmation before public catalog claims.
- Paid Scripture text must not be sent to AI providers as prompt content for plan generation.
- Prayer Gate verifies only user attestation text, not prayer itself.
- Current work branch: `codex/feat/bead-20-landing-page-dns`.
- Bead 20 acceptance: landing page uses the supplied `jesus-one.png` image, presents Bibe Code in a bold contemporary vector/streetwear aesthetic, phrases landing-page copy as benefits and what users get, passes site checks, deploys to Cloudflare Pages, and resolves the `bibecoder.com` landing-page DNS/custom-domain state.
- Bead 22 records the landing-page refresh/deploy work because bead 21 ambient-hook commits landed on this branch while the landing work was in progress.
- Bead 24 records the post-dashboard DNS verification and PR handoff without touching the separate transactional-email worktree.

## Key Decisions
1. Build Bible Coder as a repo-local Codex plugin plus hosted sync server, not as a standalone skill.
2. Use a TypeScript pnpm monorepo with `packages/core`, `packages/cli`, `packages/mcp`, and `apps/server`.
3. Server owns API.Bible and Stripe secrets; local clients store only opaque generated sync tokens.
4. Budget paid API.Bible usage at 300 calls/user/month included, warn at 750, and cap or upsell at 1,500.
5. `/block` Prayer Gate is premium opt-in and requires exact `I have prayed` attestation before Git push.
6. `/block` mutation is CLI-only in v1; MCP exposes read-only `block_status` only.
7. Prayer Gate hooks must read attestation from `/dev/tty`, preserve/wrap existing hooks, and restore where possible on disable.
8. Premium API.Bible cache defaults to `metadata-only`; content cache is feature-flagged until API.Bible confirms caching/FUMS semantics in writing.
9. Paid API.Bible text is redacted from model-visible MCP outputs by default; free WEB/KJV may be returned inline.
10. Sync uses opaque `bc_live_<prefix>_<random_256_bits>` device tokens stored hashed with `TOKEN_HASH_PEPPER`.
11. CLI free-tier state uses private local files: `auth.json` and `state.sqlite` under `BIBLE_CODER_CONFIG_DIR` or `~/.config/bible-coder`; server sync, Stripe, API.Bible, and Prayer Gate mutation remain later-bead functionality.
12. Server sync foundation exposes Fastify routes with an in-memory repository for tests and a Drizzle/Neon schema for persistence; production startup requires `TOKEN_HASH_PEPPER`.
13. API.Bible proxy is default-disabled behind `BIBLE_CODER_ENABLE_PREMIUM_API_BIBLE`; paid text and FUMS report URLs are redacted for model-visible responses, while explicit `surface=human` may return paid content with attribution and FUMS reporting data.
14. Stripe billing uses server-side Checkout Sessions, Billing Portal sessions, raw-body webhook signature verification, idempotent event processing, and subscription-status-driven premium entitlement changes.
15. MCP v1 is implemented as a small stdio JSON-RPC server with `initialize`, `ping`, `tools/list`, and `tools/call`; it keeps Prayer Gate mutation out of MCP and redacts paid API.Bible text from model-visible tool output.
16. Prayer Gate `/block` is implemented as CLI-only hook mutation with exact `I have prayed` attestation, local WEB prompt text, reversible hook wrapping, local-only logs, and privacy-minimal opt-in server attestation surfaces.
17. Leaderboard v1 is opt-in and privacy-minimal: public entries expose only display name and completed progress count, while `make release-check` is the final local preflight.
18. Live API.Bible and Stripe smoke secrets stay in ignored local env files only; `.env.local` is not committed and is mode-restricted.
19. Stripe live validation uses the installed Stripe CLI plus server-side Stripe SDK fallback because no Stripe plugin is available in the active Codex plugin set.
20. MCP tool errors now expose structured, machine-readable error types and fix hints while keeping tokens, keys, stack traces, and paid text out of output.
21. CLI `login` now issues and saves a server sync token when `BIBLE_CODER_API_URL` is set, and CLI `sync` uploads local plans/progress to the running server using the saved token.
22. This Codex install now has the local `bible-coder` marketplace enabled, the `bible-coder` MCP server registered, and global `bible-coder`/`bible-coder-mcp` commands linked from `~/.local/bin`.
23. MCP server-backed tools can reuse the private token saved by `bible-coder login`; users do not need to paste sync tokens into Codex chat or config for the local demo.
24. User-facing brand is Bibe Code at `bibecoder.com` with the line "Stop Vibe Coding. Start Bibe Coding."; the npm binary remains `bible-coder` for clarity.
25. Production infra target is Cloudflare Worker + D1 at `api.bibecoder.com`; the Fastify server remains useful for local contract tests and implementation evidence.
26. First-run local setup must not require a custom Bible path; bundled WEB/KJV is the default and custom imports are optional.
27. Prompt blocking is capability-checked per client: Codex and Claude Code use `UserPromptSubmit`, Gemini CLI uses `BeforeAgent`, and unsupported app surfaces must be warned rather than promised.
28. Cloudflare Worker deployed successfully at `https://bibecoder-api.ryan-borker.workers.dev`; the `api.bibecoder.com` custom route is blocked until the Cloudflare API token has zone Workers Routes permission.
29. Codex plugin and pnpm CLI installs should converge on the same first-run command: `bible-coder setup`.
30. Goals are free. Paid v1 gates only custom/API.Bible Bibles, Prayer Gate `/block`, and future leaderboard features.
31. Cloud setup runs login before premium Bible catalog selection, stores the opaque token privately, and continues cloud setup even when the premium catalog is empty.
32. Bibe Code static site is built under `apps/site` and deployed to Cloudflare Pages at `https://bibecoder.pages.dev`; `bibecoder.com` is added as a Pages custom domain but is still pending DNS/activation.
33. Cloudflare D1 remote writes are confirmed; the remaining Cloudflare blocker is zone route/DNS permission for `api.bibecoder.com`, not D1 write access.
34. Worker billing now supports Stripe Billing Portal, refund request intake, `charge.refunded` lifecycle handling, and optional Klaviyo events; Klaviyo stays disabled until `KLAVIYO_PRIVATE_API_KEY` is configured.
35. The intended default UX is ambient, not query-driven: installed agent clients should show a Bible verse coda without the user asking for `/biblegoal`.
36. The first ambient primitive is `bible-coder coda --record` plus MCP `session_coda` with `record: true`; prompt-hook installation remains the missing integration layer.
37. Local branch installs should use `make link-local`, which links built binaries into `~/.local/bin`; pnpm 10 rejects `pnpm --filter ... link --global` in this workspace.
38. Proconsult review recommends no silent package-install hook mutation. `bible-coder setup` should detect clients and explain; only `bible-coder hooks install ... --preview/--yes` should mutate Codex, Claude, or Gemini config.
39. Ambient coda hooks should call a dedicated `bible-coder hooks run ...` adapter, not raw `bible-coder coda --record`, so each client gets safe JSON output and local progress behavior.
40. Ambient coda should be user-visible by default, not model-visible. Model-visible `additionalContext` should require an explicit opt-in because Codex, Claude, and Gemini hook context paths can feed text into the model.
41. Ship Codex and Claude ambient coda first after smoke tests; keep Gemini ambient coda experimental until a live smoke confirms non-blocking `systemMessage` renders reliably.
42. Prompt `/block` mode should not use `/dev/tty`; prompt hooks should use exact-attestation handshake plus JSON block decisions, keeping attestation-only prompts out of model context.
43. Bead 20 runs the web landing-page responsive and anti-slop cleanup recipes through the current OpenProse Contract Markdown/VM semantics, with a persistent `.prose/runs/` trace instead of relying on a shell `prose` binary.
44. Landing-page copy must be benefit-led and "what you get" phrased; functionality-descriptive landing copy such as "what it does," "set a goal," or "MCP ready" is rejected by site validation.
45. `bible-coder setup` now asks explicitly whether to install ambient Bible coda hooks for Codex, Claude Code, and Gemini CLI; answering yes writes backed-up user hook configs for all three clients.
46. Ambient coda hooks call `bible-coder hooks run ...`, which emits hook-safe JSON `systemMessage` only. It does not use raw stdout or model-visible `additionalContext`.
47. This machine now has user-scope ambient coda hooks installed in `~/.codex/hooks.json`, `~/.claude/settings.json`, and `~/.gemini/settings.json`; Gemini remains marked experimental until a live Gemini CLI visual smoke confirms display behavior.
48. The refreshed landing page uses `apps/site/src/assets/jesus-one.png`, benefit-led "What you get" copy, and high-contrast red/navy/bone/gold styling; site validation rejects the old functionality-descriptive landing copy.
49. `bibecoder.com` was detached from the mistaken `bibecoder-api` Worker custom domain and re-added to the `bibecoder` Pages project, but DNS activation still requires a Cloudflare token/dashboard session with DNS edit permission to create the apex CNAME to `bibecoder.pages.dev`.
50. Cloudflare DNS now has the apex `bibecoder.com` record pointed at Pages; public resolvers return Cloudflare edge A records and an edge-forced HTTPS smoke returns 200.
51. `make verify` now builds before linting so clean CI runners have workspace package declaration outputs before packages such as `@bible-coder/cli` resolve `@bible-coder/core`.
52. Cloudflare Pages now reports `bibecoder.com` as active; any remaining local `curl` resolution failure is resolver cache/propagation rather than a missing DNS or Pages binding.

## State

### Done
- [x] Repo inspected; starting state was empty Git repository.
- [x] RepoPrompt workspace bound; current code map has no source files yet.
- [x] Private GitHub remote created at `https://github.com/apollostreetcompany/bible-coder`.
- [x] Bead 1 - Project governance, handoff, validation, deployment, and CI scaffold committed.
- [x] Bead 2 - `plugins/bible-coder` scaffold, marketplace entry, skill stubs, install scripts, and v1 hardening docs committed.
- [x] Bead 3 - pnpm TypeScript monorepo baseline, package boundaries, validation scripts, and CI-ready commands committed.
- [x] Bead 4 - Core Bible engine with reference parser, canonical metadata, plan schema, progress math, SM-2 scheduler, local WEB/KJV loader stub, and paid-text policy guard committed.
- [x] Bead 5 - CLI free tier with local WEB/KJV read, deterministic reference-first plan creation, progress recording/status, SM-2 review commands, local auth/state files, and checkout/sync placeholders committed.
- [x] Bead 6 - Server sync foundation with Fastify health/device-token/plan/progress/review routes, token hashing, auth middleware, Drizzle schema/migration, Render skeleton, and local health smoke committed.
- [x] Bead 7 - API.Bible proxy and compliance gates with default-disabled premium feature flag, entitlement/allowed-Bible checks, FUMS v3 handling, metadata-only cache default, model-visible redaction, and mocked contract tests committed.
- [x] Bead 8 - Stripe billing with CLI checkout request, server checkout session, raw-body webhook verification, idempotency, billing portal, and entitlement transitions committed.
- [x] Bead 9 - MCP integration with stdio JSON-RPC lifecycle, v1 tool schemas, server-backed billing/progress/sync calls, free local inline passage/search, paid-text redaction, and read-only `block_status` committed.
- [x] Bead 10 - Prayer Gate `/block` with premium-gated enable, reversible `pre-push` hook wrapper, exact attestation prompt, local-only attestation log, CLI tests, and privacy-minimal server settings/entitlement endpoints committed.
- [x] Bead 11 - Opt-in privacy-minimal leaderboard, leaderboard docs, privacy updates, release checklist, and `make release-check` preflight committed.
- [x] Bead 12 - Live API.Bible/Stripe validation with secret-safe smoke scripts, structured MCP errors, live API.Bible/Stripe checks, and MCP docs hardening committed.
- [x] Bead 13 - Runnable CLI/server demo hardening with server-issued sync tokens, saved-token checkout, sync upload, and local demo evidence committed.
- [x] Bead 14 - Installed plugin into this Codex and hardened first-run MCP token reuse committed.
- [x] Bead 15 - Bibe Code first-run UX, Cloudflare Worker production API scaffold, and prompt-blocking capability matrix committed.
- [x] Bead 16 - Cloudflare Worker D1 provisioning, secrets upload, workers.dev deploy, and remote smoke committed.
- [x] Bead 17 - Bibe Code site, pnpm-first setup docs, free goals UX, Worker billing portal/refund/Klaviyo hardening, Pages deploy, and setup smoke committed.
- [x] Bead 18 - Ambient coda primitive and local link fix implemented.
- [x] Bead 21 - Install-time ambient coda hook UX for Codex, Claude Code, and Gemini CLI implemented and smoke-tested locally.
- [x] Bead 22 - Landing page refreshed, visually verified, and deployed to Cloudflare Pages; the mistaken Worker custom-domain binding was removed and `bibecoder.com` was reattached to Pages.
- [x] Bead 24 - Verified the dashboard DNS record exists, confirmed Cloudflare edge serving and active Pages status for `bibecoder.com`, and prepared PR handoff without modifying the separate transactional-email worktree.

### Now
- PR #1 is open from `codex/feat/bead-20-landing-page-dns` to `codex/feat/live-api-stripe-validation`; wait for the latest CI run after the final handoff update.

### Next
- If a local machine still cannot resolve `bibecoder.com`, wait for DNS cache expiry or flush local DNS; Cloudflare DNS and Pages are active.
- Live-smoke the next new Codex thread and trust the non-managed hook via `/hooks` if Codex prompts for review.
- Extend block mode prompt hooks to require Pray, Read, or Both attestation before allowing the protected prompt to continue.
- Fix Cloudflare API token route permission and move Worker from workers.dev to `api.bibecoder.com`.
- Finish `bibecoder.com` Pages custom-domain activation once Pages status completes.
- Configure `KLAVIYO_PRIVATE_API_KEY` and send a non-production email event smoke before announcing lifecycle email.
- Final launch compliance gates remain blocked on written API.Bible approval.

## Open Questions
- UNCONFIRMED: Exact API.Bible commercial translation catalog licensing terms for a `$10/month` subscription.
- UNCONFIRMED: Final deploy target account and Render service names.
- UNCONFIRMED: Which premium Bible translations will be licensed first.

## Working Set
- `AGENTS.md`
- `CONTINUITY.md`
- `HANDOFF.md`
- `MISTAKES.md`
- `DEPLOYMENT.md`
- `Makefile`
- `scripts/validate-docs.sh`
- `.github/workflows/ci.yml`
- `handoff/beads.schema.json`
- `handoff/beads.jsonl`
- `docs/V1_PLAN.md`
- `plugins/bible-coder/.codex-plugin/plugin.json`
- `.agents/plugins/marketplace.json`
- `package.json`
- `pnpm-workspace.yaml`
- `packages/core/src/index.ts`
- `packages/core/src/references/parser.ts`
- `packages/core/src/references/books.ts`
- `packages/core/src/translations/local.ts`
- `packages/core/src/plans/schema.ts`
- `packages/core/src/progress/progress.ts`
- `packages/core/src/reviews/sm2.ts`
- `packages/core/src/entitlements/usage.ts`
- `packages/core/src/policy/aiTextPolicy.ts`
- `packages/cli/src/cli.ts`
- `packages/cli/src/commands/hooks.ts`
- `packages/cli/src/bin.ts`
- `packages/cli/src/local-state/paths.ts`
- `packages/cli/src/local-state/store.ts`
- `packages/cli/test/cli.test.ts`
- `packages/mcp/src/index.ts`
- `packages/mcp/test/mcp.test.ts`
- `apps/server/src/server.ts`
- `apps/server/src/services/token.ts`
- `apps/server/src/services/sync.ts`
- `apps/server/src/services/auth.ts`
- `apps/server/src/routes/deviceTokens.ts`
- `apps/server/src/routes/plans.ts`
- `apps/server/src/routes/progress.ts`
- `apps/server/src/routes/reviews.ts`
- `apps/server/src/routes/bibles.ts`
- `apps/server/src/routes/passages.ts`
- `apps/server/src/routes/search.ts`
- `apps/server/src/services/apiBibleClient.ts`
- `apps/server/src/services/apiBibleProxy.ts`
- `apps/server/src/services/entitlements.ts`
- `apps/server/src/services/fums.ts`
- `apps/server/src/services/stripe.ts`
- `apps/server/src/routes/checkout.ts`
- `apps/server/src/routes/block.ts`
- `apps/server/src/routes/leaderboard.ts`
- `apps/server/src/db/schema.ts`
- `apps/server/src/db/migrations/0001_prayer_gate.sql`
- `apps/server/src/db/migrations/0002_leaderboard.sql`
- `packages/mcp/src/server.ts`
- `packages/mcp/test/mcp.test.ts`
- `scripts/link-local-bin.sh`
- `packages/cli/src/commands/block.ts`
- `docs/LEADERBOARD.md`
- `docs/LIVE_SMOKE_TESTING.md`
- `docs/MCP_TOOL_REFERENCE.md`
- `docs/RELEASE_CHECKLIST.md`
- `docs/SETUP_UX_AND_INFRA.md`
- `docs/PROMPT_BLOCKING_MATRIX.md`
- `docs/INSTALLATION.md`
- `docs/MCP_DOCS.md`
- `docs/SITE_DEPLOYMENT.md`
- `apps/site/src/index.html`
- `apps/site/src/docs/index.html`
- `apps/site/src/pro/index.html`
- `apps/site/src/mcp/index.html`
- `apps/site/src/privacy/index.html`
- `apps/site/src/terms/index.html`
- `scripts/live-api-bible-smoke.ts`
- `scripts/live-stripe-smoke.ts`
- `apps/worker/src/index.ts`
- `apps/worker/wrangler.jsonc`
- `apps/worker/migrations/0002_billing_email.sql`
