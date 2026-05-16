import type {
  McpEnv,
  McpToolError,
  PericopeRow,
  TopicRow,
  VerseRow
} from "./types.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_verses_by_topic",
    description:
      "Return verses associated with a Bible topic. Use list_topics or find_topic first if you are unsure of the exact topic name (case-sensitive).",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Exact topic name, e.g. 'Faith'" },
        limit: { type: "integer", minimum: 1, maximum: 200, default: 20 }
      },
      required: ["topic"]
    }
  },
  {
    name: "list_topics",
    description:
      "List all available topics. Filter by category ('theme', 'story', or 'parable') for narrower results.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["theme", "story", "parable"] },
        limit: { type: "integer", minimum: 1, maximum: 500, default: 100 }
      }
    }
  },
  {
    name: "get_pericope",
    description:
      "Return a named pericope (a coherent story or parable) with all its verses, topics, and verse range.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Exact pericope name" }
      },
      required: ["name"]
    }
  },
  {
    name: "find_topic",
    description:
      "Fuzzy search for topic names by substring. Returns up to 10 matches ranked by relevance. Use this before get_verses_by_topic if you are not sure of the exact name.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search substring (case-insensitive)" }
      },
      required: ["query"]
    }
  },
  {
    name: "get_related_topics",
    description:
      "Return topics that co-occur with the given topic across its verses, ranked by frequency. Useful for discovering thematic neighbors.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 10 }
      },
      required: ["topic"]
    }
  },
  {
    name: "get_verse",
    description: "Look up a single verse by reference (e.g. 'John 3:16').",
    inputSchema: {
      type: "object",
      properties: {
        ref: { type: "string", description: "Reference like 'John 3:16'" }
      },
      required: ["ref"]
    }
  },
  {
    name: "get_chapter",
    description: "Return every verse in a chapter, plus pericopes that touch that chapter.",
    inputSchema: {
      type: "object",
      properties: {
        book: { type: "string", description: "Book name, e.g. 'John'" },
        chapter: { type: "integer", minimum: 1 }
      },
      required: ["book", "chapter"]
    }
  }
];

export async function dispatchTool(
  env: McpEnv,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "get_verses_by_topic":
      return getVersesByTopic(env, args);
    case "list_topics":
      return listTopics(env, args);
    case "get_pericope":
      return getPericope(env, args);
    case "find_topic":
      return findTopic(env, args);
    case "get_related_topics":
      return getRelatedTopics(env, args);
    case "get_verse":
      return getVerse(env, args);
    case "get_chapter":
      return getChapter(env, args);
    default:
      throw toolError({
        code: "unknown_tool",
        message: `Unknown tool: ${name}. Call tools/list to see available tools.`,
        recoverable: false
      });
  }
}

async function getVersesByTopic(env: McpEnv, args: Record<string, unknown>): Promise<unknown> {
  const topic = requireString(args, "topic");
  const limit = clampInt(args.limit, 1, 200, 20);
  const row = await env.DB
    .prepare("SELECT name, category, verse_count, verse_refs FROM topics WHERE name = ?")
    .bind(topic)
    .first<TopicRow>();
  if (!row) {
    throw toolError({
      code: "topic_not_found",
      message: `No topic named '${topic}'. Topic names are case-sensitive. Try find_topic to discover similar names.`,
      recoverable: true,
      suggested_tool_calls: [{ name: "find_topic", args: { query: topic } }]
    });
  }
  const refs = parseJsonArray(row.verse_refs).slice(0, limit);
  if (refs.length === 0) {
    return [];
  }
  const verses = await fetchVerses(env, refs);
  return verses.map(formatVerse);
}

