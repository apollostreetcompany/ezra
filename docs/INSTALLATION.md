# Ezra MCP Installation

## Local Development

From `/Users/kikimac/ezra-mcp`:

```sh
pnpm install
make link-local
ezra-mcp setup
```

`make link-local` builds `@ezra-mcp/cli` and `@ezra-mcp/mcp`, then links:

- `ezra-mcp`
- `ezra-mcp-mcp`

The default link directory is `~/.local/bin`. Override it with `EZRA_MCP_BIN_DIR`.

## Login and API Key

```sh
ezra-mcp login --email you@example.com
ezra-mcp login --email you@example.com --code <code>
ezra-mcp key create
ezra-mcp status
```

Local auth is stored in:

```text
~/.config/ezra-mcp/auth.json
```

The file is created with private permissions. The CLI does not print saved session tokens or saved API keys after creation.

## MCP Bridge

Use the stdio bridge command:

```sh
ezra-mcp-mcp
```

The bridge uses `EZRA_MCP_API_KEY` first. If that is absent, it reads the API key saved by `ezra-mcp key create`.

For local Worker testing:

```sh
EZRA_MCP_API_URL=http://127.0.0.1:8787 ezra-mcp status
```

## Checkout and Billing

```sh
ezra-mcp checkout --tier pro
ezra-mcp checkout --tier max
ezra-mcp billing portal
```

Billing Portal URLs are generated server-side and are short-lived.
