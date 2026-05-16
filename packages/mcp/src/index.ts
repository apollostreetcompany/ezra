import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const ezraMcpBridgeVersion = "0.1.0";
export const defaultEzraApiUrl = "https://ezramcp.com";

export type JsonRpcId = string | number | null;
export type JsonRpcPayload = JsonRpcRequest | JsonRpcRequest[];

export interface JsonRpcRequest {
  jsonrpc?: "2.0";
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface EzraBridgeAuth {
  apiKey?: string;
  apiKeyPrefix?: string;
  sessionToken?: string;
}

export interface EzraBridgeConfig {
  endpoint: string;
  apiKey?: string;
  source: "env" | "config" | "missing";
}

export interface EzraBridgeRuntime {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
}

export function resolveBridgeConfig(env: NodeJS.ProcessEnv = process.env): EzraBridgeConfig {
  const endpoint = resolveEndpoint(env.EZRA_MCP_API_URL);
  const envKey = env.EZRA_MCP_API_KEY?.trim();
  if (envKey) {
    return { endpoint, apiKey: envKey, source: "env" };
  }
  const saved = readSavedAuth(env);
  if (saved.apiKey) {
    return { endpoint, apiKey: saved.apiKey, source: "config" };
  }
  return { endpoint, source: "missing" };
}

export async function handleBridgeRequest(
  payload: JsonRpcPayload,
  runtime: EzraBridgeRuntime = {}
): Promise<unknown> {
  const env = runtime.env ?? process.env;
  const fetchImpl = runtime.fetchImpl ?? fetch;
  const config = resolveBridgeConfig(env);
  if (!config.apiKey) {
    return bridgeError(idFromPayload(payload), "Ezra MCP API key missing. Run `ezra-mcp login --email you@example.com` and `ezra-mcp key create`, or set EZRA_MCP_API_KEY.", -32001);
  }

  const response = await fetchImpl(config.endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    return bridgeError(idFromPayload(payload), "Ezra MCP upstream returned a non-JSON response.", -32002, {
      status: response.status
    });
  }
  if (!response.ok && !isJsonRpcLike(parsed)) {
    return bridgeError(idFromPayload(payload), "Ezra MCP upstream request failed.", -32003, {
      status: response.status
    });
  }
  return parsed;
}

export function resolveAuthPath(env: NodeJS.ProcessEnv = process.env): string {
  const configDir = env.EZRA_MCP_CONFIG_DIR || join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "ezra-mcp");
  return join(configDir, "auth.json");
}

function readSavedAuth(env: NodeJS.ProcessEnv): EzraBridgeAuth {
  const path = resolveAuthPath(env);
  if (!existsSync(path)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(path, "utf8")) as EzraBridgeAuth;
  } catch {
    return {};
  }
}

function resolveEndpoint(apiUrl: string | undefined): string {
  const trimmed = (apiUrl || defaultEzraApiUrl).replace(/\/+$/, "");
  if (trimmed.endsWith("/v1/mcp")) {
    return trimmed;
  }
  return `${trimmed}/v1/mcp`;
}

function idFromPayload(payload: JsonRpcPayload): JsonRpcId {
  if (Array.isArray(payload)) {
    return null;
  }
  return payload.id ?? null;
}

function bridgeError(id: JsonRpcId, message: string, code: number, data?: unknown): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data })
    }
  };
}

function isJsonRpcLike(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.every(isJsonRpcLike);
  }
  return Boolean(value && typeof value === "object" && "jsonrpc" in value);
}
