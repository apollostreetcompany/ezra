import { chmodSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  createPlan,
  createReviewCard,
  formatReference,
  getLocalPassage,
  localBibles,
  parseReference,
  progressBar,
  referenceId,
  summarizeProgress,
  type LocalTranslationId
} from "@bible-coder/core";

export const bibleCoderMcpVersion = "0.1.0";
export const mcpProtocolVersion = "2025-11-25";

export const mcpToolNames = [
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
] as const;

export type McpToolName = (typeof mcpToolNames)[number];

type DatabaseSync = InstanceType<(typeof import("node:sqlite"))["DatabaseSync"]>;

export interface McpRuntime {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  now?: () => string;
}

export interface McpToolDefinition {
  name: McpToolName;
  title: string;
  description: string;
  inputSchema: JsonObject;
}

export interface McpTextContent {
  type: "text";
  text: string;
}

export interface McpToolResult {
  content: McpTextContent[];
  structuredContent?: JsonObject;
  isError: boolean;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: unknown;
}

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: string | number; result: JsonObject }
  | { jsonrpc: "2.0"; id: string | number | null; error: { code: number; message: string; data?: unknown } };

type JsonObject = Record<string, unknown>;

const noParamsSchema = { type: "object", additionalProperties: false } as const;

const toolDefinitions: McpToolDefinition[] = [
  {
    name: "bible_get_passage",
    title: "Get Bible Passage",
    description: "Return local WEB/KJV text inline, or a redacted display instruction for paid API.Bible translations.",
    inputSchema: {
      type: "object",
      properties: {
        reference: { type: "string", description: "Bible reference, for example John 3:16." },
        translation: { type: "string", description: "web, kjv, or an API.Bible Bible ID." }
      },
      required: ["reference"],
      additionalProperties: false
    }
  },
  {
    name: "bible_search",
    title: "Search Bible",
    description: "Search local WEB/KJV sample text inline; paid API.Bible search results are redacted from model-visible MCP output.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        translation: { type: "string" },
        limit: { type: "number" }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "plan_create",
    title: "Create Bible Plan",
    description: "Create a reference-first plan from a goal, without inserting paid Bible text into the model context.",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string" },
        title: { type: "string" },
        days: { type: "number" },
        references: { type: "array", items: { type: "string" } }
      },
      required: ["goal"],
      additionalProperties: false
    }
  },
  {
    name: "session_coda",
    title: "Session Coda",
    description: "Return the next free local goal verse for an ambient prompt/session coda and optionally record it as progress.",
    inputSchema: {
      type: "object",
      properties: {
        translation: { type: "string", description: "web or kjv." },
        record: { type: "boolean", description: "When true, mark the displayed goal item complete locally." }
      },
      additionalProperties: false
    }
  },
  {
    name: "goal_status",
    title: "Goal Status",
    description: "Read the current free local Bible Coder goal from the same local state used by the CLI.",
    inputSchema: noParamsSchema
  },
  {
    name: "goal_update",
    title: "Update Goal",
    description: "Create a new free local reference-first goal plan. This never uses paid Bible text.",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string" },
        days: { type: "number" },
        references: { type: "array", items: { type: "string" } }
      },
      required: ["goal"],
      additionalProperties: false
    }
  },
  {
    name: "progress_record",
    title: "Record Progress",
    description: "Record a progress event through the Bible Coder sync server.",
    inputSchema: {
      type: "object",
      properties: {
        planId: { type: "string" },
        referenceId: { type: "string" },
        reference: { type: "string" },
        action: { type: "string" },
        idempotencyKey: { type: "string" },
        occurredAt: { type: "string" },
        payload: { type: "object" }
      },
      required: ["planId"],
      additionalProperties: false
    }
  },
  {
    name: "progress_status",
    title: "Progress Status",
    description: "Read progress events from the Bible Coder sync server.",
    inputSchema: {
      type: "object",
      properties: {
        planId: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "review_next",
    title: "Next Review",
    description: "Read review events from the sync server for MCP clients.",
    inputSchema: noParamsSchema
  },
  {
    name: "billing_checkout",
    title: "Billing Checkout",
    description: "Create a Stripe Checkout Session through the Bible Coder server and return the Checkout URL.",
    inputSchema: {
      type: "object",
      properties: {
        successUrl: { type: "string" },
        cancelUrl: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "sync_status",
    title: "Sync Status",
    description: "Report whether the MCP server is configured for Bible Coder sync.",
    inputSchema: noParamsSchema
  },
  {
    name: "block_status",
    title: "Prayer Gate Status",
    description: "Read Prayer Gate status. This MCP tool never installs, disables, or mutates Git hooks.",
    inputSchema: noParamsSchema
  }
];

export function listMcpTools(): McpToolDefinition[] {
  return toolDefinitions.map((tool) => ({ ...tool, inputSchema: { ...tool.inputSchema } }));
}

export async function callMcpTool(name: string, args: unknown = {}, runtime: McpRuntime = {}): Promise<McpToolResult> {
  try {
    switch (name) {
      case "bible_get_passage":
        return bibleGetPassage(args);
      case "bible_search":
        return bibleSearch(args);
      case "plan_create":
        return planCreate(args);
      case "session_coda":
        return await sessionCoda(args, runtime);
      case "goal_status":
        return await goalStatus(runtime);
      case "goal_update":
        return await goalUpdate(args, runtime);
      case "progress_record":
        return await progressRecord(args, runtime);
      case "progress_status":
        return await progressStatus(args, runtime);
      case "review_next":
        return await reviewNext(runtime);
      case "billing_checkout":
        return await billingCheckout(args, runtime);
      case "sync_status":
        return await syncStatus(runtime);
      case "block_status":
        return blockStatus();
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return toolError(error instanceof Error ? error.message : String(error));
  }
}

export async function handleJsonRpcMessage(input: unknown, runtime: McpRuntime = {}): Promise<JsonRpcResponse | JsonRpcResponse[] | undefined> {
  if (Array.isArray(input)) {
    const responses = await Promise.all(input.map((message) => handleSingleJsonRpcMessage(message, runtime)));
    return responses.filter((response): response is JsonRpcResponse => response !== undefined);
  }
  return await handleSingleJsonRpcMessage(input, runtime);
}

function bibleGetPassage(args: unknown): McpToolResult {
  const input = readObject(args);
  const reference = readRequiredString(input, "reference");
  const translation = normalizeTranslation(readOptionalString(input, "translation"));
  if (!isLocalTranslation(translation)) {
    const parsed = parseReference(reference);
    return toolOk(
      [
        "Paid API.Bible text is display-only and redacted from model-visible MCP output by default.",
        `Reference: ${formatReference(parsed)}`,
        `Translation: ${translation}`,
        "Render this passage in a trusted human surface after licensing, FUMS, and cache policy checks."
      ].join("\n"),
      {
        reference: formatReference(parsed),
        translation,
        source: "api-bible-paid",
        textRedacted: true,
        entitlementStatus: "not_checked",
        displayOnly: true
      },
    );
  }

  const passage = getLocalPassage(reference, translation);
  const bible = localBibles[translation];
  const text = [
    `${passage.reference} (${bible.abbreviation})`,
    ...passage.verses.map((verse) => `${verse.verse}. ${verse.text}`),
    `Attribution: ${passage.attribution}`
  ].join("\n");
  return toolOk(text, {
    reference: passage.reference,
    translation: bible.abbreviation,
    source: "local-free",
    verses: passage.verses.map((verse) => ({ verse: verse.verse, text: verse.text })),
    attribution: passage.attribution
  });
}

function bibleSearch(args: unknown): McpToolResult {
  const input = readObject(args);
  const query = readRequiredString(input, "query");
  const translation = normalizeTranslation(readOptionalString(input, "translation"));
  if (!isLocalTranslation(translation)) {
    return toolOk(
      [
        "Paid API.Bible search snippets are redacted from model-visible MCP output by default.",
        `Query: ${query}`,
        `Translation: ${translation}`
      ].join("\n"),
      {
        query,
        translation,
        source: "api-bible-paid",
        textRedacted: true,
        displayOnly: true
      },
    );
  }

  const limit = readOptionalPositiveInteger(input, "limit") ?? 5;
  const bible = localBibles[translation];
  const normalizedQuery = query.toLowerCase();
  const matches = bible.verses
    .filter((verse) => verse.text.toLowerCase().includes(normalizedQuery))
    .slice(0, limit)
    .map((verse) => ({
      reference: formatReference(parseReference(`${verse.bookId} ${verse.chapter}:${verse.verse}`)),
      verse: verse.verse,
      text: verse.text
    }));
  return toolOk(
    matches.length === 0
      ? `No local ${bible.abbreviation} matches for "${query}".`
      : matches.map((match) => `${match.reference}: ${match.text}`).join("\n"),
    {
      query,
      translation: bible.abbreviation,
      source: "local-free",
      matches,
      attribution: bible.attribution
    },
  );
}

function planCreate(args: unknown): McpToolResult {
  const input = readObject(args);
  const goal = readRequiredString(input, "goal");
  const days = readOptionalPositiveInteger(input, "days") ?? 7;
  const title = readOptionalString(input, "title") ?? `Bible Coder Plan: ${goal}`;
  const references = readStringArray(input.references).length > 0 ? readStringArray(input.references) : suggestReferences(goal);
  const plan = createPlan({
    title,
    goal,
    days,
    items: references.slice(0, days).map((reference, index) => ({
      day: Math.min(index + 1, days),
      reference,
      kind: "reading"
    }))
  });
  return toolOk(JSON.stringify(plan, null, 2), {
    id: plan.id,
    title: plan.title,
    goal: plan.goal,
    days: plan.days,
    items: plan.items.map((item) => ({ id: item.id, day: item.day, reference: item.reference, kind: item.kind })),
    textPolicy: "reference-first; no paid Scripture text included"
  });
}

async function sessionCoda(args: unknown, runtime: McpRuntime): Promise<McpToolResult> {
  const input = readObject(args);
  const translation = normalizeTranslation(readOptionalString(input, "translation"));
  if (!isLocalTranslation(translation)) {
    throw new Error("session_coda only supports free local web or kjv translations.");
  }
  const shouldRecord = input.record === true;
  const db = await openLocalGoalDb(runtime.env ?? process.env);
  try {
    const plan = db.prepare("SELECT id, title, goal FROM plans ORDER BY created_at DESC, id ASC LIMIT 1").get() as GoalPlanRow | undefined;
    if (!plan) {
      const passage = getLocalPassage("John 3:16", translation);
      const bible = localBibles[translation];
      return toolOk(
        [
          "Bibe Code coda",
          `${passage.reference} (${bible.abbreviation})`,
          ...passage.verses.map((verse) => `${verse.verse}. ${verse.text}`),
          "No goal is configured yet. Run bible-coder setup to start a free goal.",
          `Attribution: ${passage.attribution}`
        ].join("\n"),
        {
          configured: false,
          source: "local-free",
          reference: passage.reference,
          translation: bible.abbreviation,
          recorded: false,
          attribution: passage.attribution
        },
      );
    }

    const item =
      (db
        .prepare("SELECT id, day, reference, completed_at FROM plan_items WHERE plan_id = ? AND completed_at IS NULL ORDER BY day ASC, id ASC LIMIT 1")
        .get(plan.id) as GoalItemRow | undefined) ??
      (db
        .prepare("SELECT id, day, reference, completed_at FROM plan_items WHERE plan_id = ? ORDER BY day DESC, id DESC LIMIT 1")
        .get(plan.id) as GoalItemRow | undefined);
    if (!item) {
      return toolOk(`Current goal: ${plan.goal}\nNo plan items found. Run bible-coder goal update --goal <goal>.`, {
        configured: true,
        source: "local-free",
        planId: String(plan.id),
        goal: String(plan.goal),
        recorded: false
      });
    }

    const wasIncomplete = !item.completed_at;
    const now = runtime.now?.() ?? new Date().toISOString();
    if (shouldRecord && wasIncomplete) {
      recordLocalGoalProgress(db, String(plan.id), String(item.id), now);
    }
    const count = db
      .prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN completed_at IS NULL THEN 0 ELSE 1 END) AS completed FROM plan_items WHERE plan_id = ?")
      .get(plan.id) as GoalCountRow | undefined;
    const total = Number(count?.total ?? 0);
    const completed = Number(count?.completed ?? 0);
    const progress = summarizeProgress(total, completed);
    const passage = getLocalPassage(String(item.reference), translation);
    const bible = localBibles[translation];
    return toolOk(
      [
        "Bibe Code coda",
        `Goal: ${String(plan.goal)}`,
        `${wasIncomplete ? "Next" : "Latest"}: Day ${Number(item.day)} - ${String(item.reference)}`,
        `${passage.reference} (${bible.abbreviation})`,
        ...passage.verses.map((verse) => `${verse.verse}. ${verse.text}`),
        shouldRecord && wasIncomplete ? `Recorded progress for ${String(item.reference)} (${String(item.id)}).` : "",
        !wasIncomplete ? "Goal complete." : "",
        `Progress: ${progressBar(progress)} (${completed}/${total})`,
        `Attribution: ${passage.attribution}`
      ].filter(Boolean).join("\n"),
      {
        configured: true,
        source: "local-free",
        planId: String(plan.id),
        goal: String(plan.goal),
        reference: passage.reference,
        translation: bible.abbreviation,
        itemId: String(item.id),
        recorded: shouldRecord && wasIncomplete,
        completed,
        total,
        percentage: progress.percent,
        attribution: passage.attribution
      },
    );
  } finally {
    db.close();
  }
}

async function goalStatus(runtime: McpRuntime): Promise<McpToolResult> {
  const statePath = localStatePath(runtime.env ?? process.env);
  if (!existsSync(statePath)) {
    return toolOk("No local Bible Coder goal yet. Run bible-coder setup or call goal_update.", {
      configured: false,
      source: "local-free"
    });
  }
  const db = await openLocalGoalDb(runtime.env ?? process.env);
  try {
    const row = db.prepare("SELECT id, title, goal FROM plans ORDER BY created_at DESC, id ASC LIMIT 1").get() as GoalPlanRow | undefined;
    if (!row) {
      return toolOk("No local Bible Coder goal yet. Run bible-coder setup or call goal_update.", {
        configured: false,
        source: "local-free"
      });
    }
    const count = db
      .prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN completed_at IS NULL THEN 0 ELSE 1 END) AS completed FROM plan_items WHERE plan_id = ?")
      .get(row.id) as GoalCountRow | undefined;
    const next = db
      .prepare("SELECT day, reference FROM plan_items WHERE plan_id = ? AND completed_at IS NULL ORDER BY day ASC, id ASC LIMIT 1")
      .get(row.id) as GoalItemRow | undefined;
    const total = Number(count?.total ?? 0);
    const completed = Number(count?.completed ?? 0);
    const progress = summarizeProgress(total, completed);
    return toolOk(
      [
        `Current goal: ${row.goal}`,
        `Plan: ${row.title} (${row.id})`,
        `Progress: ${progressBar(progress)} (${completed}/${total})`,
        next ? `Next: Day ${Number(next.day)} - ${String(next.reference)}` : "Next: goal complete"
      ].join("\n"),
      {
        configured: true,
        source: "local-free",
        planId: String(row.id),
        title: String(row.title),
        goal: String(row.goal),
        completed,
        total,
        percentage: progress.percent,
        next: next ? { day: Number(next.day), reference: String(next.reference) } : null
      },
    );
  } finally {
    db.close();
  }
}

async function goalUpdate(args: unknown, runtime: McpRuntime): Promise<McpToolResult> {
  const input = readObject(args);
  const goal = readRequiredString(input, "goal");
  const days = readOptionalPositiveInteger(input, "days") ?? 7;
  const references = readStringArray(input.references).length > 0 ? readStringArray(input.references) : suggestReferences(goal);
  const now = runtime.now?.() ?? new Date().toISOString();
  const plan = createPlan({
    title: `Bibe Code Goal: ${goal}`,
    goal,
    days,
    items: references.slice(0, days).map((reference, index) => ({
      day: Math.min(index + 1, days),
      reference,
      kind: "reading"
    }))
  });
  const db = await openLocalGoalDb(runtime.env ?? process.env);
  try {
    saveLocalGoalPlan(db, plan, now);
  } finally {
    db.close();
  }
  return toolOk(
    [
      `Updated goal: ${goal}`,
      `Created plan ${plan.id}: ${plan.title}`,
      "Goals are free. Premium only gates custom Bibles, Prayer Gate /block, and future leaderboard features."
    ].join("\n"),
    {
      source: "local-free",
      planId: plan.id,
      title: plan.title,
      goal: plan.goal,
      days: plan.days,
      items: plan.items.map((item) => ({ id: item.id, day: item.day, reference: item.reference, kind: item.kind })),
      textPolicy: "reference-first; no paid Scripture text included"
    },
  );
}

async function progressRecord(args: unknown, runtime: McpRuntime): Promise<McpToolResult> {
  const input = readObject(args);
  const now = runtime.now?.() ?? new Date().toISOString();
  const planId = readRequiredString(input, "planId");
  const reference = readOptionalString(input, "reference");
  const referenceIdValue = readOptionalString(input, "referenceId") ?? (reference ? referenceId(parseReference(reference)) : undefined);
  if (!referenceIdValue) {
    throw new Error("progress_record requires referenceId or reference.");
  }
  const action = readOptionalString(input, "action") ?? "completed";
  const body = {
    idempotencyKey: readOptionalString(input, "idempotencyKey") ?? `${planId}:${referenceIdValue}:${action}`,
    planId,
    referenceId: referenceIdValue,
    action,
    occurredAt: readOptionalString(input, "occurredAt") ?? now,
    payload: isPlainObject(input.payload) ? input.payload : {}
  };
  const response = await callServer("/v1/progress", runtime, { method: "POST", body });
  return toolOk("Progress recorded.", { recorded: true, response });
}

async function progressStatus(args: unknown, runtime: McpRuntime): Promise<McpToolResult> {
  const input = readObject(args);
  const planId = readOptionalString(input, "planId");
  const path = planId ? `/v1/progress?planId=${encodeURIComponent(planId)}` : "/v1/progress";
  const response = await callServer(path, runtime);
  const events = Array.isArray(response.events) ? response.events : [];
  const completed = events.filter((event) => isPlainObject(event) && event.action === "completed").length;
  const progress = summarizeProgress(events.length, completed);
  return toolOk(`${progressBar(progress)} (${completed}/${events.length})`, {
    planId,
    events,
    completed,
    total: events.length,
    percentage: progress.percent
  });
}

async function reviewNext(runtime: McpRuntime): Promise<McpToolResult> {
  const response = await callServer("/v1/reviews", runtime);
  const events = Array.isArray(response.events) ? response.events : [];
  return toolOk(events.length === 0 ? "No synced review events yet." : `Synced review events: ${events.length}`, {
    events,
    note: "Server-side next-review derivation is scheduled for a later hardening pass."
  });
}

async function billingCheckout(args: unknown, runtime: McpRuntime): Promise<McpToolResult> {
  const input = readObject(args);
  const response = await callServer("/v1/checkout/session", runtime, {
    method: "POST",
    body: {
      successUrl: readOptionalString(input, "successUrl") ?? "https://bible-coder.local/checkout/success",
      cancelUrl: readOptionalString(input, "cancelUrl") ?? "https://bible-coder.local/checkout/cancel"
    }
  });
  const url = typeof response.url === "string" ? response.url : undefined;
  if (!url) {
    throw new Error("Checkout session did not include a URL.");
  }
  return toolOk(url, { url });
}

async function syncStatus(runtime: McpRuntime): Promise<McpToolResult> {
  const config = readServerConfig(runtime);
  if (!config) {
    return toolOk("Bible Coder sync is not configured for this MCP server.", {
      configured: false,
      reason: "Set BIBLE_CODER_API_URL and BIBLE_CODER_TOKEN."
    });
  }
  const response = await (runtime.fetchImpl ?? fetch)(new URL("/health", config.apiUrl));
  const body = await safeJson(response);
  return toolOk(response.ok ? "Bible Coder sync server is reachable." : `Bible Coder sync server returned ${response.status}.`, {
    configured: true,
    apiUrl: config.apiUrl,
    ok: response.ok,
    status: response.status,
    response: body
  });
}

function blockStatus(): McpToolResult {
  return toolOk(
    [
      "Prayer Gate is not enabled by MCP.",
      "MCP exposes read-only block_status only. Use the CLI for block enable/disable after premium entitlement checks."
    ].join("\n"),
    {
      enabled: false,
      mutatesHooks: false,
      attestation: "I have prayed",
      disclaimer: "Prayer Gate is a personal attestation. Bible Coder cannot verify private prayer and does not pray on your behalf."
    },
  );
}

async function handleSingleJsonRpcMessage(input: unknown, runtime: McpRuntime): Promise<JsonRpcResponse | undefined> {
  if (!isPlainObject(input) || input.jsonrpc !== "2.0" || typeof input.method !== "string") {
    return jsonRpcError(null, -32600, "Invalid JSON-RPC request.");
  }
  if (!("id" in input)) {
    return undefined;
  }
  const id = input.id;
  if ((typeof id !== "string" && typeof id !== "number") || id === "") {
    return jsonRpcError(null, -32600, "JSON-RPC request id must be a string or number.");
  }

  if (input.method === "initialize") {
    const params = isPlainObject(input.params) ? input.params : {};
    const requestedVersion = typeof params.protocolVersion === "string" ? params.protocolVersion : mcpProtocolVersion;
    return jsonRpcResult(id, {
      protocolVersion: requestedVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: "bible-coder",
        title: "Bible Coder",
        version: bibleCoderMcpVersion
      },
      instructions: "Bible Coder returns local WEB/KJV text inline. session_coda can provide an ambient verse and record local progress; goal_status/goal_update manage free local goals. Paid API.Bible text is display-only and redacted from model-visible MCP output by default."
    });
  }

  if (input.method === "ping") {
    return jsonRpcResult(id, {});
  }

  if (input.method === "tools/list") {
    return jsonRpcResult(id, { tools: listMcpTools() });
  }

  if (input.method === "tools/call") {
    const params = isPlainObject(input.params) ? input.params : undefined;
    const name = params && typeof params.name === "string" ? params.name : undefined;
    if (!name) {
      return jsonRpcError(id, -32602, "tools/call requires params.name.");
    }
    if (!mcpToolNames.includes(name as McpToolName)) {
      return jsonRpcError(id, -32602, `Unknown tool: ${name}`);
    }
    const result = await callMcpTool(name, params?.arguments ?? {}, runtime);
    return jsonRpcResult(id, resultToJson(result));
  }

  return jsonRpcError(id, -32601, `Method not found: ${input.method}`);
}

async function callServer(path: string, runtime: McpRuntime, options: { method?: "GET" | "POST"; body?: JsonObject } = {}): Promise<JsonObject> {
  const config = readServerConfig(runtime);
  if (!config) {
    throw new Error("Server-backed MCP tool requires BIBLE_CODER_API_URL and BIBLE_CODER_TOKEN.");
  }
  const init: RequestInit = {
    method: options.method ?? "GET",
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json"
    }
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }
  const response = await (runtime.fetchImpl ?? fetch)(new URL(path, config.apiUrl), init);
  const body = await safeJson(response);
  if (!response.ok) {
    const message = typeof body.error === "string" ? body.error : `Server request failed with status ${response.status}.`;
    throw new Error(message);
  }
  return body;
}