async function listTopics(env: McpEnv, args: Record<string, unknown>): Promise<unknown> {
  const category = typeof args.category === "string" ? args.category : null;
  const limit = clampInt(args.limit, 1, 500, 100);
  if (category && !["theme", "story", "parable"].includes(category)) {
    throw toolError({
      code: "invalid_category",
      message: `Invalid category '${category}'. Use 'theme', 'story', or 'parable', or omit to list all.`,
      recoverable: true
    });
  }
  const query = category
    ? "SELECT name, category, verse_count FROM topics WHERE category = ? ORDER BY verse_count DESC LIMIT ?"
    : "SELECT name, category, verse_count FROM topics ORDER BY verse_count DESC LIMIT ?";
  const stmt = category
    ? env.DB.prepare(query).bind(category, limit)
    : env.DB.prepare(query).bind(limit);
  const result = await stmt.all<TopicRow>();
  return (result.results ?? []).map((row) => ({
    name: row.name,
    category: row.category,
    verse_count: row.verse_count
  }));
}

async function getPericope(env: McpEnv, args: Record<string, unknown>): Promise<unknown> {
  const name = requireString(args, "name");
  const result = await env.DB
    .prepare("SELECT name, category, book, verse_range, verse_refs, topics FROM pericopes WHERE name = ? ORDER BY verse_range ASC")
    .bind(name)
    .all<PericopeRow>();
  const rows = result.results ?? [];
  if (rows.length === 0) {
    throw toolError({
      code: "pericope_not_found",
      message: `No pericope named '${name}'. Pericope names are case-sensitive and usually a phrase like 'Anointing of David'.`,
      recoverable: true
    });
  }
  const refs = uniqueStrings(rows.flatMap((row) => parseJsonArray(row.verse_refs)));
  const verses = refs.length > 0 ? await fetchVerses(env, refs) : [];
  const topics = uniqueStrings(rows.flatMap((row) => parseJsonArray(row.topics)));
  const segments = rows.map((row) => {
    const segmentRefs = parseJsonArray(row.verse_refs);
    const segmentRefSet = new Set(segmentRefs);
    return {
      book: row.book,
      verse_range: row.verse_range,
      verse_refs: segmentRefs,
      topics: parseJsonArray(row.topics),
      verses: verses
        .filter((verse) => segmentRefSet.has(verse.ref))
        .map((verse) => ({ ref: verse.ref, text: verse.text }))
    };
  });
  return {
    name,
    category: rows[0]?.category,
    book: uniqueStrings(rows.map((row) => row.book).filter((book): book is string => Boolean(book))).join("; ") || null,
    verse_range: rows.map((row) => row.verse_range).join("; "),
    verse_refs: refs,
    topics,
    segments,
    verses: verses.map((verse) => ({ ref: verse.ref, text: verse.text }))
  };
}

async function findTopic(env: McpEnv, args: Record<string, unknown>): Promise<unknown> {
  const query = requireString(args, "query").trim();
  if (!query) {
    throw toolError({
      code: "empty_query",
      message: "Query must be a non-empty string.",
      recoverable: true
    });
  }
  const like = `%${query.toLowerCase()}%`;
  const result = await env.DB
    .prepare(
      "SELECT name, category, verse_count FROM topics WHERE LOWER(name) LIKE ? ORDER BY verse_count DESC LIMIT 10"
    )
    .bind(like)
    .all<TopicRow>();
  const lowered = query.toLowerCase();
  return (result.results ?? []).map((row) => ({
    name: row.name,
    category: row.category,
    verse_count: row.verse_count,
    score: scoreMatch(row.name.toLowerCase(), lowered)
  }));
}

