import { readFileSync } from "node:fs";

const plugin = JSON.parse(readFileSync("plugins/ezra-mcp/.codex-plugin/plugin.json", "utf8"));
const marketplace = JSON.parse(readFileSync(".agents/plugins/marketplace.json", "utf8"));

if (plugin.name !== "ezra-mcp") {
  throw new Error("plugin.json name must be ezra-mcp");
}

if (plugin.skills !== "./skills/") {
  throw new Error("plugin.json skills must point to ./skills/");
}

if (plugin.mcpServers !== "./.mcp.json") {
  throw new Error("plugin.json mcpServers must point to ./.mcp.json");
}

if (plugin.apps !== "./.app.json") {
  throw new Error("plugin.json apps must point to ./.app.json");
}

if (plugin.hooks) {
  throw new Error("Ezra plugin must not define prompt hooks in v1");
}

const mcp = JSON.parse(readFileSync("plugins/ezra-mcp/.mcp.json", "utf8"));
if (mcp.mcpServers?.["ezra-mcp"]?.command !== "ezra-mcp-mcp") {
  throw new Error("Ezra MCP server command must be ezra-mcp-mcp");
}

const app = JSON.parse(readFileSync("plugins/ezra-mcp/.app.json", "utf8"));
if (!app.apps?.some((candidate) => candidate.command === "ezra-mcp")) {
  throw new Error("Ezra plugin app manifest must include ezra-mcp");
}

const entry = marketplace.plugins?.find((candidate) => candidate.name === "ezra-mcp");
if (!entry) {
  throw new Error("marketplace missing ezra-mcp entry");
}

if (entry.source?.path !== "./plugins/ezra-mcp") {
  throw new Error("marketplace source.path must be ./plugins/ezra-mcp");
}

if (entry.policy?.installation !== "AVAILABLE") {
  throw new Error("marketplace policy.installation must be AVAILABLE");
}

if (entry.policy?.authentication !== "ON_INSTALL") {
  throw new Error("marketplace policy.authentication must be ON_INSTALL");
}

if (entry.policy?.products) {
  throw new Error("policy.products must be omitted in v1");
}

if (entry.category !== "Education") {
  throw new Error("marketplace category must be Education");
}

console.log("Plugin validation passed.");