function readServerConfig(runtime: McpRuntime): { apiUrl: string; token: string } | undefined {
  const env = runtime.env ?? process.env;
  const apiUrl = env.BIBLE_CODER_API_URL;
  const token = env.BIBLE_CODER_TOKEN || readSavedSyncToken(env);
  if (!apiUrl || !token) {
    return undefined;
  }
  return { apiUrl, token };
}

function readSavedSyncToken(env: NodeJS.ProcessEnv): string | undefined {
  const configDir = env.BIBLE_CODER_CONFIG_DIR || join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "bible-coder");
  const authPath = join(configDir, "auth.json");
  if (!existsSync(authPath)) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(readFileSync(authPath, "utf8")) as { syncToken?: unknown };
    return typeof parsed.syncToken === "string" && parsed.syncToken.trim() ? parsed.syncToken.trim() : undefined;
  } catch {
    return undefined;
  }
}

async function openLocalGoalDb(env: NodeJS.ProcessEnv): Promise<DatabaseSync> {
  const configDir = localConfigDir(env);
  mkdirSync(configDir, { recursive: true, mode: 0o700 });
  chmodIfExists(configDir, 0o700);
  const statePath = localStatePath(env);
  const existsBeforeOpen = existsSync(statePath);
  const sqlite = await import("node:sqlite");
  const db = new sqlite.DatabaseSync(statePath);
  migrateLocalGoalDb(db);
  if (!existsBeforeOpen) {
    chmodIfExists(statePath, 0o600);
  }
  chmodIfExists(statePath, 0o600);
  return db;
}

