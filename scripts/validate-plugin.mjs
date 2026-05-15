import { readFileSync } from "node:fs";

const plugin = JSON.parse(readFileSync("plugins/bible-coder/.codex-plugin/plugin.json", "utf8"));
const marketplace = JSON.parse(readFileSync(".agents/plugins/marketplace.json", "utf8"));

if (plugin.name !== "bible-coder") {
  throw new Error("plugin.json name must be bible-coder");
}

if (plugin.skills !== "./skills/") {
  throw new Error("plugin.json skills must point to ./skills/");
}

if (plugin.mcpServers !== "./.mcp.json") {
  throw new Error("plugin.json mcpServers must point to ./.mcp.json");
}

const entry = marketplace.plugins?.find((candidate) => candidate.name === "bible-coder");
if (!entry) {
  throw new Error("marketplace missing bible-coder entry");
}

if (entry.source?.path !== "./plugins/bible-coder") {
  throw new Error("marketplace source.path must be ./plugins/bible-coder");
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
