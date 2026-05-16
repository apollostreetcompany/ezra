# Ezra MCP Client Docs

Ezra MCP exposes a hosted HTTP MCP endpoint:

```text
https://ezramcp.com/v1/mcp
```

Every `tools/call` request requires:

```http
Authorization: Bearer ezra_live_...
```

## Codex Plugin

The repo-local plugin lives at:

```text
plugins/ezra-mcp
```

It declares the stdio bridge:

```json
{
  "mcpServers": {
    "ezra-mcp": {
      "command": "ezra-mcp-mcp"
    }
  }
}
```

## Local Bridge Setup

```sh
make link-local
ezra-mcp login --email you@example.com
ezra-mcp login --email you@example.com --code <code>
ezra-mcp key create
```

The bridge reads `EZRA_MCP_API_KEY` or the saved local key.

## Tool Surface

- `get_verses_by_topic`
- `list_topics`
- `get_pericope`
- `find_topic`
- `get_related_topics`
- `get_verse`
- `get_chapter`

V1 uses curated topics, pericopes, references, and exact verse text from D1 lookup tables.
