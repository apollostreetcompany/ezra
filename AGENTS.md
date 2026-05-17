# AGENTS.md - Ezra MCP

## 1. Mission (North Star)
Build Ezra MCP: a hosted Cloudflare Worker MCP server plus Codex plugin that gives LLM clients reliable Bible verse lookup by topic, story, parable, verse, and chapter.

Goals:
1. Serve exact World English Bible verse text and curated topic/pericope metadata through an authenticated HTTP MCP endpoint.
2. Ship a Codex plugin with an Ezra-specific CLI and stdio MCP bridge for setup, key storage, status, checkout, and billing.
3. Keep Ezra separate from Bible Coder/Bibe Code; reuse process lessons only.
4. Use Cloudflare D1 inverted indexes for v1. Do not add graphify. Add Vectorize only after real natural-language search demand.
5. Keep secrets server-side; local clients store only opaque session/API keys in private config files.
6. Support Free, Pro, and Max tiers with Stripe Checkout, webhook-driven entitlements, account status, and billing portal access.
7. Keep `main` deployable; no direct commits to `main`.

## 2. Core Architecture

```text
.
├── plugins/ezra-mcp/          # Codex plugin manifest, MCP config, skills, scripts
├── packages/cli/              # ezra-mcp local setup/account helper
├── packages/mcp/              # ezra-mcp-mcp stdio bridge to hosted HTTP MCP
├── apps/worker/               # Cloudflare Worker API + MCP endpoint + D1 access
├── apps/site/                 # Static site served by Worker assets
├── docs/                      # Launch, install, billing, deployment docs
├── scripts/                   # Validation and local link automation
└── handoff/                   # Bead evidence ledger
```

Data flow:

```text
Codex/Claude/Cursor/other MCP client
  -> local ezra-mcp-mcp bridge or direct HTTP
  -> Cloudflare Worker /v1/mcp
  -> D1 topics/verses/pericopes + auth/usage/entitlement tables

Site/account
  -> Worker magic-link, checkout, status, billing endpoints
  -> Stripe + D1
```

## 3. Tech Stack
| Layer | Choice | Specifics |
| --- | --- | --- |
| Language | TypeScript | Strict ESM, Node 22+ local baseline |
| Package manager | pnpm | Workspace monorepo |
| Runtime | Cloudflare Worker | Production API and static assets |
| Database | Cloudflare D1 | Catalog, auth, usage, billing state |
| MCP | HTTP MCP + local stdio bridge | JSON-RPC 2.0 |
| CLI | Node TypeScript | `ezra-mcp` bin |
| Billing | Stripe Checkout + Billing Portal | Pro and Max monthly tiers |
| Email events | Klaviyo optional | Magic link and lifecycle events |
| Tests | Vitest + static site scripts | Unit, worker contract, CLI/bridge tests |
| CI | GitHub Actions | `make verify` |

## 4. Agent and Sub-Agent Profiles

### Hybrid Agent Selection Policy (Mandatory)

Default behavior:
- Use contextual/dynamic agent selection for low-risk and single-domain beads.

Hard guardrails:
- Schema/migrations, auth/policy/security, public API contracts, billing, or deployment/runtime require Architect review -> domain Engineer implementation -> Analyst review.
- Figma URLs or visual parity requirements require a Frontend Engineer with Figma access.
- Deploy target changes require a DevOps/deploy specialist review path.

Selection protocol per bead:
1. Choose primary agent by context.
2. Record chosen agent, rationale, confidence, and fallback in bead summary.
3. If confidence is low or scope spans unrelated domains, split the bead or escalate to Architect.

Non-negotiable:
- Dynamic selection cannot bypass hard guardrails.

## 5. Branching & Commits
Convention: `<type>(bead-N): description`

Types: feat, optimization, fix, test, docs, chore.

Branch naming: `codex/feat/bead-N-description`, `codex/fix/...`, or `codex/chore/...`.

No direct commits to `main`. Keep `main` deployable. Squash merge only once a remote exists.

Remote: `https://github.com/apollostreetcompany/ezra.git`.

## 6. Continuity Ledger
Protocol for `CONTINUITY.md`:
- Read/update every turn.
- Keep exact required headings.
- Append key decisions; do not delete prior decisions.
- Beads are atomic work units; the ledger tracks current state and decisions.
- Start implementation/review replies with a Ledger Snapshot when practical.
- Mark unknowns as `UNCONFIRMED`.

## 7. Workflow

### Bead Entry Gate (Mandatory)

Before implementation starts:
1. Bead scope and acceptance tests are explicit.
2. Agent selected using Hybrid Agent Selection Policy.
3. Required tools declared.
4. Risk class declared as `Low`, `Medium`, or `High`.

Current bead:
- No active implementation bead. Next candidate is Bead 30 - LLM-backed verse collection tagger design.
- Workstream: research/docs until implementation is explicitly started.
- Risk: High if implemented because it would add schema, ingestion, tagging provenance, and public query-contract decisions.
- Agent: Primary Codex for product analysis; Architect -> domain Engineer -> Analyst required before implementation.
- Tools: RepoPrompt for code maps, docs validation for process updates, and full workspace verification once code begins.

### Bead Exit Gate (Mandatory)

Before bead complete:
1. Required tests pass for risk class.
2. Reviewer checklist completed: completeness, quality, consistency, tests, security.
3. `CONTINUITY.md` updated.
4. `handoff/beads.jsonl` updated.
5. Chat bead summary posted.

Validation matrix:
- `code`: lint/format checks; relevant unit/integration tests; risk-class test scope.
- `docs/process`: docs validation; internal path verification; policy consistency check.
- `design/ui`: screenshot or visual evidence for changed launch pages.
- `research/analysis`: source list and assumptions labeled.
- `ops/deploy`: deploy preflight, runtime/port binding verification, health check, rollback path.

Risk/test matrix:
- `Low`: changed-module checks only.
- `Medium`: changed-module checks plus relevant integration/contract tests.
- `High`: full required suite, security/contract checks, and reviewer sign-off before merge.

## 8. Orchestration

### Spawn Contract (Mandatory)

Each spawned agent prompt must include:
1. Owned files/paths.
2. In-scope and out-of-scope work.
3. Required tools and constraints.
4. Acceptance tests and expected outputs.
5. Report with changes, tests, assumptions/risks, and follow-up recommendations.

### Escalation Rules

Architect sign-off required before implementation if:
1. Public API shape changes.
2. Data schema/migration changes.
3. Policy/security model semantics change.
4. Deployment architecture/runtime behavior changes.

## Safety
- Do not exfiltrate private data.
- Do not print Stripe, Cloudflare, Klaviyo, JWT, private key, or Ezra token secrets.
- Do not apply remote D1 migrations until `ezra-mcp-prod` has a distinct database id.
- Prefer recoverable delete flows when feasible.
- Ask when risk is unclear.
