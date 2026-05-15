# Release Checklist

## Required Validation
- `make release-check`
- `pnpm --filter @bible-coder/server drizzle:check`
- MCP stdio smoke with `initialize` and `tools/list`
- MCP tool docs checked against `docs/MCP_TOOL_REFERENCE.md`
- `make live-api-bible-smoke` in a secret-safe local environment
- `make live-stripe-smoke` in a secret-safe local environment
- Stripe CLI price lookup for `bible_coder_premium_monthly`
- Secret scan passes
- Plugin manifest validation passes

## Launch Gates
- API.Bible confirms the commercial subscription model in writing.
- API.Bible confirms exact premium translations allowed for this app.
- API.Bible confirms overage pricing and license brackets.
- API.Bible confirms FUMS handling for CLI, MCP, and native-style display.
- API.Bible confirms cache semantics for repeated display from cache.
- Stripe live-mode webhook and entitlement tests pass.
- Paid text remains blocked from AI prompts and model-visible MCP outputs by tests.
- Prayer Gate copy states only personal attestation, never verification.
- Existing pre-push hooks are preserved by install and uninstall tests.
- Docs clearly state `/block` is bypassable local soft mode unless future hard mode is configured.

## Deployment Preflight
- Confirm `pnpm-lock.yaml` matches package manifests.
- Confirm Render service binds `0.0.0.0:$PORT`.
- Confirm `/health` responds after deploy.
- Confirm rollback path in Render is available.
- Confirm premium API.Bible catalog feature flag remains disabled until written approval is attached.
