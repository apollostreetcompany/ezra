# Ezra MCP Site Deployment

Ezra uses Cloudflare Worker Static Assets so one Worker serves both:

- Site pages from `apps/site/dist`.
- API/MCP routes under `/v1/*` and `/health`.

`apps/worker/wrangler.jsonc` must include:

```json
{
  "assets": {
    "directory": "../site/dist",
    "binding": "ASSETS",
    "run_worker_first": ["/v1/*", "/health"]
  }
}
```

## Build

```sh
pnpm --filter @ezra-mcp/site build
pnpm --filter @ezra-mcp/worker build
```

## Deploy Gate

Do not deploy until:

- The D1 `database_id` is a distinct Ezra id.
- Stripe price ids are uploaded as Worker secrets.
- DNS for `ezramcp.com` points at the Worker.
- Stripe webhook target is `https://ezramcp.com/v1/stripe/webhook`.

## Rollback

Use Cloudflare Worker version rollback from the dashboard or redeploy the last known-good git commit.
