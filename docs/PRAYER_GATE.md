# Prayer Gate

Prayer Gate is a premium opt-in personal attestation gate for Git push.

It must never claim to verify prayer, never pray on the user's behalf, and never state that a successful push proves the user prayed.

## Required Disclaimer
```text
Prayer Gate is a personal attestation. Bible Coder cannot verify private prayer and does not pray on your behalf.
To continue, type exactly: I have prayed
```

## Commands
- `bible-coder block enable`
- `bible-coder block disable`
- `bible-coder block status`
- `bible-coder block test`
- `bible-coder block prompt --remote origin --url git@github.com:org/repo.git`
- `bible-coder block doctor`

Current implementation status:
- `block enable` installs a local `pre-push` hook only after cached premium entitlement is present.
- `block disable` restores the previous hook where a backup exists, or removes the Bible Coder hook if no previous hook was present.
- `block test` and `block prompt` require the exact attestation text.
- `block doctor` checks Codex, Claude Code, and Gemini CLI prompt-hook configuration without mutating those files.
- MCP exposes only read-only `block_status`; hook mutation remains CLI-only.

## Hook Behavior
Before push, the hook:
1. Detects repo root, branch, remote, and pending refs from stdin.
2. Displays a local WEB/KJV verse or short prayer prompt.
3. Reads attestation from `/dev/tty`, not stdin.
4. Continues only if the user types exactly `I have prayed`.
5. Exits non-zero for any other input.
6. Writes a local-only TSV log entry with timestamp, repo hash, branch, and commit SHA.
7. Replays Git's pending refs stdin to the previous hook when a previous hook was wrapped.

The hook uses local WEB/KJV only in v1, even for paid users, to avoid API.Bible and FUMS complexity in the Git path.

## Install Hardening
- If `core.hooksPath` is unset, install into `.git/hooks/pre-push`.
- If an existing hook exists, move it to `.git/hooks/pre-push.bible-coder-backup.<timestamp>` and create a wrapper that runs Prayer Gate first, then the previous hook.
- If `core.hooksPath` is set, install into that configured directory only after showing the target path.
- Never overwrite without backup.
- Never install unless premium entitlement is active or within a short cached grace period.
- Never block push because the entitlement server is temporarily unreachable after install.
- `block disable` restores the prior hook where possible.

## Entitlement
Prayer Gate is premium. Entitlement is checked at enable time and refreshed by normal sync.

The local entitlement cache may allow a 7-day grace period. After grace expiry, the hook should print that Prayer Gate is disabled until login/sync, then allow the push rather than surprising the user with a paid-feature outage.

The current CLI enablement gate accepts cached entitlement through `BIBLE_CODER_PREMIUM=true`, `BIBLE_CODER_ENTITLEMENT=active`, or `BIBLE_CODER_PREMIUM_GRACE_UNTIL=<ISO timestamp>` until server entitlement refresh is wired into normal CLI sync.

## Server Surfaces
- `GET /v1/block/entitlement`
- `GET /v1/block/settings`
- `PUT /v1/block/settings`
- `POST /v1/prayer-attestations`

Attestation sync is off by default. `/v1/prayer-attestations` accepts only privacy-minimal metadata after `syncAttestations` is explicitly enabled: timestamp, repo hash, branch, and commit SHA. It does not store the attestation phrase or claim prayer was verified.

## Future Hard Mode
Future hard mode should be a GitHub App that sets a required commit status after a local attestation token is minted. The status must be described as `attestation received`, not `prayer verified`.
