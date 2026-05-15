import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = resolve(root, "src");
const requiredPages = [
  "index.html",
  "docs/index.html",
  "pro/index.html",
  "privacy/index.html",
  "terms/index.html",
  "mcp/index.html"
];

const requiredCopy = [
  "Stop Vibe Coding. Start Bibe Coding.",
  "What you get",
  "Get started free",
  "See what Pro adds"
];

const bannedCopy = [
  "revolutionary",
  "seamless",
  "unlock your potential",
  "powered by ai",
  "next generation"
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

const landing = await readFile(resolve(src, "index.html"), "utf8");
const bannedLandingCopy = [
  "What it does",
  "Set a Bible goal",
  "Use the same Bible goal",
  "Free goals",
  "MCP ready",
  "Pro later"
];

for (const copy of bannedLandingCopy) {
  if (landing.includes(copy)) {
    throw new Error(`Landing copy must be benefit-led, found: ${copy}`);
  }
}

for (const file of htmlFiles) {
  const text = await readFile(file, "utf8");
  if (!text.includes("<title>")) {
    throw new Error(`Missing title: ${file}`);
  }
  if (!text.includes('href="/docs/"') && file.endsWith("index.html") && !file.includes("/docs/")) {
    throw new Error(`Page does not link to docs: ${file}`);
  }
}

console.log("Site lint passed.");
