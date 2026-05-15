---
name: bible-reading
description: Read local WEB/KJV Scripture, look up references, and display paid API.Bible passages only through Bible Coder policy-safe surfaces.
---

# Bible Reading

Use this skill when the user asks Bible Coder to read or look up a Bible passage.

Rules:
- Free local WEB/KJV text may be displayed inline.
- Paid API.Bible text must be fetched through the Bible Coder server and must not be inserted into AI planning prompts.
- In model-visible MCP contexts, paid API.Bible text is redacted by default. Return reference, translation, attribution, entitlement status, and a CLI render instruction instead.
- Every displayed API.Bible passage must include reference, translation abbreviation, and copyright/attribution metadata.
- Do not make licensing claims beyond the approved Bible catalog.

Core commands:
- `bible-coder setup`
- `bible-coder read <reference>`
- `bible-coder hooks doctor --client all`
- `bible-coder hooks install --client all --scope user --mode coda --yes`
- `bible-coder goal`
- `bible-coder progress`
- `bible-coder sync`
