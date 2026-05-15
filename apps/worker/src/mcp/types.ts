export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<{ success: boolean }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface McpEnv {
  DB: D1Database;
}

export interface TopicRow {
  name: string;
  category: string;
  verse_count: number;
  verse_refs: string;
}

export interface VerseRow {
  ref: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  topics: string;
  pericopes: string;
}

export interface PericopeRow {
  name: string;
  category: string;
  book: string | null;
  verse_range: string;
  verse_refs: string;
  topics: string;
}

export interface McpToolError {
  code: string;
  message: string;
  recoverable: boolean;
  suggested_tool_calls?: Array<{ name: string; args: Record<string, unknown> }>;
}

export type McpToolResult =
  | { content: Array<{ type: "text"; text: string }>; isError?: false }
  | { content: Array<{ type: "text"; text: string }>; isError: true };

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export type Tier = "free" | "pro" | "max";

export const TIER_LIMITS: Record<Tier, number> = {
  free: 20,
  pro: 10000,
  max: 100000
};