function localConfigDir(env: NodeJS.ProcessEnv): string {
  return env.BIBLE_CODER_CONFIG_DIR || join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "bible-coder");
}

function localStatePath(env: NodeJS.ProcessEnv): string {
  return join(localConfigDir(env), "state.sqlite");
}

function chmodIfExists(path: string, mode: number): void {
  if (!existsSync(path)) {
    return;
  }
  const currentMode = statSync(path).mode & 0o777;
  if (currentMode !== mode) {
    chmodSync(path, mode);
  }
}

function migrateLocalGoalDb(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      goal TEXT NOT NULL,
      days INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS plan_items (
      plan_id TEXT NOT NULL,
      id TEXT NOT NULL,
      day INTEGER NOT NULL,
      reference TEXT NOT NULL,
      kind TEXT NOT NULL,
      prompt TEXT,
      completed_at TEXT,
      PRIMARY KEY (plan_id, id)
    );
    CREATE TABLE IF NOT EXISTS review_cards (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      reference TEXT NOT NULL,
      due_at TEXT NOT NULL,
      interval_days INTEGER NOT NULL,
      ease_factor REAL NOT NULL,
      repetitions INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS progress_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      idempotency_key TEXT NOT NULL UNIQUE,
      plan_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      action TEXT NOT NULL,
      occurred_at TEXT NOT NULL
    );
  `);
}

function saveLocalGoalPlan(db: DatabaseSync, plan: ReturnType<typeof createPlan>, createdAt: string): void {
  db.exec("BEGIN");
  try {
    db.prepare("INSERT OR REPLACE INTO plans (id, title, goal, days, created_at) VALUES (?, ?, ?, ?, ?)").run(
      plan.id,
      plan.title,
      plan.goal,
      plan.days,
      createdAt,
    );
    const itemStatement = db.prepare(
      "INSERT OR REPLACE INTO plan_items (plan_id, id, day, reference, kind, prompt, completed_at) VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT completed_at FROM plan_items WHERE plan_id = ? AND id = ?), NULL))",
    );
    const reviewStatement = db.prepare(
      "INSERT OR IGNORE INTO review_cards (id, plan_id, reference, due_at, interval_days, ease_factor, repetitions) VALUES (?, ?, ?, ?, ?, ?, ?)",
    );
    for (const item of plan.items) {
      itemStatement.run(plan.id, item.id, item.day, item.reference, item.kind, item.prompt ?? null, plan.id, item.id);
      const card = createReviewCard(item.id, createdAt);
      reviewStatement.run(card.id, plan.id, item.reference, card.dueAt, card.intervalDays, card.easeFactor, card.repetitions);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function recordLocalGoalProgress(db: DatabaseSync, planId: string, itemId: string, completedAt: string): void {
  db.prepare("UPDATE plan_items SET completed_at = COALESCE(completed_at, ?) WHERE plan_id = ? AND id = ?").run(completedAt, planId, itemId);
  db.prepare("INSERT OR IGNORE INTO progress_events (idempotency_key, plan_id, item_id, action, occurred_at) VALUES (?, ?, ?, ?, ?)").run(
    `${planId}:${itemId}:completed`,
    planId,
    itemId,
    "completed",
    completedAt,
  );
}

interface GoalPlanRow {
  id: string;
  title: string;
  goal: string;
}

interface GoalCountRow {
  total: number;
  completed: number | null;
}

interface GoalItemRow {
  id: string;
  day: number;
  reference: string;
  completed_at?: string | null;
}

async function safeJson(response: Response): Promise<JsonObject> {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }
  const parsed = JSON.parse(text) as unknown;
  return isPlainObject(parsed) ? parsed : { value: parsed };
}

function toolOk(text: string, structuredContent: JsonObject): McpToolResult {
  return {
    content: [{ type: "text", text }],
    structuredContent,
    isError: false
  };
}

function toolError(message: string): McpToolResult {
  const type = classifyToolError(message);
  const fixHint = toolErrorFixHint(type, message);
  return {
    content: [{ type: "text", text: `${type}: ${message}\nFix: ${fixHint}` }],
    structuredContent: {
      error: {
        type,
        message,
        recoverable: type !== "INTERNAL_ERROR",
        data: { fix_hint: fixHint }
      }
    },
    isError: true
  };
}

function classifyToolError(message: string): string {
  if (message.includes("BIBLE_CODER_API_URL") || message.includes("BIBLE_CODER_TOKEN")) {
    return "CONFIGURATION_ERROR";
  }
  if (message.includes("required") || message.includes("Unknown tool") || message.includes("positive integer")) {
    return "INVALID_ARGUMENT";
  }
  if (message.includes("Server request failed") || message.includes("Checkout session did not include a URL")) {
    return "UPSTREAM_ERROR";
  }
  return "INTERNAL_ERROR";
}

function toolErrorFixHint(type: string, message: string): string {
  if (type === "CONFIGURATION_ERROR") {
    return "Set BIBLE_CODER_API_URL and run bible-coder login to save a local sync token, or set BIBLE_CODER_TOKEN explicitly, then restart the MCP client.";
  }
  if (type === "INVALID_ARGUMENT") {
    return message.includes("Unknown tool")
      ? "Call tools/list and use one of the advertised Bible Coder tool names."
      : "Check the tool input schema from tools/list and retry with the required fields.";
  }
  if (type === "UPSTREAM_ERROR") {
    return "Check the Bible Coder server health, credentials, and entitlement state before retrying.";
  }
  return "Retry once, then inspect Bible Coder MCP logs if the error persists.";
}

function resultToJson(result: McpToolResult): JsonObject {
  const output: JsonObject = { content: result.content, isError: result.isError };
  if (result.structuredContent) {
    output.structuredContent = result.structuredContent;
  }
  return output;
}

function jsonRpcResult(id: string | number, result: JsonObject): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  const error: { code: number; message: string; data?: unknown } = { code, message };
  if (data !== undefined) {
    error.data = data;
  }
  return { jsonrpc: "2.0", id, error };
}

function normalizeTranslation(value: string | undefined): string {
  return (value ?? "web").trim().toLowerCase();
}

function isLocalTranslation(value: string): value is LocalTranslationId {
  return value === "web" || value === "kjv";
}

function suggestReferences(goal: string): string[] {
  const normalized = goal.toLowerCase();
  if (normalized.includes("anx") || normalized.includes("peace")) {
    return ["Psalm 23:1", "John 3:16", "Romans 8:28"];
  }
  if (normalized.includes("purpose") || normalized.includes("calling")) {
    return ["Romans 8:28", "John 3:16", "Psalm 23:1"];
  }
  return ["John 3:16", "Romans 8:28", "Psalm 23:1"];
}

function readObject(value: unknown): Record<string, unknown> {
  if (!isPlainObject(value)) {
    return {};
  }
  return value;
}

function readRequiredString(input: Record<string, unknown>, key: string): string {
  const value = readOptionalString(input, key);
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function readOptionalString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readOptionalPositiveInteger(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return parsed;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
