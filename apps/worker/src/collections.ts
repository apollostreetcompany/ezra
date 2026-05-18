import type { D1Database } from "./mcp/types.js";

export type CollectionVisibility = "private" | "unlisted" | "public";
export type CollectionTagSource = "api_bible" | "global";

export interface CollectionInput {
  title?: unknown;
  description?: unknown;
  visibility?: unknown;
  bible_version?: unknown;
  bibleVersion?: unknown;
  verse_refs?: unknown;
  verseRefs?: unknown;
  api_bible_tags?: unknown;
  apiBibleTags?: unknown;
  global_tags?: unknown;
  globalTags?: unknown;
}

export interface CollectionRow {
  id: string;
  owner_user_id: string;
  title: string;
  slug: string;
  description: string | null;
  visibility: CollectionVisibility;
  bible_version: string;
  verse_refs: string;
  api_bible_tags: string;
  global_tags: string;
  created_at: string;
  updated_at: string;
}

export interface CollectionSearchInput {
  tag?: unknown;
  tag_source?: unknown;
  tagSource?: unknown;
  bible_version?: unknown;
  bibleVersion?: unknown;
  limit?: unknown;
}

export interface CollectionPayload {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  visibility: CollectionVisibility;
  bible_version: string;
  verse_refs: string[];
  api_bible_tags: string[];
  global_tags: string[];
  created_at: string;
  updated_at: string;
  owner_self?: boolean;
}

interface NormalizedCollectionInput {
  title: string;
  slug: string;
  description: string | null;
  visibility: CollectionVisibility;
  bibleVersion: string;
  verseRefs: string[];
  apiBibleTags: string[];
  globalTags: string[];
}

export async function createVerseCollection(
  db: D1Database,
  ownerUserId: string,
  input: CollectionInput,
  now = new Date().toISOString()
): Promise<CollectionPayload> {
  const normalized = normalizeCollectionInput(input);
  const id = `vcol_${crypto.randomUUID()}`;
  const slug = `${normalized.slug}-${id.slice(-8)}`;
  await db
    .prepare(
      "INSERT INTO verse_collections (id, owner_user_id, title, slug, description, visibility, bible_version, verse_refs, api_bible_tags, global_tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      id,
      ownerUserId,
      normalized.title,
      slug,
      normalized.description,
      normalized.visibility,
      normalized.bibleVersion,
      JSON.stringify(normalized.verseRefs),
      JSON.stringify(normalized.apiBibleTags),
      JSON.stringify(normalized.globalTags),
      now,
      now
    )
    .run();
  await writeCollectionTags(db, {
    collectionId: id,
    ownerUserId,
    visibility: normalized.visibility,
    bibleVersion: normalized.bibleVersion,
    apiBibleTags: normalized.apiBibleTags,
    globalTags: normalized.globalTags,
    now
  });
  return {
    id,
    title: normalized.title,
    slug,
    description: normalized.description,
    visibility: normalized.visibility,
    bible_version: normalized.bibleVersion,
    verse_refs: normalized.verseRefs,
    api_bible_tags: normalized.apiBibleTags,
    global_tags: normalized.globalTags,
    created_at: now,
    updated_at: now,
    owner_self: true
  };
}

export async function getVerseCollection(
  db: D1Database,
  id: string,
  viewerUserId?: string
): Promise<CollectionPayload | null> {
  const row = await db
    .prepare(
      "SELECT id, owner_user_id, title, slug, description, visibility, bible_version, verse_refs, api_bible_tags, global_tags, created_at, updated_at FROM verse_collections WHERE id = ? AND (owner_user_id = ? OR visibility IN ('public', 'unlisted'))"
    )
    .bind(cleanId(id), viewerUserId ?? "")
    .first<CollectionRow>();
  return row ? formatCollection(row, viewerUserId) : null;
}

