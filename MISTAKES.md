# MISTAKES.md - Bible Coder

## Mistakes To Avoid
- Do not commit directly to `main`.
- Do not expose API.Bible, Stripe, JWT, private key, or sync token secrets in logs, docs, tests, or CLI output.
- Do not claim the app verifies that a user prayed; Prayer Gate verifies only exact personal attestation text.
- Do not advertise a premium Bible catalog before API.Bible confirms commercial licensing terms.
- Do not send paid copyrighted Bible text to AI providers for plan generation.
- Do not silently overwrite existing Git hooks; Prayer Gate must preserve or wrap existing hooks reversibly.

## Lessons Learned This Session
- Proconsult browser automation was restored but produced only a shallow meta response for the planning pass; do not treat that run as an approving review.
- Stripe CLI v1.40 uses generic API calls such as `stripe get /v1/account`; do not assume unsupported resource-style commands or output flags without checking `stripe --help`.
- For Stripe CLI list filters, pass parameters with `-d`, for example `-d "lookup_keys[]=..."`; a raw query string can fail to filter as expected.
- Interactive CLI setup must be smoke-tested with piped stdin, not only mocked prompts; creating a new readline interface per prompt can drop buffered answers and leave top-level awaits unsettled.
- Wrangler v4.87 `d1 create` does not support `--json`; use normal output or `--update-config`, then inspect config for duplicate bindings.
- Cloudflare Worker upload can succeed while custom route creation fails if the API token lacks zone Workers Routes permission; deploy `workers.dev` first and add `api.bibecoder.com` after permissions are fixed.
- Secret scanners can flag realistic-looking test fixtures even when they are fake; prefer descriptive non-secret fixture strings such as `stripe_test_secret_key` and rerun `pnpm secret:scan`.
- Do not document `pnpm --filter @bible-coder/cli link --global`; pnpm 10 rejects that path in this workspace. Use `make link-local` or explicit symlinks into `~/.local/bin`.
- Do not emit ambient coda text as raw prompt-hook stdout by default; in Codex/Claude/Gemini hook paths that can become model-visible context. Use client-specific JSON and make model-visible context opt-in.
