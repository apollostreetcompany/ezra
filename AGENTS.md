# AGENTS.md - Bible Coder

## 1. Mission (North Star)
Build Bible Coder, a repo-local Codex plugin plus hosted sync server for Bible reading in agentic coding environments.

Goals:
1. Provide free local WEB/KJV reading, reference lookup, simple plans, progress display, and spaced repetition without API.Bible calls.
2. Provide paid AI-generated reading and verse plans with server-proxied API.Bible access after licensing confirmation.
3. Sync plans, progress, review queues, and Prayer Gate attestations across Codex, Claude, Gemini, terminal, and machines using generated tokens.
4. Keep paid Bible text behind the server, attributed, cached only within allowed terms, and never inserted into AI prompts for plan generation.
5. Offer premium Prayer Gate `/block` mode that requires the user to type `I have prayed` before Git push.
6. Keep Prayer Gate hook mutation CLI-only in v1; MCP may expose read-only `block_status`.
7. Keep premium catalog behind a disabled feature flag until API.Bible confirms commercial catalog, FUMS, native/CLI/MCP display, and caching terms in writing.

## 2. Core Architecture
Planned repository structure:

```text
.
├── plugins/bible-coder/        # Codex plugin manifest, skill, MCP config, assets
├── packages/core/              # Reference parser, Bible metadata, plan schema, progress, SM-2 scheduler
├── packages/cli/               # bible-coder CLI commands
├── packages/mcp/               # MCP tools for Codex, Claude, and Gemini
├── apps/server/                # Fastify contract/local API, Neon/Postgres, Drizzle, Stripe, API.Bible proxy
├── apps/worker/                # Cloudflare Worker production API, D1, Stripe, API.Bible proxy
├── scripts/                    # Validation and project automation
├── handoff/                    # Bead evidence ledger
└── .github/workflows/          # CI checks
```

Data flow:

```text
CLI/MCP clients -> Cloudflare Worker -> API.Bible/Stripe/D1
Local tests -> Fastify server -> mocked API.Bible/Stripe/Neon schema
Free local WEB/KJV -> packages/core assets -> CLI/MCP display
AI plan generation -> reference-only plan -> display text fetched afterward
```

## 3. Tech Stack
| Layer | Choice | Specifics |
| --- | --- | --- |
| Language | TypeScript | Strict ESM, Node 22+ local baseline unless deployment requires newer |
| Package manager | pnpm | Workspace monorepo |
| CLI | Node TypeScript | `bible-coder` bin |
| MCP | TypeScript MCP server | JSON schemas for tool inputs/outputs |
| Server | Cloudflare Worker + Fastify | Worker is production; Fastify remains local/contract target |
| Database | Cloudflare D1 + Neon Postgres schema | D1 is production target; Drizzle/Neon schema remains implementation evidence |
| Billing | Stripe Checkout | Webhook signature verification and idempotency |
| Bible API | API.Bible | Server-side proxy only |
| Tests | Vitest | Unit, contract, integration-style tests with mocks |
| CI | GitHub Actions | Lint, test, build, docs validation |

## 4. Agent and Sub-Agent Profiles

### Hybrid Agent Selection Policy (Mandatory)

Default behavior:
- Use contextual/dynamic agent selection for low-risk and single-domain beads.

Hard guardrails (must override dynamic choice):
- If bead changes schema/migrations, auth/policy/security logic, public API contracts, or deployment/runtime:
  - Required path: Architect review -> domain Engineer implementation -> Analyst review.
- If bead includes Figma URL/node or visual parity requirement:
  - Required implementer: Frontend Engineer with Figma tool access.
- If bead touches deploy targets (Render/Vercel/infra config):
  - Required implementer: DevOps Engineer (or equivalent deploy specialist).

Selection protocol per bead:
1. Primary agent chosen by context.
2. Record selection rationale in bead summary. Required fields: chosen agent; why chosen; confidence (low/medium/high); fallback agent.
3. If confidence is low or bead spans multiple domains: split bead or escalate to Architect before implementation.

Non-negotiable:
- Dynamic selection cannot bypass hard guardrails.

## 5. Branching & Commits
Convention: `<type>(bead-N): description`

Types: feat, optimization, fix, test, docs, chore.

Branch naming: `codex/feat/bead-N-description`, `codex/fix/...`, or `codex/chore/...`.

No direct commits to `main`. Keep `main` deployable. Squash merge only. Pull with rebase before merge and delete merged branches.

Remote: `https://github.com/apollostreetcompany/bible-coder`.

## 6. Continuity Ledger
Protocol for `CONTINUITY.md`:
- Read/update every turn.
- Keep the exact required headings.
- Append key decisions; do not delete prior decisions.
- Beads are atomic work units; the ledger tracks current state and decisions.
- Start implementation/review replies with a Ledger Snapshot when practical.
- Mark unknowns as `UNCONFIRMED`.

## 7. Workflow

### Bead Entry Gate (Mandatory)

Before implementation starts:
1. Bead scope and acceptance tests are explicit.
2. Agent selected using Hybrid Agent Selection Policy.
3. Required tools declared (RepoPrompt, Figma, deploy CLI, etc.).
4. Risk class declared as one of: `Low` (single-domain, no contract/security/deploy impact); `Medium` (multi-file/domain, no hard-guardrail impact); `High` (any hard-guardrail triggered).

If missing, bead is not started.

### Bead Exit Gate (Mandatory)

Before bead is marked complete:
1. Required tests pass for risk class.
2. Reviewer checklist completed (completeness, quality, consistency, tests, security).
3. `CONTINUITY.md` updated.
4. `handoff/beads.jsonl` updated.
5. Chat bead summary posted.

Validation matrix:
- `code`: lint/format checks; relevant unit/integration tests; risk-class test scope.
- `docs/process`: markdown lint if configured; internal link/path verification; policy consistency check.
- `design/ui`: design source recorded; screenshot or visual evidence artifact; interaction/accessibility notes when changed.
- `research/analysis`: source list recorded; assumptions labeled; recommendation and tradeoff summary.
- `ops/deploy`: deploy preflight; runtime/port binding verification; health check and rollback documented.

Risk/test matrix:
- `Low`: changed-module checks only; targeted tests.
- `Medium`: changed-module checks and relevant integration/contract tests.
- `High`: full required test suite, security/contract checks, reviewer sign-off before merge.

## 8. Orchestration

### Spawn Contract (Mandatory)

Each spawned agent prompt must include:
1. Owned files/paths.
2. In-scope and out-of-scope work.
3. Required tools and constraints.
4. Acceptance tests and expected outputs.
5. Report must include: changes made; test commands/results; assumptions/risks; follow-up recommendations.

### Escalation Rules

Architect sign-off required before implementation if:
1. Public API shape changes.
2. Data schema/migration changes.
3. Policy/security model semantics change.
4. Deployment architecture/runtime behavior changes.

## Safety
- Do not exfiltrate private data.
- Do not print secrets, JWTs, API keys, private key material, or copied key file contents.
- Do not run destructive commands without explicit approval.
- Prefer recoverable delete flows when feasible.
- Ask when risk is unclear.
