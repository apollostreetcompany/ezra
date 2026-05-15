#!/usr/bin/env node
/**
 * Build a single SQL file that seeds D1 with the Bible data.
 * Run AFTER copying the three JSON files into apps/worker/data/.
 *
 *   pnpm --filter @ezra-mcp/worker run seed:build
 *
 * Then apply with:
 *   wrangler d1 execute ezra-mcp-prod --file=seed.sql --remote
 *
 * Output: apps/worker/seed.sql (gitignored — large generated artifact).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "..", "data");
const OUT_FILE = resolve(__dirname, "..", "seed.sql");

const VERSES_PATH = resolve(DATA_DIR, "bible_verses.json");
const TOPICS_PATH = resolve(DATA_DIR, "bible_topics.json");
const PERICOPES_PATH = resolve(DATA_DIR, "bible_pericopes.json");
const TEXTS_PATH = resolve(DATA_DIR, "web_text.json"); // {ref: text}

for (const p of [VERSES_PATH, TOPICS_PATH, PERICOPES_PATH]) {
  if (!existsSync(p)) {
    console.error(`Missing input: ${p}`);
    console.error("Copy bible_verses.json, bible_topics.json, bible_pericopes.json into apps/worker/data/");
    process.exit(1);
  }
}

const verses = JSON.parse(readFileSync(VERSES_PATH, "utf8"));
const topics = JSON.parse(readFileSync(TOPICS_PATH, "utf8"));
const pericopes = JSON.parse(readFileSync(PERICOPES_PATH, "utf8"));
const texts = existsSync(TEXTS_PATH) ? JSON.parse(readFileSync(TEXTS_PATH, "utf8")) : {};

const sqlEsc = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const j = (v) => sqlEsc(JSON.stringify(v));

const lines = [
  "-- Auto-generated. Do not edit. Re-run scripts/build_seed_sql.mjs.",
  "BEGIN TRANSACTION;",
  "DELETE FROM topics;",
  "DELETE FROM verses;",
  "DELETE FROM pericopes;",
];

// topics
for (const [name, info] of Object.entries(topics)) {
  lines.push(
    `INSERT INTO topics (name, category, verse_count, verse_refs) VALUES (${sqlEsc(name)}, ${sqlEsc(info.category)}, ${info.verse_count}, ${j(info.verse_refs || [])});`
  );
}

// verses (with text from web_text.json if available, else empty)
for (const v of verses) {
  const text = texts[v.ref] || "";
  lines.push(
    `INSERT INTO verses (ref, book, chapter, verse, text, topics, pericopes) VALUES (${sqlEsc(v.ref)}, ${sqlEsc(v.book)}, ${v.chapter}, ${v.verse}, ${sqlEsc(text)}, ${j(v.topics || [])}, ${j(v.pericopes || [])});`
  );
}

// pericopes
for (const p of pericopes) {
  lines.push(
    `INSERT INTO pericopes (name, category, book, verse_range, verse_refs, topics) VALUES (${sqlEsc(p.name)}, ${sqlEsc(p.category)}, ${p.book ? sqlEsc(p.book) : "NULL"}, ${sqlEsc(p.verse_range)}, ${j(p.verse_refs || [])}, ${j(p.topics || [])});`
  );
}

lines.push("COMMIT;");

writeFileSync(OUT_FILE, lines.join("\n") + "\n");
console.log(`wrote ${OUT_FILE}: ${Object.keys(topics).length} topics, ${verses.length} verses, ${pericopes.length} pericopes`);
