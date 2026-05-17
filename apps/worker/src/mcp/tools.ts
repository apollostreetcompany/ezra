import type {
  McpEnv,
  McpToolError,
  PericopeRow,
  TopicRow,
  VerseRow
} from "./types.js";
import {
  createVerseCollection,
  findVerseCollections,
  getVerseCollection
} from "../collections.js";

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
    name: "get_jesus_teachings",
    description:
      "Return a curated starter set of Jesus' beliefs, commands, or both, grounded in explicit Gospel references. Use this for prompts asking for Jesus' beliefs, commands, teachings, or a day-to-day rule of life.",
    inputSchema: {
      type: "object",
      properties: {
        mode: {
          type: "string",
          enum: ["beliefs", "commands", "both"],
          default: "both",
          description: "Choose beliefs, commands, or both."
        }
      }
    }
  },
  {
    name: "create_verse_collection",
    description:
      "Create a custom verse collection. Stores only verse references, a bible_version identifier, API.Bible tags, and global tags; it does not store verse text.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        visibility: { type: "string", enum: ["private", "unlisted", "public"], default: "private" },
        bible_version: { type: "string", description: "Bible/API.Bible version id or abbreviation, e.g. WEB or de4e12af7f28f599-02." },
        verse_refs: { type: "array", items: { type: "string" }, minItems: 1 },
        api_bible_tags: { type: "array", items: { type: "string" } },
        global_tags: { type: "array", items: { type: "string" } }
      },
      required: ["title", "verse_refs"]
    }
  },
  {
    name: "get_verse_collection",
    description:
      "Return a custom verse collection by id. Private collections are visible only to their owner; public and unlisted collections are visible by id. Returns refs and tags, not verse text.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" }
      },
      required: ["id"]
    }
  },
  {
    name: "find_verse_collections",
    description:
      "Find public and owned custom verse collections by API.Bible tag or global tag. Returns refs, bible_version, and tags, not verse text.",
    inputSchema: {
      type: "object",
      properties: {
        tag: { type: "string" },
        tag_source: { type: "string", enum: ["api_bible", "global"] },
        bible_version: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 20 }
      }
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
    case "get_jesus_teachings":
      return getJesusTeachings(env, args);
    case "create_verse_collection":
      return createCollectionTool(env, args);
    case "get_verse_collection":
      return getCollectionTool(env, args);
    case "find_verse_collections":
      return findCollectionsTool(env, args);
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

async function createCollectionTool(env: McpEnv, args: Record<string, unknown>): Promise<unknown> {
  const userId = requireUserId(env);
  try {
    const collection = await createVerseCollection(env.DB, userId, args);
    return { collection };
  } catch (error) {
    throw collectionToolError(error);
  }
}

async function getCollectionTool(env: McpEnv, args: Record<string, unknown>): Promise<unknown> {
  const id = requireString(args, "id");
  const collection = await getVerseCollection(env.DB, id, env.userId);
  if (!collection) {
    throw toolError({
      code: "collection_not_found",
      message: `No accessible verse collection '${id}'.`,
      recoverable: true
    });
  }
  return { collection };
}

async function findCollectionsTool(env: McpEnv, args: Record<string, unknown>): Promise<unknown> {
  try {
    const collections = await findVerseCollections(env.DB, args, env.userId);
    return { collections };
  } catch (error) {
    throw collectionToolError(error);
  }
}

type JesusTeachingMode = "beliefs" | "commands" | "both";

interface JesusTeachingSeed {
  kind: "belief" | "command";
  title: string;
  summary: string;
  daily_practice?: string;
  source_refs: string[];
  themes: string[];
}

const JESUS_BELIEF_TEACHINGS: JesusTeachingSeed[] = [
  {
    kind: "belief",
    title: "God's Kingdom is near and should come first.",
    summary: "Jesus announces God's Kingdom as present and urgent, then teaches people to seek that Kingdom before lesser anxieties.",
    daily_practice: "Ask what faithfulness to God's Kingdom looks like before choosing what to chase today.",
    source_refs: ["Mark 1:15", "Matthew 6:33"],
    themes: ["Kingdom", "Faith", "Priority"]
  },
  {
    kind: "belief",
    title: "God is a Father who knows and provides.",
    summary: "Jesus describes God as the Father who knows needs before prayer and cares for ordinary life.",
    daily_practice: "Bring needs to God without performing, then act from trust rather than panic.",
    source_refs: ["Matthew 6:8", "Matthew 6:26", "Matthew 7:11"],
    themes: ["Father's Love", "Prayer", "Trusting God"]
  },
  {
    kind: "belief",
    title: "Love of God and neighbor sums up the law.",
    summary: "Jesus treats wholehearted love for God and neighbor-love as the center that holds the law and prophets together.",
    daily_practice: "Measure decisions by whether they deepen love for God and concrete love for another person.",
    source_refs: ["Matthew 22:37", "Matthew 22:38", "Matthew 22:39", "Matthew 22:40"],
    themes: ["Love", "Obedience", "Worship"]
  },
  {
    kind: "belief",
    title: "Mercy is central to true righteousness.",
    summary: "Jesus repeatedly cites mercy as a priority over religious posturing or hard-hearted judgment.",
    daily_practice: "Choose the merciful action before the image-preserving one.",
    source_refs: ["Matthew 9:13", "Matthew 12:7"],
    themes: ["Mercy", "Humility", "Judgment"]
  },
  {
    kind: "belief",
    title: "People are known by fruit, not claims alone.",
    summary: "Jesus teaches that true discipleship is visible in good fruit and in doing the Father's will.",
    daily_practice: "Look for the fruit of today's choices: truth, love, obedience, mercy, and humility.",
    source_refs: ["Matthew 7:16", "Matthew 7:21", "Matthew 7:24"],
    themes: ["Faith and Works", "Obedience", "Wisdom"]
  },
  {
    kind: "belief",
    title: "Greatness looks like service.",
    summary: "Jesus frames his own mission as service and self-giving, not domination.",
    daily_practice: "Take the lower seat and do one useful act that costs you attention or comfort.",
    source_refs: ["Mark 10:43", "Mark 10:44", "Mark 10:45"],
    themes: ["Serving Others", "Humility", "Leadership"]
  },
  {
    kind: "belief",
    title: "Life is found in Jesus.",
    summary: "Jesus identifies himself as the way, truth, life, resurrection, and source of fruitful living.",
    daily_practice: "Stay close to Jesus' words before trying to manufacture spiritual fruit.",
    source_refs: ["John 11:25", "John 11:26", "John 14:6", "John 15:5"],
    themes: ["Identity in Christ", "Hope", "Resurrection"]
  }
];

const JESUS_COMMAND_TEACHINGS: JesusTeachingSeed[] = [
  {
    kind: "command",
    title: "Repent and believe the Good News.",
    summary: "Turn around and entrust yourself to the good news of God's Kingdom.",
    daily_practice: "Name one place to turn from sin or despair, and one place to trust God today.",
    source_refs: ["Mark 1:15"],
    themes: ["Repentance", "Faith"]
  },
  {
    kind: "command",
    title: "Love God with your whole self.",
    summary: "Love God with heart, soul, and mind.",
    daily_practice: "Offer attention, desire, thought, and action to God rather than only words.",
    source_refs: ["Matthew 22:37", "Matthew 22:38"],
    themes: ["Love", "Worship", "Obedience"]
  },
  {
    kind: "command",
    title: "Love your neighbor as yourself.",
    summary: "Treat the good of another person as something bound up with your own life.",
    daily_practice: "Choose one neighbor and do the next concrete good you already know to do.",
    source_refs: ["Matthew 22:39", "Matthew 22:40"],
    themes: ["Love", "Community", "Kindness"]
  },
  {
    kind: "command",
    title: "Love one another as Jesus loved.",
    summary: "Jesus gives his disciples a new commandment shaped by his own self-giving love.",
    daily_practice: "Let Jesus' manner of love, not only your feelings, define the standard.",
    source_refs: ["John 13:34", "John 13:35", "John 15:12"],
    themes: ["Love", "Community", "Obedience"]
  },
  {
    kind: "command",
    title: "Love enemies and pray for persecutors.",
    summary: "Jesus extends love beyond friends to enemies, cursers, haters, and persecutors.",
    daily_practice: "Pray honestly for one difficult person without rehearsing revenge.",
    source_refs: ["Matthew 5:44", "Matthew 5:45"],
    themes: ["Love", "Prayer", "Peacemaking"]
  },
  {
    kind: "command",
    title: "Forgive others.",
    summary: "Jesus links receiving mercy with becoming merciful toward those who wrong us.",
    daily_practice: "Release one debt you keep using to justify bitterness, while still acting wisely.",
    source_refs: ["Matthew 6:14", "Matthew 6:15"],
    themes: ["Forgiveness", "Forgiving Others Who Hurt You"]
  },
  {
    kind: "command",
    title: "Pray simply and dependently.",
    summary: "Jesus teaches prayer that honors the Father, asks for daily bread, seeks forgiveness, and asks for deliverance.",
    daily_practice: "Pray through the Lord's Prayer slowly enough to turn each line into trust.",
    source_refs: ["Matthew 6:9", "Matthew 6:10", "Matthew 6:11", "Matthew 6:12", "Matthew 6:13"],
    themes: ["Prayer", "Father's Love", "Forgiveness", "Temptation"]
  },
  {
    kind: "command",
    title: "Seek God's Kingdom first.",
    summary: "Jesus commands a reordered life where God's Kingdom and righteousness outrank anxious striving.",
    daily_practice: "Before solving a worry, ask what righteousness requires in the situation.",
    source_refs: ["Matthew 6:33"],
    themes: ["Faith", "Trusting God", "Anxiety"]
  },
  {
    kind: "command",
    title: "Do to others what you want done to you.",
    summary: "Jesus gives a practical summary of neighbor-love in the Golden Rule.",
    daily_practice: "Before speaking or acting, ask whether you would receive that same action as love.",
    source_refs: ["Matthew 7:12"],
    themes: ["Kindness", "Love", "Wisdom"]
  },
  {
    kind: "command",
    title: "Be merciful.",
    summary: "Jesus calls people to reflect the mercy of the Father.",
    daily_practice: "Make room for compassion before critique.",
    source_refs: ["Luke 6:36"],
    themes: ["Mercy", "Love"]
  },
  {
    kind: "command",
    title: "Serve people in need.",
    summary: "Jesus identifies care for the hungry, stranger, naked, sick, and imprisoned as service rendered to him.",
    daily_practice: "Move one need from sympathy to action.",
    source_refs: ["Matthew 25:35", "Matthew 25:36", "Matthew 25:37", "Matthew 25:38", "Matthew 25:39", "Matthew 25:40"],
    themes: ["Serving Others", "Mercy", "Judgment"]
  },
  {
    kind: "command",
    title: "Hear Jesus' words and do them.",
    summary: "Jesus compares obedience to building a house on rock and connects love for him with keeping his commandments.",
    daily_practice: "Pick one command of Jesus and obey it in a visible, specific way today.",
    source_refs: ["Matthew 7:24", "John 14:15"],
    themes: ["Obedience", "Faith and Works", "Wisdom"]
  }
];

async function getJesusTeachings(env: McpEnv, args: Record<string, unknown>): Promise<unknown> {
  const rawMode = typeof args.mode === "string" && args.mode.trim() ? args.mode.trim().toLowerCase() : "both";
  if (!["beliefs", "commands", "both"].includes(rawMode)) {
    throw toolError({
      code: "invalid_mode",
      message: "mode must be 'beliefs', 'commands', or 'both'.",
      recoverable: true
    });
  }
  const mode = rawMode as JesusTeachingMode;
  const payload: Record<string, unknown> = {
    mode,
    scope: "curated starter set, not an exhaustive list of every saying of Jesus",
    note: "Use source_refs and source_verses to ground a concise answer. Beliefs are teachings or claims Jesus affirmed; commands are imperatives or practices Jesus gave."
  };
  if (mode === "beliefs" || mode === "both") {
    payload.beliefs = await hydrateJesusTeachings(env, JESUS_BELIEF_TEACHINGS);
  }
  if (mode === "commands" || mode === "both") {
    payload.commands = await hydrateJesusTeachings(env, JESUS_COMMAND_TEACHINGS);
  }
  return payload;
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

async function hydrateJesusTeachings(
  env: McpEnv,
  teachings: JesusTeachingSeed[]
): Promise<Array<Record<string, unknown>>> {
  const refs = uniqueStrings(teachings.flatMap((teaching) => teaching.source_refs));
  const verses = await fetchVerses(env, refs);
  const versesByRef = new Map(verses.map((verse) => [verse.ref, verse]));
  return teachings.map((teaching) => ({
    kind: teaching.kind,
    title: teaching.title,
    summary: teaching.summary,
    daily_practice: teaching.daily_practice,
    source_refs: teaching.source_refs,
    source_verses: teaching.source_refs
      .map((ref) => versesByRef.get(ref))
      .filter((verse): verse is VerseRow => Boolean(verse))
      .map((verse) => ({ ref: verse.ref, text: verse.text })),
    themes: teaching.themes
  }));
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

function requireUserId(env: McpEnv): string {
  if (!env.userId) {
    throw toolError({
      code: "unauthorized",
      message: "This tool requires an authenticated Ezra MCP API key.",
      recoverable: false
    });
  }
  return env.userId;
}

function collectionToolError(error: unknown): ToolError {
  const code = error instanceof Error ? error.message : "collection_error";
  const recoverableCodes = new Set([
    "title_required",
    "bible_version_required",
    "verse_refs_required",
    "invalid_visibility",
    "invalid_tag_source"
  ]);
  return toolError({
    code,
    message: collectionErrorMessage(code),
    recoverable: recoverableCodes.has(code)
  });
}

function collectionErrorMessage(code: string): string {
  switch (code) {
    case "title_required":
      return "title is required.";
    case "bible_version_required":
      return "bible_version is required.";
    case "verse_refs_required":
      return "verse_refs must include at least one canonical reference.";
    case "invalid_visibility":
      return "visibility must be 'private', 'unlisted', or 'public'.";
    case "invalid_tag_source":
      return "tag_source must be 'api_bible' or 'global'.";
    default:
      return code;
  }
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
