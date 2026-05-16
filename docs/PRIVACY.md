# Ezra MCP Privacy

Ezra MCP stores only the data needed for login, API access, usage metering, billing, and support.

## Local Data

- Auth file: `~/.config/ezra-mcp/auth.json`, mode `0600`.
- Optional env override: `EZRA_MCP_CONFIG_DIR`.
- Local file contents are not uploaded by the CLI or bridge.

## Server Data

- Normalized email for login and checkout identity.
- Opaque token hashes and token prefixes.
- Stripe customer id and entitlement status.
- Monthly usage counter.
- Minimal audit records for billing/support events.

## Secrets

The Worker owns Stripe and Klaviyo secrets. The client stores only opaque session/API tokens. Do not paste long-lived tokens into chat, docs, screenshots, or issue trackers.
