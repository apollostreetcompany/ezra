# Bibe Code Installation

## Recommended Path

Install the CLI package with pnpm, then run setup:

```sh
pnpm add --global bible-coder
bible-coder setup
```

The CLI is the source of truth for first-run setup. It creates the local profile, saves the private sync token after cloud login, creates the free goal plan, and can later configure MCP clients.

The Codex plugin should point first-time users to the same setup command. The plugin adds Codex-facing prompts and skills; the pnpm-installed CLI/MCP binaries provide the shared behavior across Codex, Claude Code, Gemini CLI, and terminal use.

During setup, answer yes when Bibe Code asks:

```text
Install ambient Bible coda hooks for Codex, Claude Code, and Gemini CLI? [Y/n]
```

That writes backed-up user config files for supported local clients:

```text
~/.codex/hooks.json
~/.claude/settings.json
~/.gemini/settings.json
```

After that, open a new Codex, Claude Code, or Gemini CLI session. Codex may ask you to review/trust the hook once via `/hooks`. The verse coda should appear at session start and after each prompt turn without asking for `/biblegoal`.

## Free Goals

Goals are free. They use local plan state and local WEB/KJV references.

```sh
bible-coder goal
bible-coder goal update --goal "Read Luke before standup"
```

MCP clients can use:

```text
goal_status
goal_update
```

These tools read or update the same local goal state. They do not return paid API.Bible text.

## Cloud Setup

Cloud setup logs in before checking the premium Bible catalog. An empty catalog does not cancel setup because goals and sync are still useful without custom Bible access.

```sh
BIBLE_CODER_API_URL=https://api.bibecoder.com bible-coder setup
```

The token is saved in:

```text
~/.config/bible-coder/auth.json
```

The token is not printed. Keep this file private.

## Premium Features

The only paid v1 features are:

- Custom/premium Bibles after API.Bible licensing approval.
- Prayer Gate `/block`.
- Future leaderboard features.

Reading local WEB/KJV, creating goals, viewing progress, and using basic reviews are free.

## Local Development Install

From the repository root:

```sh
pnpm install
make link-local
bible-coder setup
```

`pnpm --filter @bible-coder/cli link --global` does not work with pnpm 10 in this workspace. `make link-local` builds the CLI and MCP packages, then links `bible-coder` and `bible-coder-mcp` into `~/.local/bin` by default.

## Ambient Coda Primitive

The human-visible per-prompt building block is:

```sh
bible-coder hooks run --client codex --event UserPromptSubmit --mode coda --record
```

It emits hook-safe JSON with `systemMessage`, prints the next verse from the current free goal, and records local progress so the next coda advances. Agent-client prompt hooks call this as a side command instead of making the main assistant ask the user for `/biblegoal`.

Manual hook commands:

```sh
bible-coder hooks doctor --client all
bible-coder hooks install --client all --scope user --mode coda --yes
bible-coder hooks uninstall --client all --scope user --yes
```
