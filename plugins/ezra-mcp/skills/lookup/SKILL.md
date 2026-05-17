---
name: ezra-mcp-lookup
description: Use Ezra MCP hosted tools to retrieve exact Bible verses, chapters, topics, stories, parables, related topic names, and curated Jesus beliefs or commands.
---

# Ezra MCP Lookup

Use this skill when the user asks for Bible verses, themes, stories, parables, topic lookup, chapter lookup, exact references, or Jesus' beliefs and commands through Ezra MCP.

## Tooling

Prefer the configured `ezra-mcp` MCP server. The hosted tool surface includes:

- `get_verses_by_topic`
- `list_topics`
- `get_pericope`
- `find_topic`
- `get_related_topics`
- `get_jesus_teachings`
- `get_verse`
- `get_chapter`

## Rules

- Retrieve verse text through Ezra MCP instead of inventing or paraphrasing verses.
- If a topic is unknown, call `find_topic` before guessing.
- Use exact references returned by the tool in user-facing answers.
- For prompts about Jesus' beliefs, commands, teachings, or a daily rule of life, call `get_jesus_teachings` with `mode: "beliefs"`, `mode: "commands"`, or `mode: "both"`.
- Do not claim natural-language semantic search; v1 uses curated topic/pericope data and D1 lookup tables.
