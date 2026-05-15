import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const landing = await readFile(resolve(root, "src/index.html"), "utf8");
const docs = await readFile(resolve(root, "src/docs/index.html"), "utf8");
const pro = await readFile(resolve(root, "src/pro/index.html"), "utf8");
const mcp = await readFile(resolve(root, "src/mcp/index.html"), "utf8");

const assertions = [
  [landing.includes("Stop Vibe Coding. Start Bibe Coding."), "landing headline"],
  [landing.includes("What you get"), "benefit section label"],
  [landing.includes("Get a calmer build rhythm"), "benefit-led rhythm copy"],
  [landing.includes("Get your Bible goal everywhere you code"), "benefit-led goal copy"],
  [landing.includes("Get a prayer pause before the push"), "benefit-led prayer copy"],
  [landing.includes('src="/assets/jesus-one.png"'), "supplied hero image"],
  [landing.includes('href="/docs/"') && landing.includes(">Get started free<"), "start free action"],
  [landing.includes('href="/pro/"') && landing.includes(">See what Pro adds<"), "pro action"],
  [docs.includes("pnpm add -g bible-coder"), "pnpm install command"],
  [pro.includes("extra bibles") && pro.includes("/block") && pro.includes("future leaderboard"), "pro feature copy"],
  [mcp.includes("Codex") && mcp.includes("Claude Code") && mcp.includes("Gemini CLI"), "mcp clients"]
];

const bannedLandingCopy = [
  "Read and learn the bible while you vibe code",
  "What it does",
  "Set a Bible goal",
  "Use the same Bible goal",
  "Free goals",
  "MCP ready",
  "Pro later"
];

for (const copy of bannedLandingCopy) {
  if (landing.includes(copy)) {
    throw new Error(`Landing copy describes functionality instead of benefits: ${copy}`);
  }
}

for (const [ok, name] of assertions) {
  if (!ok) {
    throw new Error(`Missing expected site behavior: ${name}`);
  }
}

console.log("Site tests passed.");
