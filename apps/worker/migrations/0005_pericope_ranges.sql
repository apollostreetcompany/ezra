-- Pericope names are canonical labels and may span multiple verse ranges.
-- Store each (name, verse_range) segment instead of forcing name uniqueness.

CREATE TABLE IF NOT EXISTS pericopes_v2 (
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  book TEXT,
  verse_range TEXT NOT NULL,
  verse_refs TEXT NOT NULL,
  topics TEXT NOT NULL,
  PRIMARY KEY (name, verse_range)
);

INSERT OR IGNORE INTO pericopes_v2 (name, category, book, verse_range, verse_refs, topics)
  SELECT name, category, book, verse_range, verse_refs, topics FROM pericopes;

DROP TABLE IF EXISTS pericopes;

ALTER TABLE pericopes_v2 RENAME TO pericopes;

CREATE INDEX IF NOT EXISTS idx_pericopes_name ON pericopes (name);
