-- Custom verse collections store references and version identifiers only.
-- Verse text is resolved from licensed/public-domain sources at read time by clients,
-- not persisted in user-created collection rows.

CREATE TABLE IF NOT EXISTS verse_collections (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'unlisted', 'public')),
  bible_version TEXT NOT NULL,
  verse_refs TEXT NOT NULL,
  api_bible_tags TEXT NOT NULL,
  global_tags TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(owner_user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_verse_collections_owner_updated
  ON verse_collections(owner_user_id, updated_at);

CREATE INDEX IF NOT EXISTS idx_verse_collections_visibility_updated
  ON verse_collections(visibility, updated_at);

CREATE TABLE IF NOT EXISTS verse_collection_tag_index (
  collection_id TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'unlisted', 'public')),
  tag_source TEXT NOT NULL CHECK (tag_source IN ('api_bible', 'global')),
  tag TEXT NOT NULL,
  normalized_tag TEXT NOT NULL,
  bible_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (collection_id, tag_source, normalized_tag)
);

CREATE INDEX IF NOT EXISTS idx_verse_collection_tag_public
  ON verse_collection_tag_index(tag_source, normalized_tag, visibility, bible_version);

CREATE INDEX IF NOT EXISTS idx_verse_collection_tag_owner
  ON verse_collection_tag_index(owner_user_id, tag_source, normalized_tag);
