import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "src");

const requiredPages = [
  "index.html",
  "pro/index.html",
  "account/index.html",
  "checkout/success/index.html",
  "checkout/cancel/index.html",
  "privacy/index.html",
  "terms/index.html",
  "mcp/index.html"
];

// Site-wide promises that must appear somewhere across the corpus.
const requiredCopy = [
  "Ezra MCP",
  "Bible verses",
  "MCP",
  "Get a free key"
];

// AI-slop and self-referential meta we will not ship.
const bannedCopy = [
  "revolutionary",
  "seamless",
  "unlock your potential",
  "powered by ai",
  "ai-powered",
  "next generation",
  "we built this",
  "we leveraged",
  "smart bible",
  "intelligent bible",
  "cutting-edge",
  "game-chang"
];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(path));
    } else {
      files.push(path);
    }
  }
  return files;
}

for (const page of requiredPages) {
  await readFile(resolve(src, page), "utf8");
}

const htmlFiles = (await walk(src)).filter((file) => file.endsWith(".html"));
const allHtml = (await Promise.all(htmlFiles.map((file) => readFile(file, "utf8")))).join("\n");

for (const copy of requiredCopy) {
  if (!allHtml.includes(copy)) {
    throw new Error(`Missing required copy: ${copy}`);
  }
}

const lower = allHtml.toLowerCase();
for (const copy of bannedCopy) {
  if (lower.includes(copy)) {
    throw new Error(`Banned marketing copy found: ${copy}`);
  }
}

for (const file of htmlFiles) {
  const text = await readFile(file, "utf8");
  if (!text.includes("<title>")) {
    throw new Error(`Missing title: ${file}`);
  }
  if (!text.includes('lang="en"')) {
    throw new Error(`Missing lang attribute: ${file}`);
  }
  if (!text.includes('name="viewport"')) {
    throw new Error(`Missing viewport meta: ${file}`);
  }
  if (text.includes(["Bibe", " Code"].join("")) || text.includes(["bibe", "-code"].join("")) || text.includes(["bibe", "coder"].join(""))) {
    throw new Error(`Leftover old branding in ${file}`);
  }
}

console.log("Site lint passed.");
