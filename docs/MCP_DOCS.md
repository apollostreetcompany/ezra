# Bibe Code MCP Docs

Bibe Code exposes a local MCP server through the `bible-coder-mcp` binary.

## Install

```bash
pnpm add -g bible-coder
bible-coder setup
```

The first run configures the free goal, cloud sync when available, and asks whether to install ambient coda hooks for Codex, Claude Code, and Gemini CLI. Those hooks are the default way to show a verse in every supported coding session.

## Codex

```bash
codex mcp add bible-coder -- bible-coder-mcp
```

## Claude Code

```bash
claude mcp add bible-coder bible-coder-mcp
```

## Gemini CLI

```bash
gemini mcp add bible-coder bible-coder-mcp
```

## Free Tools

- `bible_get_passage`
- `bible_search`
- `plan_create`
- `session_coda`
- `progress_status`
- `review_next`
- `sync_status`

## Pro Tools

- `billing_checkout`
- `block_status`

Goals are free. Pro gates custom bibles, `/block`, and future leaderboard features.

Paid Bible text is not returned inline to model-visible MCP output by default.

`session_coda` is the MCP-side primitive for an ambient verse. When called with `record: true`, it displays the next local goal verse and advances local progress.

Prefer prompt hooks when the client supports them:

```bash
bible-coder hooks install --client all --scope user --mode coda --yes
bible-coder hooks doctor --client all
```
