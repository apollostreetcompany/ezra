# Live Smoke Testing

These checks prove the local implementation can talk to API.Bible and Stripe without committing secrets.

## Secret Handling

Use ignored local env files only:

- Root `.env.local` for Bible Coder live smoke values.
- `/Users/kikimac/.hermes/.env` for existing Stripe and infrastructure keys.

Never commit either file. Keep local env files mode `0600`, and do not paste secret values into docs, logs, issues, or chat.

Root `.env.local` needs these values for API.Bible smoke testing:

```bash
API_BIBLE_KEY=...
API_BIBLE_BASE_URL=https://rest.api.bible/v1
BIBLE_CODER_ENABLE_PREMIUM_API_BIBLE=true
BIBLE_CODER_ALLOWED_PREMIUM_BIBLES=de4e12af7f28f599-02
BIBLE_CODER_CACHE_MODE=metadata-only
TOKEN_HASH_PEPPER=...
FUMS_USER_HASH_SECRET=...
```

`make live-stripe-smoke` reads `STRIPE_SECRET_KEY` from `/Users/kikimac/.hermes/.env` and writes or reuses `STRIPE_PRICE_PREMIUM_MONTHLY` in ignored root `.env.local` when the price smoke succeeds.

## API.Bible Smoke

Run:

```bash
make live-api-bible-smoke
```

What it verifies:

- The app uses `https://rest.api.bible/v1`.
- `/v1/bibles` returns the configured allowed Bible.
- `/v1/passages` can fetch a human-surface passage through the server.
- API.Bible attribution is present.
- FUMS token metadata is captured.
- Model-visible passage output redacts paid text.

Current sanitized result:

```json
{
  "biblesStatus": 200,
  "allowedBiblesReturned": 1,
  "passageStatus": 200,
  "reference": "John 3:16",
  "verseCount": 1,
  "copyrightPresent": true,
  "fumsTokenCaptured": true,
  "humanContentReturned": true,
  "modelStatus": 200,
  "modelTextRedacted": true
}
```

## Stripe Smoke

Run:

```bash
make live-stripe-smoke
```

What it verifies:

- Stripe CLI/SDK credentials can read the account.
- The `$10/month` premium price exists or is created with lookup key `bible_coder_premium_monthly`.
- The app can create a Stripe Checkout Session through `/v1/checkout/session`.
- The server Checkout flow uses the configured price, metadata, promotion-code setting, optional automatic tax setting, optional trial setting, and an idempotency key.

Current sanitized result:

```json
{
  "chargesEnabled": true,
  "lookupKey": "bible_coder_premium_monthly",
  "unitAmount": 1000,
  "currency": "usd",
  "checkoutStatus": 201,
  "checkoutUrlPresent": true
}
```

## Stripe CLI Price Lookup

The installed Stripe CLI supports generic API calls. Use:

```bash
set -a
source /Users/kikimac/.hermes/.env
set +a
stripe get /v1/prices \
  -d "lookup_keys[]=bible_coder_premium_monthly" \
  -d active=true \
  --limit 1 \
  --api-key "$STRIPE_SECRET_KEY" \
  --color off
```

Do not rely on a raw query string for list filters, old resource-style commands, or unsupported output-format flags without checking `stripe --help` first.

## Release Posture

Passing live smoke tests does not remove the premium catalog launch gate. Premium API.Bible catalog access remains disabled for public launch until written API.Bible confirmation covers commercial subscription use, exact translations, overage pricing, FUMS, caching, and model-visible MCP rules.

## CLI + Local Server Demo

This demo proves the branch works as a local product loop: start the server, issue a sync token through `login`, create a plan locally, record progress, upload it through `sync`, and request Stripe Checkout without printing the URL.

Check the port before starting the server:

```bash
lsof -nP -iTCP:3187 -sTCP:LISTEN || true
```

Start the server:

```bash
set -a
source .env.local
source /Users/kikimac/.hermes/.env
set +a
PORT=3187 pnpm --filter @bible-coder/server dev
```

In another terminal:

```bash
pnpm --filter @bible-coder/cli build

DEMO_CONFIG="$(mktemp -d /tmp/bible-coder-demo-XXXXXX)"
export BIBLE_CODER_CONFIG_DIR="$DEMO_CONFIG"
export BIBLE_CODER_API_URL="http://127.0.0.1:3187"

node packages/cli/dist/bin.js login --device-name "Codex demo"
node packages/cli/dist/bin.js read John 3:16 --translation web

PLAN_OUTPUT="$(node packages/cli/dist/bin.js plan create \
  --goal "peace before shipping" \
  --days 2 \
  --reference "John 3:16" \
  --reference "Romans 8:28")"
printf '%s\n' "$PLAN_OUTPUT"
PLAN_ID="$(printf '%s\n' "$PLAN_OUTPUT" | sed -n 's/^Created plan \([^:]*\):.*/\1/p')"

node packages/cli/dist/bin.js progress record --plan "$PLAN_ID" --reference "John 3:16"
node packages/cli/dist/bin.js progress --plan "$PLAN_ID"
node packages/cli/dist/bin.js sync
node packages/cli/dist/bin.js checkout | sed 's#^https://.*#Checkout URL generated (redacted)#'
```

For Codex MCP, configure the `bible-coder` MCP server with `BIBLE_CODER_API_URL=http://127.0.0.1:3187`. After `bible-coder login`, the MCP server reads the saved local sync token automatically. Do not paste the token into Codex chat.

Expected shape:

```text
Server sync token saved.
Token: stored locally and not printed.
Created plan plan_...
Recorded progress for John 3:16 (...)
##########---------- 50% (1/2)
Bible Coder sync connected.
Uploaded plans: 1
Uploaded progress events: 1
Server progress events: 1
Checkout URL generated (redacted)
```
