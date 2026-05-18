# Ezra MCP Tool Reference

Endpoint:

```text
POST https://ezramcp.com/v1/mcp
```

The request body is JSON-RPC 2.0. `initialize` and `tools/list` are unmetered; `tools/call` is metered by tier.

## Tools

### `get_verses_by_topic`

Input:

```json
{ "topic": "Anxiety", "limit": 10 }
```

Returns exact verse rows for a canonical topic.

### `list_topics`

Input:

```json
{ "category": "theme", "limit": 50 }
```

`category` is optional and may be `theme`, `story`, or `parable`.

### `get_pericope`

Input:

```json
{ "name": "Good Samaritan" }
```

Returns named story or parable metadata and verse refs.

### `find_topic`

Input:

```json
{ "query": "worry", "limit": 10 }
```

Returns matching canonical topic names.

### `get_related_topics`

Input:

```json
{ "topic": "Anxiety", "limit": 10 }
```

Returns nearby curated topics based on shared verse refs.

### `get_jesus_teachings`

Input:

```json
{ "mode": "both" }
```

`mode` may be `beliefs`, `commands`, or `both`. Returns a curated starter set for Jesus' beliefs and commands, with `source_refs` and exact source verses where available.

### `create_verse_collection`

Input:

```json
{
  "title": "Jesus commands",
  "visibility": "private",
  "bible_version": "WEB",
  "verse_refs": ["Matthew 22:37", "John 13:34"],
  "api_bible_tags": ["Jesus", "Commands"],
  "global_tags": ["daily-practice"]
}
```

Creates a custom collection owned by the API-key user. Stores only verse refs, the Bible version identifier, and tags; it does not store pasted verse text.

### `get_verse_collection`

Input:

```json
{ "id": "vcol_..." }
```

Returns an owned, public, or unlisted collection by id. Private collections require the owner API key.

### `find_verse_collections`

Input:

```json
{ "tag": "Jesus", "tag_source": "api_bible", "limit": 10 }
```

Finds public and owned collections by `api_bible` or `global` tag. Unlisted collections are accessible by id but do not appear in public tag search.

### `get_verse`

Input:

```json
{ "ref": "John 3:16" }
```

Returns one exact verse row.

### `get_chapter`

Input:

```json
{ "book": "John", "chapter": 3 }
```

Returns all verses in a chapter.

## Errors

Tool errors are returned as MCP text content containing structured JSON. Recoverable lookup errors include suggested follow-up calls, usually `find_topic`.

Rate-limit errors include `tier`, `limit`, `used`, and `upgrade_url`.
