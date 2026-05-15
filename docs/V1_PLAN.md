# Bible Coder V1 Plan

## Full V1 Plan Preserved Verbatim

Build this as a repo-local Codex plugin plus hosted sync server, not as a standalone skill. The plugin will include a Bible-reading skill, CLI, MCP server, and manifests for Codex plus install notes for Claude/Gemini via MCP.

Free users get local WEB/KJV only. Paid users get AI-generated plans plus server-proxied API.Bible access. Because API.Bible current public pricing says Pro is $29+/month with 150,000 calls/month, and commercial Bible licenses start at $10/month per translation, the $10/user economics work for API call volume but not for an unlimited all premium translations promise unless API.Bible confirms catalog licensing terms.

Implementation changes: scaffold required project files first: AGENTS.md, CONTINUITY.md, HANDOFF.md, MISTAKES.md, handoff/beads.*, DEPLOYMENT.md, Makefile, GitHub remote, and CI. Create plugins/bible-coder using plugin-creator with skills, scripts, assets, .mcp.json, and marketplace metadata. Use a TypeScript monorepo: packages/core for Bible references, AI plan schema, spaced repetition, progress math; packages/cli for bible-coder login, checkout, plan create, read, progress, review, sync; packages/mcp for tools usable from Codex, Claude, and Gemini; apps/server: Fastify + Neon Postgres + Drizzle, deployed on Render. Server owns API.Bible and Stripe secrets. Local clients only store a generated opaque sync token. Paid API.Bible text is fetched through the server, cached temporarily, attributed, and never sent to Gemini/Claude for plan generation. AI plans use references/goals, then fetch display text afterward. Add Stripe Checkout from CLI: CLI requests a checkout session from the server, opens/prints the URL, and Stripe webhooks activate entitlements. Add progress bars and spaced repetition using a deterministic SM-2-style scheduler for verses/themes.

Public interfaces: MCP tools bible_get_passage, bible_search, plan_create, progress_record, progress_status, review_next, billing_checkout, sync_status. Server endpoints: /v1/device-tokens, /v1/plans, /v1/progress, /v1/reviews, /v1/bibles, /v1/passages, /v1/search, /v1/checkout/session, /v1/stripe/webhook, /v1/leaderboard. Env vars: DATABASE_URL, API_BIBLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, BIBLE_CODER_API_URL, BIBLE_CODER_TOKEN.

Economics and constraints: API.Bible public pages indicate Starter is 5,000 calls/month and non-commercial; Pro is $29+/month with 150,000 calls/month; overage is $1 per 1,000 calls; commercial licenses start at $10/month per translation. A $10 Stripe subscription nets about $9.41 before taxes/other fees at standard US card pricing. Expected use should be hardened beyond an initial 30-150 estimate: budget 300 API.Bible calls/user/month included, warn at 750, cap or upsell at 1500, and cache at server across Codex/Claude/Gemini/terminal sessions. Calls are not the main margin risk; licensed translation catalog breadth is. Launch gate: do not advertise premium catalog until API.Bible confirms commercial catalog licensing and whether the app subscription model is permitted.

Test plan: unit tests for reference parsing, plan generation schema, progress percentage, SM-2 scheduling, entitlement checks, and API.Bible cache TTL. Contract tests with mocked API.Bible and Stripe webhook signatures. Integration tests for login token sync, checkout-to-entitlement activation, cross-instance progress sync, and MCP tool calls. Compliance tests: no API.Bible key in client output, no paid copyrighted text in AI prompts, cache expires within 14 days, attribution/FUMS handling present where Scripture is displayed. Validation: pnpm lint, pnpm test, pnpm build, plugin manifest validation, markdown/link validation for docs.

Assumptions: plugin location is repo-local. Paid scope is premium catalog, gated by API.Bible licensing confirmation. Server v1 is sync + billing; leaderboard is opt-in and minimal. Free WEB/KJV texts are local assets, not API.Bible calls. WEB source should use public-domain eBible text. Proconsult was restored and should be used for this review.

## Hardened Decisions From Proconsult

- Bible Coder remains a repo-local Codex plugin with TypeScript monorepo and hosted server.
- MCP is a portability layer, not the primary trust boundary.
- A standalone skill is rejected because it cannot safely own secrets, billing, durable sync, entitlement enforcement, or Git hook installation.
- A standalone CLI is rejected because it loses Codex plugin UX and MCP portability.
- A SaaS-only app is rejected because Prayer Gate and repo-local reading workflows need local integration.
- Hook mutation is CLI-only in v1. MCP exposes only read-only `block_status`.
- Premium API.Bible catalog stays disabled until API.Bible confirms commercial use, translations, overage pricing, FUMS, caching, MCP/native display, and AI restrictions in writing.
