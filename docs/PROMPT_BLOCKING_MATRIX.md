# Prompt Blocking Matrix

Prayer Gate prompt blocking is a premium personal attestation feature. It must never say Bible Coder verified prayer, and it must never say the AI prayed for the user.

## Current Capability Matrix

| Client | Prompt hook | V1 posture |
| --- | --- | --- |
| Codex CLI/app config | `SessionStart`, `UserPromptSubmit` | Ambient coda supported through `bible-coder hooks install --client codex --scope user --mode coda --yes`. Prompt blocking remains later. |
| Claude Code | `SessionStart`, `UserPromptSubmit` | Ambient coda supported through `bible-coder hooks install --client claude --scope user --mode coda --yes`. Prompt blocking can later use JSON `decision: "block"` or exit code 2. |
| Gemini CLI | `SessionStart`, `BeforeAgent` | Ambient coda installed as experimental through `bible-coder hooks install --client gemini --scope user --mode coda --yes`; `BeforeAgent` is the closest prompt-turn equivalent. |
| Claude desktop app | UNCONFIRMED | Do not claim prompt blocking unless it shares Claude Code hook configuration. |
| Gemini consumer app | UNCONFIRMED | Do not claim prompt blocking unless a documented hook surface is detected. |

Sources:

- Codex hooks: <https://developers.openai.com/codex/hooks>
- Claude Code hooks: <https://code.claude.com/docs/en/hooks>
- Gemini CLI hooks: <https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/writing-hooks.md> and <https://geminicli.com/docs/hooks/reference/>

## Runtime Rule

If a user has selected Pray, Read, or Both and the current client hook is not configured, startup must warn:

```text
Prayer Gate prompt blocking is requested, but this client is not protected yet.
Run bible-coder block doctor.
```

V1 must not silently mutate Codex, Claude, or Gemini hook files during package install. `bible-coder setup` may ask explicitly and install when the user answers yes. Manual installs should use `bible-coder hooks install ... --yes`; without `--yes`, the command previews target files and commands only.

## Ambient Coda

The first non-blocking prompt-hook command is:

```sh
bible-coder hooks run --client codex --event UserPromptSubmit --mode coda --record
```

It prints hook-safe JSON with `systemMessage`, not raw stdout. That keeps the verse human-visible without adding it to the model prompt. It reads the next local WEB/KJV goal verse and records progress locally so the following prompt can show the next verse. MCP clients may call `session_coda` with `record: true` for the same local progress behavior when a host does not support prompt hooks.

## Hook Semantics

Prompt blocking should use exact attestation text for Pray mode:

```text
I have prayed
```

For Read mode, the prompt hook can require a local WEB/KJV verse read attestation without calling API.Bible. Paid text must stay out of prompt-hook paths.

For Both mode, the hook requires both the displayed local verse prompt and exact personal prayer attestation.
