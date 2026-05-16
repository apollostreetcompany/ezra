# Ezra MCP Release Checklist

## Local Validation

```sh
pnpm verify
make release-check
```

Required checks:

- Docs validation.
- Plugin validation.
- Secret scan.
- Worker build/lint/test.
- CLI build/lint/test.
- MCP bridge build/lint/test.
- Site lint/test/build.
- Seed SQL build.

## Launch Blockers

- GitHub remote is configured.
- CI required checks are configured and passing.
- `apps/worker/wrangler.jsonc` has a real Ezra D1 `database_id`.
- `seed.sql` has been loaded into the Ezra D1 database only.
- Stripe Pro and Max price ids are set as Worker secrets.
- Stripe webhook target points at `https://ezramcp.com/v1/stripe/webhook`.
- `EZRA_MCP_UPGRADE_URL=https://ezramcp.com/pro/`.
- Site has been checked at 390px, 768px, and 1280px.

## Smoke

After deploy:

```sh
curl -sS https://ezramcp.com/health
curl -sS https://ezramcp.com/mcp/
```

Then create a test account, create an API key, call `tools/list`, start a test checkout, and confirm account status moves to the purchased tier.
