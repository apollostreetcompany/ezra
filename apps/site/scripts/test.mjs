import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const landing = await readFile(resolve(root, "src/index.html"), "utf8");
const pro = await readFile(resolve(root, "src/pro/index.html"), "utf8");
const mcp = await readFile(resolve(root, "src/mcp/index.html"), "utf8");
const account = await readFile(resolve(root, "src/account/index.html"), "utf8");
const success = await readFile(resolve(root, "src/checkout/success/index.html"), "utf8");
const cancel = await readFile(resolve(root, "src/checkout/cancel/index.html"), "utf8");

const assertions = [
  // Landing — concrete promises, not vague benefits
  [landing.includes("Find the verse"), "landing hero promise"],
  [landing.includes("get_verses_by_topic"), "landing shows real tool call"],
  [landing.includes("31,103 verses"), "landing names searchable verse count"],
  [landing.includes("Get a free key"), "landing primary CTA"],
  [landing.includes("/assets/ezra-preview.png"), "landing uses Ezra social preview"],
  [landing.includes("/assets/ezra-icon.png"), "landing uses Ezra favicon"],
  [landing.includes("/assets/ezra.png"), "landing uses Ezra header image"],
  [landing.includes("Pro") && landing.includes("$20"), "landing pro pricing"],
  [landing.includes("Max") && landing.includes("$100"), "landing max pricing"],
  [landing.includes("/v1/checkout/public-session"), "landing uses public checkout endpoint"],
  [landing.includes("Buy Pro") && landing.includes("Buy Max"), "landing has Pro and Max checkout forms"],
  // Pro / signup
  [pro.includes("magic link"), "pro signup explains flow"],
  [pro.includes("10,000 calls"), "pro tier limit"],
  [pro.includes("100,000 calls"), "max tier limit"],
  [pro.includes("/v1/checkout/public-session"), "pro page uses public checkout endpoint"],
  [pro.includes("Buy Pro") && pro.includes("Buy Max"), "pro page has tier buy buttons"],
  // MCP docs
  [mcp.includes("/v1/mcp"), "mcp page shows endpoint"],
  [mcp.includes("Bearer"), "mcp page shows auth header"],
  [mcp.includes("get_verses_by_topic"), "mcp lists tools"],
  [mcp.includes("Claude Code"), "mcp documents at least one client"],
  // Account / checkout
  [account.includes("/v1/magic-links/request"), "account requests magic links"],
  [account.includes("/v1/magic-links/verify"), "account verifies magic links"],
  [account.includes("/v1/api-keys"), "account creates API keys"],
  [account.includes("/v1/account/status"), "account reads account status"],
  [account.includes("/v1/billing/portal"), "account opens billing portal"],
  [success.includes("/v1/checkout/session-status"), "success page verifies checkout session"],
  [cancel.includes("No charge made"), "cancel page has concrete cancellation copy"]
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
  ["Bibe", " Code"].join("")
];

for (const copy of bannedLandingCopy) {
  if (`${landing}\n${pro}\n${account}\n${success}\n${cancel}`.toLowerCase().includes(copy.toLowerCase())) {
    throw new Error(`Banned landing copy: ${copy}`);
  }
}

const visibleLandingText = landing
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

const bannedVisibleLandingMeta = [
  "about the project",
  "source data",
  "agpl",
  "derivative work",
  "public domain",
  "canonical label",
  "graphify",
  "anti-slop"
];

for (const copy of bannedVisibleLandingMeta) {
  if (visibleLandingText.includes(copy)) {
    throw new Error(`Banned visible landing meta copy: ${copy}`);
  }
}

for (const [ok, name] of assertions) {
  if (!ok) {
    throw new Error(`Missing expected site behavior: ${name}`);
  }
}

console.log("Site tests passed.");
