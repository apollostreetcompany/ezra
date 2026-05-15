---
name: block
description: Manage Prayer Gate status and explain the CLI-only `/block` pre-push attestation workflow.
---

# Prayer Gate Block

Use this skill when the user asks about Bible Coder `/block` mode or Prayer Gate.

Prayer Gate is an opt-in premium personal attestation gate. It must never claim to verify prayer, never pray on the user's behalf, and never state that a successful push proves the user prayed.

Required disclaimer:

```text
Prayer Gate is a personal attestation. Bible Coder cannot verify private prayer and does not pray on your behalf.
To continue, type exactly: I have prayed
```

Mutation policy:
- Hook installation/removal is CLI-only in v1.
- MCP may expose read-only `block_status` only.
- Do not expose Prayer Gate enable or disable mutation tools through MCP in v1.
- Always require explicit user confirmation before modifying Git hooks.

Core commands:
- `bible-coder block enable`
- `bible-coder block disable`
- `bible-coder block status`
- `bible-coder block test`
- `bible-coder block prompt --remote origin --url git@github.com:org/repo.git`
