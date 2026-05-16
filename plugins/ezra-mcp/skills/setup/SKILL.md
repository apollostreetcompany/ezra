---
name: ezra-mcp-setup
description: Set up the Ezra MCP CLI, magic-link login, local API key storage, and MCP bridge configuration for Codex or another MCP client.
---

# Ezra MCP Setup

Use this skill when the user wants Ezra MCP installed, configured, or connected to an MCP client.

## Workflow

1. Build/link the local CLI and bridge when working from the repo:

```bash
pnpm --filter @ezra-mcp/cli build
pnpm --filter @ezra-mcp/mcp build
./scripts/link-local-bin.sh
```

2. Initialize local config:

```bash
ezra-mcp setup
```

3. Request and verify a magic link:

```bash
ezra-mcp login --email you@example.com
ezra-mcp login --email you@example.com --code <code>
```

4. Create the MCP API key:

```bash
ezra-mcp key create
```

5. Configure the MCP client with the plugin `.mcp.json` or by using command `ezra-mcp-mcp`.

## Safety

- Do not print saved session tokens or full `ezra_live_...` API keys in chat or logs.
- Prefer `EZRA_MCP_CONFIG_DIR` for tests and temporary setups.
- Use `EZRA_MCP_API_URL` only when targeting a non-production local Worker.
