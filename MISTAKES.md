# MISTAKES.md - Ezra MCP

## Mistakes To Avoid
- Do not commit directly to `main`.
- Do not deploy or seed Ezra against the inherited Bible Coder D1 database id.
- Do not expose Stripe, Cloudflare, Klaviyo, JWT, private key, session token, or `ezra_live_...` API key values in logs, docs, tests, or CLI output unless the explicit command purpose is to show a newly created key to a human.
- Do not keep active Bibe Code/Bible Coder branding, plugin paths, environment variables, or package names in Ezra launch surfaces.
- Do not add graphify to the v1 query path.
- Do not use raw long-lived Stripe Billing Portal URLs in static pages or email templates; always create short-lived portal sessions server-side.

## Lessons Learned This Session
- Ezra inherited the Bible Coder D1 `database_id`; database names are not enough. Verify the actual Cloudflare id before remote migration or seed.
- Full workspace validation can pass partially while stale workspace packages still break `pnpm test`/`pnpm build`; remove or fully rewrite inherited packages instead of leaving them half-renamed.
- Public checkout and account login must share a normalized email identity, otherwise a paid user can purchase on the site and later log in as a separate free user.
- Seed generation must not write blank verse text. If catalog refs have no WEB text, exclude them from generated seed output and record the exact refs for upstream data cleanup.
- Remote D1 import rejects explicit SQL transaction wrappers in uploaded seed files. Keep generated seed SQL free of raw `BEGIN TRANSACTION`/`COMMIT`.
- Pericope labels are not unique ids. Use `(name, verse_range)` for storage and aggregate repeated labels in `get_pericope`.
- Do not deploy routes while sourcing a limited Cloudflare API token from `.env`; use the Wrangler OAuth session when route/custom-domain permissions are needed.
- Wrangler `dev --var` values use `NAME:value` syntax in this environment; `NAME=value` is parsed as a malformed binding name and still leaves configured secrets missing.
- WEB text may contain inline footnote markers, including in familiar verses such as `John 3:16`; E2E assertions should validate references and durable text starts instead of brittle exact substrings across footnote boundaries.
