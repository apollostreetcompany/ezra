---
name: ezra-mcp-lookup
description: Use Ezra MCP hosted tools to retrieve exact Bible verses, chapters, topics, stories, parables, and related topic names.
---

# Ezra MCP Lookup

Use this skill when the user asks for Bible verses, themes, stories, parables, topic lookup, chapter lookup, or exact references through Ezra MCP.

## Tooling

Prefer the configured `ezra-mcp` MCP server. The hosted tool surface includes:

- `get_verses_by_topic`
- `list_topics`
- `get_pericope`
- `find_topic`
- `get_related_topics`
- `get_verse`
- `get_chapter`

## Rules

- Retrieve verse text through Ezra MCP instead of inventing or paraphrasing verses.
- If a topic is unknown, call `find_topic` before guessing.
- Use exact references returned by the tool in user-facing answers.
- Do not claim natural-language semantic search; v1 uses curated topic/pericope data and D1 lookup tables.
