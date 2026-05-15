import {
  TOOL_DEFINITIONS,
  ToolError,
  dispatchTool,
  toolError
} from "./tools.js";
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  McpEnv
} from "./types.js";

export const PROTOCOL_VERSION = "2025-06-18";

export interface McpInvocationContext {
  env: McpEnv;
  upgradeUrl: string;
}

export async function handleJsonRpc(
  request: JsonRpcRequest,
  context: McpInvocationContext
): Promise<JsonRpcResponse> {
  const id = request.id ?? null;
  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return rpcError(id, -32600, "Invalid JSON-RPC 2.0 request");
  }
  try {
    if (request.method === "initialize") {
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "ezra-mcp", version: "0.1.0" }
      });
    }
    if (request.method === "notifications/initialized") {
      return rpcResult(id, {});
    }
    if (request.method === "tools/list") {
      return rpcResult(id, { tools: TOOL_DEFINITIONS });
    }
    if (request.method === "tools/call") {
      const params = (request.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      const name = params.name;
      const args = params.arguments ?? {};
      if (!name) {
        return rpcError(id, -32602, "tools/call requires 'name'");
      }
      try {
        const result = await dispatchTool(context.env, name, args);
        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(result) }],
          isError: false
        });
      } catch (error) {
        const payload = error instanceof ToolError
          ? error.payload
          : toolError({
              code: "internal_error",
              message: error instanceof Error ? error.message : "internal_error",
              recoverable: false
            }).payload;
        return rpcResult(id, {
          content: [{ type: "text", text: JSON.stringify(payload) }],
          isError: true
        });
      }
    }
    return rpcError(id, -32601, `Method not found: ${request.method}`);
  } catch (error) {
    return rpcError(id, -32603, error instanceof Error ? error.message : "Internal error");
  }
}

export function rateLimitResponse(
  id: string | number | null,
  limit: number,
  used: number,
  tier: string,
  upgradeUrl: string
): JsonRpcResponse {
  const payload = {
    code: "rate_limit_exceeded",
    message: `Monthly quota exhausted for tier '${tier}': ${used}/${limit} calls used. Upgrade to continue.`,
    recoverable: true,
    tier,
    limit,
    used,
    upgrade_url: upgradeUrl
  };
  return rpcResult(id, {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    isError: true
  });
}

export function unauthorizedResponse(id: string | number | null): JsonRpcResponse {
  const payload = {
    code: "unauthorized",
    message: "Missing or invalid API key. Send 'Authorization: Bearer <key>'. Issue a key via POST /v1/api-keys.",
    recoverable: false
  };
  return rpcResult(id, {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    isError: true
  });
}

function rpcResult(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: string | number | null, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
