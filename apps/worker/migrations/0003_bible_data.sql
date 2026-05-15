-- Ezra MCP: bible data tables. Seeded once from ezra-bible-data JSON outputs.
--
-- These three tables back the MCP tool surface. All lookups are by primary key
-- or covered index. No JOINs in the hot path.

CREATE TABLE IF NOT EXISTS topics (
  name TEXT PRIMARY KEY,
  category TEXT NOT NULL,            -- 'theme' | 'story' | 'parable'
  verse_count INTEGER NOT NULL,
  verse_refs TEXT NOT NULL           -- JSON array of "Book ch:vs" strings
);

CREATE INDEX IF NOT EXISTS idx_topics_category ON topics (category);

CREATE TABLE IF NOT EXISTS verses (
  ref TEXT PRIMARY KEY,              -- e.g., "John 3:16"
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  text TEXT NOT NULL,
  topics TEXT NOT NULL,              -- JSON array
  pericopes TEXT NOT NULL            -- JSON array
);

CREATE INDEX IF NOT EXISTS idx_verses_book_chapter ON verses (book, chapter, verse);

CREATE TABLE IF NOT EXISTS pericopes (
  name TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  book TEXT,
  verse_range TEXT NOT NULL,
  verse_refs TEXT NOT NULL,
  topics TEXT NOT NULL
);

-- Usage tracking: one row per (user_id, month). Reset on new month.
CREATE TABLE IF NOT EXISTS usage_counters (
  user_id TEXT NOT NULL,
  period_yyyy_mm TEXT NOT NULL,      -- "2026-05"
  call_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, period_yyyy_mm)
);

CREATE INDEX IF NOT EXISTS idx_usage_period ON usage_counters (period_yyyy_mm);

-- API keys: thin wrapper over device_tokens; an API key IS a device token
-- with scope 'mcp:call'. Keeping the same table avoids schema churn.
-- (No new table needed; we reuse device_tokens with the 'mcp:call' scope.)
