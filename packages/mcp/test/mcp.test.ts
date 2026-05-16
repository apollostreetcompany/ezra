import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { handleBridgeRequest, resolveAuthPath, resolveBridgeConfig } from "../src/index.js";

describe("Ezra MCP stdio bridge", () => {
  it("forwards JSON-RPC to the hosted endpoint with EZRA_MCP_API_KEY", async () => {
    const calls: Array<{ url: string; auth: string | null; body: unknown }> = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        auth: new Headers(init?.headers).get("authorization"),
        body: JSON.parse(String(init?.body))
      });
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: true } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;

    const response = await handleBridgeRequest(
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { env: { EZRA_MCP_API_URL: "https://api.test", EZRA_MCP_API_KEY: "ezra_live_test_secret" }, fetchImpl }
    );

    expect(response).toEqual({ jsonrpc: "2.0", id: 1, result: { ok: true } });
    expect(calls).toEqual([
      {
        url: "https://api.test/v1/mcp",
        auth: "Bearer ezra_live_test_secret",
        body: { jsonrpc: "2.0", id: 1, method: "tools/list" }
      }
    ]);
  });

  it("uses the saved local API key when the env key is absent", () => {
    const configDir = mkdtempSync(join(tmpdir(), "ezra-mcp-bridge-"));
    mkdirSync(configDir, { recursive: true });
    writeFileSync(join(configDir, "auth.json"), JSON.stringify({ apiKey: "ezra_live_saved_secret" }));

    const config = resolveBridgeConfig({ EZRA_MCP_CONFIG_DIR: configDir, EZRA_MCP_API_URL: "https://ezramcp.com/v1/mcp" });

    expect(resolveAuthPath({ EZRA_MCP_CONFIG_DIR: configDir })).toBe(join(configDir, "auth.json"));
    expect(existsSync(resolveAuthPath({ EZRA_MCP_CONFIG_DIR: configDir }))).toBe(true);
    expect(readFileSync(resolveAuthPath({ EZRA_MCP_CONFIG_DIR: configDir }), "utf8")).toContain("ezra_live_saved_secret");
    expect(config).toMatchObject({
      endpoint: "https://ezramcp.com/v1/mcp",
      apiKey: "ezra_live_saved_secret",
      source: "config"
    });
  });

  it("returns a structured JSON-RPC error when no key exists", async () => {
    const configDir = mkdtempSync(join(tmpdir(), "ezra-mcp-bridge-empty-"));
    const response = await handleBridgeRequest(
      { jsonrpc: "2.0", id: "missing", method: "tools/list" },
      { env: { EZRA_MCP_CONFIG_DIR: configDir } }
    );

    expect(response).toEqual({
      jsonrpc: "2.0",
      id: "missing",
      error: {
        code: -32001,
        message: expect.stringContaining("Ezra MCP API key missing")
      }
    });
  });
});
