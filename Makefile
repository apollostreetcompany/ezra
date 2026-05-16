SHELL := /bin/bash

.PHONY: verify validate-docs validate-plugin secret-scan worker-check seed-build lint test build dev link-local cli-help cli-status mcp-bridge-smoke live-stripe-smoke release-check

verify: validate-docs validate-plugin secret-scan build worker-check seed-build lint test

validate-docs:
	./scripts/validate-docs.sh

validate-plugin:
	@if [ -f package.json ]; then pnpm validate:plugin; else echo "No package.json yet; skipping plugin validation."; fi

secret-scan:
	@if [ -f package.json ]; then pnpm secret:scan; else echo "No package.json yet; skipping secret scan."; fi

worker-check:
	@if [ -f apps/worker/package.json ]; then pnpm --filter @ezra-mcp/worker lint; else echo "No worker package yet; skipping Worker check."; fi

seed-build:
	@if [ -f apps/worker/package.json ]; then pnpm --filter @ezra-mcp/worker seed:build; else echo "No worker package yet; skipping seed build."; fi

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

cli-status:
	@if [ -f package.json ]; then pnpm --filter @ezra-mcp/cli build && node packages/cli/dist/bin.js status; else echo "No package.json yet; CLI not configured."; fi

mcp-bridge-smoke:
	@if [ -f package.json ]; then pnpm --filter @ezra-mcp/mcp build && printf '{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n' | EZRA_MCP_CONFIG_DIR="$$(mktemp -d)" node packages/mcp/dist/server.js | grep -q '"code":-32001'; else echo "No package.json yet; MCP bridge not configured."; fi

live-stripe-smoke:
	@if [ -f /Users/kikimac/.hermes/.env ]; then set -a; source /Users/kikimac/.hermes/.env; [ -f .env.local ] && source .env.local; set +a; pnpm exec tsx scripts/live-stripe-smoke.ts; else echo "Missing /Users/kikimac/.hermes/.env with STRIPE_SECRET_KEY."; exit 1; fi

release-check: verify mcp-bridge-smoke
