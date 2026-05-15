# Claude MCP Install

Build the MCP package, then configure Claude to run:

```json
{
  "mcpServers": {
    "bible-coder": {
      "command": "bible-coder-mcp",
      "args": [],
      "env": {
        "BIBLE_CODER_API_URL": "https://your-bible-coder-server.example.com",
        "BIBLE_CODER_TOKEN": "bc_live_..."
      }
    }
  }
}
```

Paid API.Bible text is redacted from model-visible MCP outputs by default.

For full tool inputs, outputs, error shape, and policy notes, see `docs/MCP_TOOL_REFERENCE.md`.

## V1 Tools
- `bible_get_passage`
- `bible_search`
- `plan_create`
- `progress_record`
- `progress_status`
- `review_next`
- `billing_checkout`
- `sync_status`
- `block_status`

`block_status` is read-only. Bible Coder v1 intentionally does not expose `block_enable` or `block_disable` through MCP because hook mutation must stay CLI-only.

## Protocol Notes
The server uses MCP stdio: JSON-RPC messages are newline-delimited on stdin/stdout, and stdout contains only valid MCP messages. The implementation supports `initialize`, `ping`, `tools/list`, and `tools/call`.

Sources: [MCP lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle), [MCP tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
