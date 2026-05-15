# Bibe Code Site Deployment

The site lives in `apps/site` and builds to static files in `apps/site/dist`.

## Build

```bash
pnpm --dir apps/site lint
pnpm --dir apps/site test
pnpm --dir apps/site build
```

## Deploy

Use Cloudflare Pages for `bibecoder.com`.

```bash
pnpm --dir apps/site build
wrangler pages deploy apps/site/dist --project-name bibecoder
```

Cloudflare assumptions:

- `bibecoder.com` is on Cloudflare DNS.
- Pages project name: `bibecoder`.
- Production branch: `main`.
- Build command: `pnpm --dir apps/site build`.
- Build output directory: `apps/site/dist`.

## Routes

- `/` landing page
- `/docs/` free install
- `/pro/` upgrade
- `/mcp/` MCP setup
- `/privacy/` privacy basics
- `/terms/` terms basics

## Rollback

Use the Cloudflare Pages deployment list and promote the previous deployment.
