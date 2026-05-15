import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { callMcpTool, handleJsonRpcMessage, listMcpTools, mcpToolNames, type McpRuntime } from "../src/index.js";

describe("Bible Coder MCP tool registry", () => {
  it("exposes the v1 tool set without local hook mutation tools", () => {
    expect(mcpToolNames).toEqual([
      "bible_get_passage",
      "bible_search",
      "plan_create",
      "session_coda",
      "goal_status",
      "goal_update",
      "progress_record",
      "progress_status",
      "review_next",
      "billing_checkout",
      "sync_status",
      "block_status"
    ]);
    expect(mcpToolNames).not.toContain("block_enable");
    expect(mcpToolNames).not.toContain("block_disable");
    expect(listMcpTools().map((tool) => tool.name)).toEqual([...mcpToolNames]);
  });

  it("returns free local WEB/KJV passages inline", async () => {
    const result = await callMcpTool("bible_get_passage", { reference: "John 3:16", translation: "web" });

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      reference: "John 3:16",
      translation: "WEB",
      source: "local-free"
    });
    expect(result.content[0]?.text).toContain("For God so loved the world");
    expect(result.content[0]?.text).toContain("Attribution:");
  });

  it("redacts paid API.Bible text from model-visible passage output", async () => {
    const result = await callMcpTool("bible_get_passage", {
      reference: "John 3:16",
      translation: "de4e12af7f28f599-02"
    });

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      reference: "John 3:16",
      translation: "de4e12af7f28f599-02",
      source: "api-bible-paid",
      textRedacted: true
    });
    expect(JSON.stringify(result)).not.toContain("For God so loved");
    expect(result.content[0]?.text).toContain("Paid API.Bible text is display-only");
  });

  it("keeps plans reference-first", async () => {
    const result = await callMcpTool("plan_create", {
      goal: "peace before shipping",
      days: 2,
      references: ["Psalm 23:1", "Romans 8:28"]
    });

    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      goal: "peace before shipping",
      days: 2
    });
    expect(JSON.stringify(result.structuredContent)).toContain("Psalm 23:1");
    expect(JSON.stringify(result)).not.toContain("Yahweh is my shepherd");
  });

  it("stores and reads free local goals without paid Bible text", async () => {
    const configDir = mkdtempSync(join(tmpdir(), "bible-coder-mcp-goal-"));
    try {
      const runtime: McpRuntime = {
        env: {
          BIBLE_CODER_CONFIG_DIR: configDir
        },
        now: () => "2026-05-14T08:00:00.000Z"
      };

      const empty = await callMcpTool("goal_status", {}, runtime);
      expect(empty.isError).toBe(false);
      expect(empty.structuredContent).toMatchObject({ configured: false });

      const updated = await callMcpTool("goal_update", { goal: "Memorize Romans 8 before launch" }, runtime);
      expect(updated.isError).toBe(false);
      expect(updated.structuredContent).toMatchObject({
        goal: "Memorize Romans 8 before launch",
        source: "local-free"
      });
      expect(JSON.stringify(updated)).not.toContain("For God so loved");

      const status = await callMcpTool("goal_status", {}, runtime);
      expect(status.isError).toBe(false);
      expect(status.structuredContent).toMatchObject({
        configured: true,
        goal: "Memorize Romans 8 before launch",
        source: "local-free"
      });
      expect(status.content[0]?.text).toContain("Current goal: Memorize Romans 8 before launch");
    } finally {
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  it("returns an ambient session coda and records local progress", async () => {
    const configDir = mkdtempSync(join(tmpdir(), "bible-coder-mcp-coda-"));
    try {
      const runtime: McpRuntime = {
        env: {
          BIBLE_CODER_CONFIG_DIR: configDir
        },
        now: () => "2026-05-14T08:00:00.000Z"
      };

      await callMcpTool("goal_update", {
        goal: "Read before coding",
        days: 2,
        references: ["John 3:16", "Romans 8:28"]
      }, runtime);

      const first = await callMcpTool("session_coda", { record: true }, runtime);
      expect(first.isError).toBe(false);
      expect(first.content[0]?.text).toContain("Bibe Code coda");
      expect(first.content[0]?.text).toContain("Next: Day 1 - John 3:16");
      expect(first.content[0]?.text).toContain("For God so loved the world");
      expect(first.content[0]?.text).toContain("Recorded progress for John 3:16");
      expect(first.structuredContent).toMatchObject({
        source: "local-free",
        recorded: true,
        completed: 1,
        total: 2
      });

      const second = await callMcpTool("session_coda", {}, runtime);
      expect(second.content[0]?.text).toContain("Next: Day 2 - Romans 8:28");
      expect(second.structuredContent).toMatchObject({
        recorded: false,
        completed: 1,
        total: 2
      });
    } finally {
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  it("calls server-backed billing and progress endpoints with bearer auth", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const runtime: McpRuntime = {
      env: {
        BIBLE_CODER_API_URL: "https://bible-coder.example",
        BIBLE_CODER_TOKEN: "bc_live_test_token"
      },
      fetchImpl: async (input, init) => {
        calls.push({ url: input.toString(), init });
        return new Response(JSON.stringify({ url: "https://checkout.stripe.test/session" }), { status: 200 });
      }
    };

    const checkout = await callMcpTool("billing_checkout", { successUrl: "https://ok", cancelUrl: "https://cancel" }, runtime);
    expect(checkout.structuredContent).toMatchObject({ url: "https://checkout.stripe.test/session" });
    expect(checkout.content[0]?.text).toContain("https://checkout.stripe.test/session");

    await callMcpTool("progress_record", { planId: "plan_1", referenceId: "john.3.16-3.16", action: "completed" }, runtime);
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual(["/v1/checkout/session", "/v1/progress"]);
    expect(calls[0]?.init?.headers).toMatchObject({ authorization: "Bearer bc_live_test_token" });
    expect(checkout.content[0]?.text).not.toContain("bc_live_test_token");
  });

  it("uses the saved CLI sync token when BIBLE_CODER_TOKEN is not set", async () => {
    const configDir = mkdtempSync(join(tmpdir(), "bible-coder-mcp-"));
    try {
      writeFileSync(join(configDir, "auth.json"), JSON.stringify({ syncToken: "bc_saved_test_token" }));
      const calls: Array<{ url: string; init?: RequestInit }> = [];
      const runtime: McpRuntime = {
        env: {
          BIBLE_CODER_API_URL: "https://bible-coder.example",
          BIBLE_CODER_CONFIG_DIR: configDir
        },
        fetchImpl: async (input, init) => {
          calls.push({ url: input.toString(), init });
          return new Response(JSON.stringify({ url: "https://checkout.stripe.test/session" }), { status: 200 });
        }
      };

      const checkout = await callMcpTool("billing_checkout", {}, runtime);

      expect(checkout.isError).toBe(false);
      expect(calls[0]?.init?.headers).toMatchObject({ authorization: "Bearer bc_saved_test_token" });
      expect(JSON.stringify(checkout)).not.toContain("bc_saved_test_token");
    } finally {
      rmSync(configDir, { recursive: true, force: true });
    }
  });

  it("returns structured configuration errors for server-backed tools", async () => {
    const result = await callMcpTool("billing_checkout", {});

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("CONFIGURATION_ERROR");
    expect(result.structuredContent).toMatchObject({
      error: {
        type: "CONFIGURATION_ERROR",
        message: "Server-backed MCP tool requires BIBLE_CODER_API_URL and BIBLE_CODER_TOKEN.",
        recoverable: true,
        data: {
          fix_hint: expect.stringContaining("BIBLE_CODER_API_URL")
        }
      }
    });
    expect(JSON.stringify(result)).not.toContain("bc_live_");
  });

  it("handles JSON-RPC initialize, tools/list, tools/call, and notifications", async () => {
    const initialize = await handleJsonRpcMessage({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "test", version: "1" } }
    });
    expect(initialize).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-11-25",
        capabilities: { tools: { listChanged: false } }
      }
    });

    expect(await handleJsonRpcMessage({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeUndefined();

    const tools = await handleJsonRpcMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(tools).toMatchObject({ jsonrpc: "2.0", id: 2, result: { tools: expect.any(Array) } });

    const call = await handleJsonRpcMessage({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "block_status", arguments: {} }
    });
    expect(call).toMatchObject({
      jsonrpc: "2.0",
      id: 3,
      result: { structuredContent: { enabled: false, mutatesHooks: false } }
    });
  });
});
