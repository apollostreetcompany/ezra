# Ezra MCP — HTTP MCP Server

Ezra MCP is an HTTP-only [Model Context Protocol](https://spec.modelcontextprotocol.io/specification/) server that exposes Bible verses tagged by **topic**, **story**, and **parable**. It runs on Cloudflare Workers with a D1-backed catalog of 386 topics, 23,399 verses, and 709 pericopes (WEB translation).

## Endpoint

```
POST https://api.ezra-mcp.com/v1/mcp
Content-Type: application/json
Authorization: Bearer <api-key>
```

All requests use JSON-RPC 2.0 over HTTP. The server speaks MCP protocol version `2025-06-18`.

## Authentication

Every call must include an API key in the `Authorization` header. To get one:

1. `POST /v1/magic-links/request` with `{ "email": "you@example.com" }`.
2. `POST /v1/magic-links/verify` with the code — returns a short-lived session token.
3. `POST /v1/api-keys` with the session token in `Authorization: Bearer …` — returns your MCP API key (`ezra_live_…`). Store this; it does not rotate automatically.

Anonymous calls receive a JSON-RPC result with `isError: true`, code `unauthorized`, and HTTP 401.

## JSON-RPC methods

| Method | Notes |
|---|---|
| `initialize` | Returns `protocolVersion`, capabilities, and `serverInfo`. Free, does not count against quota. |
| `tools/list` | Returns the 7 tools with their JSON Schema. Free. |
| `tools/call` | Invokes one tool. **Counts against your monthly quota.** |

## The 7 tools

| Tool | Purpose |
|---|---|
| `get_verses_by_topic(topic, limit?)` | Verses associated with a topic. |
| `list_topics(category?, limit?)` | Browse topics, optionally filtered by `theme` / `story` / `parable`. |
| `get_pericope(name)` | Named story or parable with its full text. |
| `find_topic(query)` | Case-insensitive substring search over topic names. |
| `get_related_topics(topic, limit?)` | Topics that co-occur with the given topic across its verses. |
| `get_verse(ref)` | Single verse by reference, e.g. `John 3:16`. |
| `get_chapter(book, chapter)` | All verses in a chapter, plus pericopes that touch it. |

Each tool's response is a single MCP text-content block whose `text` is the JSON-stringified payload. On failure, `isError: true` and the text contains `{code, message, recoverable, suggested_tool_calls?}`.

## Rate limits

Counted per-user per-calendar-month (UTC). The counter resets on the 1st.

| Tier | Calls / month | How to enable |
|---|---|---|
| `free` | 20 | Default for every new account. |
| `pro` | 10,000 | Subscribe via `POST /v1/checkout/session` with `{ "tier": "pro" }`. |
| `max` | 100,000 | Subscribe via `POST /v1/checkout/session` with `{ "tier": "max" }`. |

When you exceed the quota, `tools/call` returns HTTP 429 with a tool error containing `code: "rate_limit_exceeded"`, `tier`, `limit`, `used`, and `upgrade_url`.

## Example

```bash
curl -sS https://api.ezra-mcp.com/v1/mcp \
  -H 'authorization: Bearer ezra_live_…' \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": { "name": "get_verse", "arguments": { "ref": "John 3:16" } }
  }'
```
