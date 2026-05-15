SHELL := /bin/bash

.PHONY: verify validate-docs validate-plugin secret-scan drizzle-check worker-check lint test build dev link-local cli-help cli-read cli-coda cli-hooks-doctor cli-block-status live-api-bible-smoke live-stripe-smoke release-check

verify: validate-docs validate-plugin secret-scan build drizzle-check worker-check lint test

validate-docs:
	./scripts/validate-docs.sh

validate-plugin:
	@if [ -f package.json ]; then pnpm validate:plugin; else echo "No package.json yet; skipping plugin validation."; fi

secret-scan:
	@if [ -f package.json ]; then pnpm secret:scan; else echo "No package.json yet; skipping secret scan."; fi

drizzle-check:
	@if [ -f apps/server/package.json ]; then pnpm --filter @ezra-mcp/server drizzle:check; else echo "No server package yet; skipping Drizzle check."; fi

worker-check:
	@if [ -f apps/worker/package.json ]; then pnpm --filter @ezra-mcp/worker lint; else echo "No worker package yet; skipping Worker check."; fi

lint:
	@if [ -f package.json ]; then pnpm lint; else echo "No package.json yet; skipping lint."; fi

test:
	@if [ -f package.json ]; then pnpm test; else echo "No package.json yet; skipping tests."; fi

build:
	@if [ -f package.json ]; then pnpm build; else echo "No package.json yet; skipping build."; fi

dev:
	@if [ -f package.json ]; then pnpm dev; else echo "No package.json yet; no dev server configured."; fi

link-local:
	./scripts/link-local-bin.sh

cli-help:
	@if [ -f package.json ]; then pnpm --filter @ezra-mcp/cli build && node packages/cli/dist/bin.js help; else echo "No package.json yet; CLI not configured."; fi

cli-read:
	@if [ -f package.json ]; then pnpm --filter @ezra-mcp/cli build && node packages/cli/dist/bin.js read John 3:16 --translation web; else echo "No package.json yet; CLI not configured."; fi

cli-coda:
	@if [ -f package.json ]; then pnpm --filter @ezra-mcp/cli build && node packages/cli/dist/bin.js coda; else echo "No package.json yet; CLI not configured."; fi

cli-hooks-doctor:
	@if [ -f package.json ]; then pnpm --filter @ezra-mcp/cli build && node packages/cli/dist/bin.js hooks doctor --client all; else echo "No package.json yet; CLI not configured."; fi

cli-block-status:
	@if [ -f package.json ]; then pnpm --filter @ezra-mcp/cli build && node packages/cli/dist/bin.js block status; else echo "No package.json yet; CLI not configured."; fi

live-api-bible-smoke:
	@if [ -f .env.local ]; then set -a; source .env.local; set +a; pnpm --filter @ezra-mcp/server exec tsx ../../scripts/live-api-bible-smoke.ts; else echo "Missing .env.local with API_BIBLE_KEY."; exit 1; fi

live-stripe-smoke:
	@if [ -f /Users/kikimac/.hermes/.env ]; then set -a; source /Users/kikimac/.hermes/.env; [ -f .env.local ] && source .env.local; set +a; UPDATE_ENV_LOCAL=true pnpm --filter @ezra-mcp/server exec tsx ../../scripts/live-stripe-smoke.ts; else echo "Missing /Users/kikimac/.hermes/.env with STRIPE_SECRET_KEY."; exit 1; fi

release-check: verify cli-read cli-block-status
