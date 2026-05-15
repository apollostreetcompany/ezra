# Privacy

Bible Coder stores the minimum data needed for sync, billing, entitlements, progress, reviews, and optional leaderboard participation.

## Local Data
- Auth token: `~/.config/bible-coder/auth.json`, mode `0600`.
- Local state: `~/.config/bible-coder/state.sqlite`, mode `0600`.

## Tokens
Device sync tokens are opaque long-lived tokens:

```text
bc_live_<prefix>_<random_256_bits>
```

The server stores only `SHA256(TOKEN_HASH_PEPPER + token)`.

## Prayer Gate
Prayer Gate does not verify prayer. Local attestation logs, if enabled, should store only timestamp, repo hash, branch, and commit SHA. Prayer details do not sync by default.

Server attestation sync is opt-in through `/v1/block/settings`. When enabled, the server accepts only timestamp, repo hash, branch, and commit SHA. It does not store the attestation phrase.

## Leaderboard
Leaderboard participation is off by default. When enabled, public leaderboard entries expose only:
- Display name
- Completed progress count

Leaderboard output must not expose user IDs, device IDs, plan IDs, references, branch names, repo hashes, prayer details, or Scripture text.

## Paid Scripture
Paid API.Bible text is display-only and is redacted from model-visible MCP outputs by default.
