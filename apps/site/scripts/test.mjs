import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const landing = await readFile(resolve(root, "src/index.html"), "utf8");
const pro = await readFile(resolve(root, "src/pro/index.html"), "utf8");
const mcp = await readFile(resolve(root, "src/mcp/index.html"), "utf8");

const assertions = [
  // Landing — concrete promises, not vague benefits
  [landing.includes("Real Bible verses"), "landing hero promise"],
  [landing.includes("get_verses_by_topic"), "landing shows real tool call"],
  [landing.includes("31,103 verses"), "landing names dataset scale"],
  [landing.includes("387"), "landing names topic-count signature"],
  [landing.includes("Get a free API key"), "landing primary CTA"],
  [landing.includes("Pro") && landing.includes("$20"), "landing pro pricing"],
  [landing.includes("Max") && landing.includes("$100"), "landing max pricing"],
  // Pro / signup
  [pro.includes("magic link"), "pro signup explains flow"],
  [pro.includes("10,000 calls"), "pro tier limit"],
  [pro.includes("100,000 calls"), "max tier limit"],
  // MCP docs
  [mcp.includes("/v1/mcp"), "mcp page shows endpoint"],
  [mcp.includes("Bearer"), "mcp page shows auth header"],
  [mcp.includes("get_verses_by_topic"), "mcp lists tools"],
  [mcp.includes("Claude Code"), "mcp documents at least one client"]
];

// Anti-slop landing copy
const bannedLandingCopy = [
  "powered by AI",
  "AI-powered",
  "revolutionary",
  "next generation",
  "we built",
  "leveraging",
  "Stop Vibe Coding",
  "Bibe Code"
];

for (const copy of bannedLandingCopy) {
  if (landing.toLowerCase().includes(copy.toLowerCase())) {
    throw new Error(`Banned landing copy: ${copy}`);
  }
}

for (const [ok, name] of assertions) {
  if (!ok) {
    throw new Error(`Missing expected site behavior: ${name}`);
  }
}

console.log("Site tests passed.");