export async function findVerseCollections(
  db: D1Database,
  input: CollectionSearchInput,
  viewerUserId?: string
): Promise<CollectionPayload[]> {
  const tag = cleanOptionalText(input.tag, 80);
  const tagSource = normalizeTagSource(input.tag_source ?? input.tagSource, true);
  const bibleVersion = cleanOptionalText(input.bible_version ?? input.bibleVersion, 80);
  const limit = clampInt(input.limit, 1, 50, 20);
  let result: { results?: CollectionRow[] };
  if (tag) {
    const normalizedTag = normalizeTag(tag);
    const source = tagSource ?? "";
    const version = bibleVersion ?? "";
    result = await db
      .prepare(
        "SELECT DISTINCT vc.id, vc.owner_user_id, vc.title, vc.slug, vc.description, vc.visibility, vc.bible_version, vc.verse_refs, vc.api_bible_tags, vc.global_tags, vc.created_at, vc.updated_at FROM verse_collection_tag_index idx JOIN verse_collections vc ON vc.id = idx.collection_id WHERE idx.normalized_tag = ? AND (? = '' OR idx.tag_source = ?) AND (? = '' OR idx.bible_version = ?) AND (vc.owner_user_id = ? OR vc.visibility = 'public') ORDER BY vc.updated_at DESC LIMIT ?"
      )
      .bind(normalizedTag, source, source, version, version, viewerUserId ?? "", limit)
      .all<CollectionRow>();
  } else {
    result = await db
      .prepare(
        "SELECT id, owner_user_id, title, slug, description, visibility, bible_version, verse_refs, api_bible_tags, global_tags, created_at, updated_at FROM verse_collections WHERE owner_user_id = ? OR visibility = 'public' ORDER BY updated_at DESC LIMIT ?"
      )
      .bind(viewerUserId ?? "", limit)
      .all<CollectionRow>();
  }
  return (result.results ?? []).map((row) => formatCollection(row, viewerUserId));
}

export function normalizeCollectionInput(input: CollectionInput): NormalizedCollectionInput {
  const title = cleanRequiredText(input.title, 120, "title_required");
  const bibleVersion = cleanRequiredText(input.bible_version ?? input.bibleVersion ?? "WEB", 80, "bible_version_required");
  const verseRefs = cleanStringArray(input.verse_refs ?? input.verseRefs, 500, 80);
  if (verseRefs.length === 0) {
    throw new Error("verse_refs_required");
  }
  return {
    title,
    slug: slugify(title),
    description: cleanOptionalText(input.description, 500),
    visibility: normalizeVisibility(input.visibility),
    bibleVersion,
    verseRefs,
    apiBibleTags: cleanStringArray(input.api_bible_tags ?? input.apiBibleTags, 50, 80),
    globalTags: cleanStringArray(input.global_tags ?? input.globalTags, 50, 80)
  };
}

function formatCollection(row: CollectionRow, viewerUserId?: string): CollectionPayload {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    visibility: row.visibility,
    bible_version: row.bible_version,
    verse_refs: parseJsonArray(row.verse_refs),
    api_bible_tags: parseJsonArray(row.api_bible_tags),
    global_tags: parseJsonArray(row.global_tags),
    created_at: row.created_at,
    updated_at: row.updated_at,
    owner_self: Boolean(viewerUserId && row.owner_user_id === viewerUserId)
  };
}

async function writeCollectionTags(
  db: D1Database,
  input: {
    collectionId: string;
    ownerUserId: string;
    visibility: CollectionVisibility;
    bibleVersion: string;
    apiBibleTags: string[];
    globalTags: string[];
    now: string;
  }
): Promise<void> {
  for (const tag of input.apiBibleTags) {
    await insertCollectionTag(db, input, "api_bible", tag);
  }
  for (const tag of input.globalTags) {
    await insertCollectionTag(db, input, "global", tag);
  }
}

async function insertCollectionTag(
  db: D1Database,
  input: {
    collectionId: string;
    ownerUserId: string;
    visibility: CollectionVisibility;
    bibleVersion: string;
    now: string;
  },
  source: CollectionTagSource,
  tag: string
): Promise<void> {
  await db
    .prepare(
      "INSERT OR IGNORE INTO verse_collection_tag_index (collection_id, owner_user_id, visibility, tag_source, tag, normalized_tag, bible_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(
      input.collectionId,
      input.ownerUserId,
      input.visibility,
      source,
      tag,
      normalizeTag(tag),
      input.bibleVersion,
      input.now
    )
    .run();
}

function normalizeVisibility(value: unknown): CollectionVisibility {
  if (value === undefined || value === null || value === "") return "private";
  if (value === "private" || value === "unlisted" || value === "public") return value;
  throw new Error("invalid_visibility");
}

function normalizeTagSource(value: unknown, optional = false): CollectionTagSource | null {
  if ((value === undefined || value === null || value === "") && optional) return null;
  if (value === "api_bible" || value === "global") return value;
  throw new Error("invalid_tag_source");
}

function cleanRequiredText(value: unknown, maxLength: number, errorCode: string): string {
  const text = cleanOptionalText(value, maxLength);
  if (!text) throw new Error(errorCode);
  return text;
}

function cleanOptionalText(value: unknown, maxLength: number): string | null {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function cleanStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(
    value
      .map((item) => cleanOptionalText(item, maxLength))
      .filter((item): item is string => Boolean(item))
  ).slice(0, maxItems);
}

function parseJsonArray(value: string): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, "-");
}

function slugify(value: string): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "collection";
}

function cleanId(value: string): string {
  return value.trim().slice(0, 100);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null) return fallback;
  const num = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(num)));
}