async function getRelatedTopics(env: McpEnv, args: Record<string, unknown>): Promise<unknown> {
  const topic = requireString(args, "topic");
  const limit = clampInt(args.limit, 1, 50, 10);
  const row = await env.DB
    .prepare("SELECT verse_refs FROM topics WHERE name = ?")
    .bind(topic)
    .first<{ verse_refs: string }>();
  if (!row) {
    throw toolError({
      code: "topic_not_found",
      message: `No topic named '${topic}'. Try find_topic to discover similar names.`,
      recoverable: true,
      suggested_tool_calls: [{ name: "find_topic", args: { query: topic } }]
    });
  }
  const refs = parseJsonArray(row.verse_refs).slice(0, 50);
  if (refs.length === 0) {
    return [];
  }
  const verses = await fetchVerses(env, refs);
  const counts = new Map<string, number>();
  for (const verse of verses) {
    for (const other of parseJsonArray(verse.topics)) {
      if (other === topic) continue;
      counts.set(other, (counts.get(other) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, co_occurrence_count: count }));
}

async function getVerse(env: McpEnv, args: Record<string, unknown>): Promise<unknown> {
  const ref = requireString(args, "ref").trim();
  const row = await env.DB
    .prepare("SELECT ref, book, chapter, verse, text, topics, pericopes FROM verses WHERE ref = ?")
    .bind(ref)
    .first<VerseRow>();
  if (!row) {
    throw toolError({
      code: "verse_not_found",
      message: `No verse '${ref}'. Expected format like 'John 3:16'. Book names use full names (e.g. '1 Corinthians' not '1 Cor').`,
      recoverable: true
    });
  }
  return formatVerse(row);
}

async function getChapter(env: McpEnv, args: Record<string, unknown>): Promise<unknown> {
  const book = requireString(args, "book").trim();
  const chapter = clampInt(args.chapter, 1, 200, NaN);
  if (!Number.isFinite(chapter)) {
    throw toolError({
      code: "invalid_chapter",
      message: "chapter must be a positive integer.",
      recoverable: true
    });
  }
  const result = await env.DB
    .prepare(
      "SELECT ref, book, chapter, verse, text, topics, pericopes FROM verses WHERE book = ? AND chapter = ? ORDER BY verse ASC"
    )
    .bind(book, chapter)
    .all<VerseRow>();
  const rows = result.results ?? [];
  if (rows.length === 0) {
    throw toolError({
      code: "chapter_not_found",
      message: `No verses found for '${book}' chapter ${chapter}. Use full book names (e.g. '1 Corinthians' not '1 Cor').`,
      recoverable: true
    });
  }
  const pericopeNames = new Set<string>();
  for (const row of rows) {
    for (const name of parseJsonArray(row.pericopes)) {
      pericopeNames.add(name);
    }
  }
  return {
    book,
    chapter,
    verses: rows.map((row) => ({
      ref: row.ref,
      verse: row.verse,
      text: row.text,
      topics: parseJsonArray(row.topics)
    })),
    pericopes_in_chapter: [...pericopeNames]
  };
}

async function fetchVerses(env: McpEnv, refs: string[]): Promise<VerseRow[]> {
  if (refs.length === 0) return [];
  const placeholders = refs.map(() => "?").join(",");
  const result = await env.DB
    .prepare(
      `SELECT ref, book, chapter, verse, text, topics, pericopes FROM verses WHERE ref IN (${placeholders})`
    )
    .bind(...refs)
    .all<VerseRow>();
  const byRef = new Map<string, VerseRow>();
  for (const row of result.results ?? []) {
    byRef.set(row.ref, row);
  }
  const ordered: VerseRow[] = [];
  for (const ref of refs) {
    const row = byRef.get(ref);
    if (row) ordered.push(row);
  }
  return ordered;
}

function formatVerse(row: VerseRow): Record<string, unknown> {
  return {
    ref: row.ref,
    book: row.book,
    chapter: row.chapter,
    verse: row.verse,
    text: row.text,
    topics: parseJsonArray(row.topics),
    pericopes: parseJsonArray(row.pericopes)
  };
}

function parseJsonArray(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function requireString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.length === 0) {
    throw toolError({
      code: "missing_argument",
      message: `Argument '${key}' is required and must be a non-empty string.`,
      recoverable: true
    });
  }
  return value;
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const num = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(num)));
}

function scoreMatch(haystack: string, needle: string): number {
  if (haystack === needle) return 1;
  if (haystack.startsWith(needle)) return 0.8;
  if (haystack.includes(` ${needle}`)) return 0.6;
  return 0.4;
}

export class ToolError extends Error {
  readonly payload: McpToolError;

  constructor(payload: McpToolError) {
    super(payload.message);
    this.payload = payload;
  }
}

export function toolError(payload: McpToolError): ToolError {
  return new ToolError(payload);
}
