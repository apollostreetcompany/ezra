# MCP Tool Reference

Bible Coder's MCP server is a portability layer for Codex, Claude, Gemini, and other MCP clients. It is not the trust boundary for local system mutation: v1 exposes only read or server-backed actions through MCP, and local Git hook mutation stays in the CLI.

## Setup

Build the MCP package and configure the client to run `bible-coder-mcp`.

Server-backed tools require:

```json
{
  "BIBLE_CODER_API_URL": "https://your-bible-coder-server.example.com"
}
```

Run `bible-coder login` once with `BIBLE_CODER_API_URL` set. The CLI saves the sync token in private local storage, and the MCP server reads that saved token automatically. You may also set `BIBLE_CODER_TOKEN` explicitly, but do not paste it into docs, chat, logs, or screenshots.

Free local WEB/KJV passage and plan tools can run without server env vars. Billing, sync, progress, and review tools return a structured `CONFIGURATION_ERROR` when the server URL or token is missing.

## Error Shape

Tool errors are returned as MCP tool results with `isError: true`, human-readable text, and machine-readable structured content:

```json
{
  "isError": true,
  "structuredContent": {
    "error": {
      "type": "CONFIGURATION_ERROR",
      "message": "Server-backed MCP tool requires BIBLE_CODER_API_URL and BIBLE_CODER_TOKEN.",
      "recoverable": true,
      "data": {
        "fix_hint": "Set BIBLE_CODER_API_URL and run bible-coder login to save a local sync token, or set BIBLE_CODER_TOKEN explicitly, then restart the MCP client."
      }
    }
  }
}
```

Error types:

- `CONFIGURATION_ERROR`: missing MCP server env vars.
- `INVALID_ARGUMENT`: missing required input or invalid input shape.
- `UPSTREAM_ERROR`: Bible Coder server or billing response issue.
- `INTERNAL_ERROR`: unexpected local MCP failure.

## Tools

### `bible_get_passage`

Gets a passage by reference.

Inputs:

- `reference` string, required. Example: `John 3:16`.
- `translation` string, optional. Use `web`, `kjv`, or an API.Bible Bible ID.

Behavior:

- Free local `web` and `kjv` return Scripture text inline with attribution.
- Paid API.Bible translations return reference, translation, entitlement/display metadata, and redaction status only. Paid text is not returned inline to model-visible MCP output by default.

Example:

```json
{
  "name": "bible_get_passage",
  "arguments": {
    "reference": "John 3:16",
    "translation": "web"
  }
}
```

### `bible_search`

Searches local WEB/KJV text or returns a redacted paid-search instruction.

Inputs:

- `query` string, required.
- `translation` string, optional.
- `limit` number, optional.

Behavior:

- Free local results include matching text and attribution.
- Paid API.Bible search snippets are redacted from MCP output by default.

### `plan_create`

Creates a reference-first reading plan.

Inputs:

- `goal` string, required.
- `title` string, optional.
- `days` number, optional.
- `references` string array, optional.

Behavior:

- The tool creates plan items from canonical references.
- It does not fetch paid Scripture text.
- It must not include API.Bible paid text, copyright metadata, FUMS tokens, or cached paid passage HTML in plan output.

### `session_coda`

Returns the next free local goal verse for an ambient prompt/session coda.

Inputs:

- `translation` string, optional. Use `web` or `kjv`.
- `record` boolean, optional. When true, mark the displayed local goal item complete.

Behavior:

- Uses local WEB/KJV only.
- Reads the same free local goal state as `bible-coder coda`.
- Advances progress locally when `record` is true so the next coda shows the next goal item.
- Does not fetch or return paid API.Bible text.

### `progress_record`

Records a progress event through the Bible Coder server.

Inputs:

- `planId` string, required.
- `referenceId` string, optional if `reference` is provided.
- `reference` string, optional if `referenceId` is provided.
- `action` string, optional. Defaults to `completed`.
- `idempotencyKey` string, optional.
- `occurredAt` string, optional ISO timestamp.
- `payload` object, optional.

Requires `BIBLE_CODER_API_URL` and `BIBLE_CODER_TOKEN`.

### `progress_status`

Reads progress events and returns a compact progress summary.

Inputs:

- `planId` string, optional.

Requires `BIBLE_CODER_API_URL` and `BIBLE_CODER_TOKEN`.

### `review_next`

Reads review events from the Bible Coder server. V1 reports synced review event state; deeper server-side next-review derivation is a later hardening pass.

Inputs: none.

Requires `BIBLE_CODER_API_URL` and `BIBLE_CODER_TOKEN`.

### `billing_checkout`

Creates a Stripe Checkout Session through the Bible Coder server.

Inputs:

- `successUrl` string, optional.
- `cancelUrl` string, optional.

Returns the Checkout URL only. It must not print Stripe secret keys, sync tokens, customer IDs, or webhook secrets.

Requires `BIBLE_CODER_API_URL` and `BIBLE_CODER_TOKEN`.

### `sync_status`

Checks whether the MCP server is configured and whether the Bible Coder server health endpoint is reachable.

Inputs: none.

### `block_status`

Reports Prayer Gate status and attestation copy.

Inputs: none.

Behavior:

- Read-only only.
- Does not install, disable, edit, or inspect Git hooks beyond reporting the static v1 MCP posture.
- Hook mutation stays CLI-only because MCP tool calls can be model-initiated.

## Common Mistakes

- Do not expose Prayer Gate hook mutation through MCP.
- Do not return paid API.Bible Scripture text inline to Claude, Gemini, Codex, or other model-visible MCP surfaces unless a future written policy explicitly permits it.
- Do not call premium passage text from `plan_create`; plans are reference-first.
- Do not include API.Bible keys, Stripe keys, sync tokens, FUMS tokens, or paid passage HTML in structured errors.
- Do not assume a Bible abbreviation is an API.Bible ID. Discover allowed Bible IDs through the server `/v1/bibles` route or API.Bible catalog tooling.
