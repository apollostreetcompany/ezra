# Ezra MCP V1 Plan

Ezra MCP v1 is a hosted HTTP MCP product with a repo-local Codex plugin and local stdio bridge.

## In Scope

- Cloudflare Worker API at `https://ezramcp.com`.
- Static launch/account/docs pages served from the same Worker through static assets.
- D1 lookup tables for verses, topics, pericopes, usage, auth, and billing state.
- CLI commands: `setup`, `login`, `key create`, `status`, `checkout`, `billing portal`.
- Stdio bridge command: `ezra-mcp-mcp`.
- Stripe Checkout and Billing Portal for Pro/Max.
- Magic-link identity reuse by normalized email.

## Out of Scope

- Graph databases.
- Vector search until natural-language search is a real product request.
- Local reading-plan state.
- Prompt hooks.
- Any separate local server package.

## Acceptance

- `pnpm verify` passes.
- No active package, plugin, script, or launch doc references old project surfaces.
- Remote deployment remains blocked until Ezra D1 id, Stripe prices, secrets, DNS, and webhook are confirmed.
