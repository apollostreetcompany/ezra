# Ezra MCP Live Smoke Testing

Live smoke tests must not print secrets or full API keys.

## Stripe Price Smoke

```sh
STRIPE_SECRET_KEY=... \
STRIPE_PRICE_EZRA_PRO_MONTHLY=price_... \
STRIPE_PRICE_EZRA_MAX_MONTHLY=price_... \
pnpm exec tsx scripts/live-stripe-smoke.ts
```

The script checks that Pro is active at $20/month USD and Max is active at $100/month USD.

## Local Worker Smoke

Check ports before starting Wrangler:

```sh
lsof -nP -iTCP:8787 -sTCP:LISTEN || true
pnpm --filter @ezra-mcp/site build
pnpm --filter @ezra-mcp/worker dev
```

In another shell:

```sh
curl -sS http://127.0.0.1:8787/health
```

## MCP Smoke

```sh
EZRA_MCP_API_URL=http://127.0.0.1:8787 ezra-mcp login --email you@example.com
EZRA_MCP_API_URL=http://127.0.0.1:8787 ezra-mcp login --email you@example.com --code <code>
EZRA_MCP_API_URL=http://127.0.0.1:8787 ezra-mcp key create
```

Then call `tools/list` through `ezra-mcp-mcp` with the saved key.
