---
name: ezra-mcp-billing
description: Help users start Pro/Max checkout, verify account status, open the Stripe Billing Portal, and understand Ezra MCP rate limits.
---

# Ezra MCP Billing

Use this skill for Ezra MCP checkout, account, billing portal, entitlement, or rate-limit questions.

## Commands

```bash
ezra-mcp status
ezra-mcp checkout --tier pro
ezra-mcp checkout --tier max
ezra-mcp billing portal
```

## Tiers

- Free: 20 MCP `tools/call` requests per UTC month.
- Pro: 10,000 MCP `tools/call` requests per UTC month.
- Max: 100,000 MCP `tools/call` requests per UTC month.

## Safety

- Billing Portal URLs are short-lived and must be created server-side.
- Do not expose Stripe secret keys, webhook secrets, price ids from private environments, session tokens, or stored API keys.
- Checkout success can be verified through `/v1/checkout/session-status?session_id=...` if the webhook is delayed.
