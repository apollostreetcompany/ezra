---
name: plan-create
description: Create reference-first Bible reading plans for a user's goal without exposing paid Bible text to AI prompts.
---

# Plan Create

Use this skill when the user asks for a Bible reading plan, topical plan, memory verse plan, or spaced repetition review plan.

Plan generation policy:
- Generate plans from user goals, canonical references, themes/tags, schedule preferences, and progress history.
- Do not include paid API.Bible Scripture text, cached paid passage HTML, copyright fields, or FUMS tokens in prompts.
- Fetch display text only after the reference-first plan exists.
- Prefer deterministic, auditable plan structures over opaque prose.

Core commands:
- `bible-coder setup`
- `bible-coder goal`
- `bible-coder goal update --goal <goal>`
- `bible-coder plan create`
- `bible-coder review`
- `bible-coder progress`
