import { describe, expect, it } from "vitest";
import worker from "../src/index.js";

describe("Ezra MCP worker — /v1/mcp", () => {
  it("handles initialize without authentication still requires auth, but tools/list returns the 7 tools", async () => {
    const db = new FakeD1();
    const token = await issueMcpKey(db, "usr_initer");
    const response = await rpc(db, token, { id: 1, method: "tools/list" });
    expect(response.status).toBe(200);
    const body = await response.json() as RpcResult;
    expect(body.result?.tools).toBeInstanceOf(Array);
    expect((body.result?.tools as Array<{ name: string }>).map((t) => t.name).sort()).toEqual([
      "find_topic",
      "get_chapter",
      "get_pericope",
      "get_related_topics",
      "get_verse",
      "get_verses_by_topic",
      "list_topics"
    ]);
  });

  it("returns 401 with structured MCP error when API key is missing", async () => {
    const db = new FakeD1();
    const response = await fetch_("https://ezramcp.com/v1/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "initialize" })
    }, db);
    expect(response.status).toBe(401);
    const body = await response.json() as RpcResult;
    expect(body.result?.isError).toBe(true);
    const payload = JSON.parse((body.result?.content as Array<{ text: string }>)[0].text);
    expect(payload.code).toBe("unauthorized");
  });

  it("calls get_verses_by_topic and returns verses", async () => {
    const db = new FakeD1();
    db.topics.set("Faith", {
      name: "Faith",
      category: "theme",
      verse_count: 2,
      verse_refs: JSON.stringify(["John 3:16", "Hebrews 11:1"])
    });
    db.verses.set("John 3:16", {
      ref: "John 3:16", book: "John", chapter: 3, verse: 16,
      text: "For God so loved the world...",
      topics: JSON.stringify(["Faith"]), pericopes: JSON.stringify([])
    });
    db.verses.set("Hebrews 11:1", {
      ref: "Hebrews 11:1", book: "Hebrews", chapter: 11, verse: 1,
      text: "Now faith is the substance...",
      topics: JSON.stringify(["Faith"]), pericopes: JSON.stringify([])
    });
    const token = await issueMcpKey(db, "usr_faith");
    const response = await rpc(db, token, {
      id: 2,
      method: "tools/call",
      params: { name: "get_verses_by_topic", arguments: { topic: "Faith", limit: 5 } }
    });
    const body = await response.json() as RpcResult;
    expect(body.result?.isError).toBe(false);
    const data = JSON.parse((body.result?.content as Array<{ text: string }>)[0].text);
    expect(data).toHaveLength(2);
    expect(data[0].ref).toBe("John 3:16");
  });

  it("returns rate-limit error once the free quota is exhausted", async () => {
    const db = new FakeD1();
    const userId = "usr_rl";
    const token = await issueMcpKey(db, userId);
    db.usage.set(`${userId}|2026-05`, { call_count: 20, updated_at: "now" });
    const response = await rpc(db, token, {
      id: 3,
      method: "tools/call",
      params: { name: "list_topics", arguments: {} }
    });
    expect(response.status).toBe(429);
    const body = await response.json() as RpcResult;
    expect(body.result?.isError).toBe(true);
    const payload = JSON.parse((body.result?.content as Array<{ text: string }>)[0].text);
    expect(payload.code).toBe("rate_limit_exceeded");
    expect(payload.tier).toBe("free");
    expect(payload.limit).toBe(20);
    expect(payload.upgrade_url).toBe("https://ezramcp.com/pro/");
  });

  it("returns a structured tool error when a topic is unknown, with a suggested find_topic call", async () => {
    const db = new FakeD1();
    const token = await issueMcpKey(db, "usr_404");
    const response = await rpc(db, token, {
      id: 4,
      method: "tools/call",
      params: { name: "get_verses_by_topic", arguments: { topic: "DoesNotExist" } }
    });
    const body = await response.json() as RpcResult;
    expect(body.result?.isError).toBe(true);
    const payload = JSON.parse((body.result?.content as Array<{ text: string }>)[0].text);
    expect(payload.code).toBe("topic_not_found");
    expect(payload.recoverable).toBe(true);
    expect(payload.suggested_tool_calls?.[0]?.name).toBe("find_topic");
  });

  it("upgrades the free quota to pro after a Pro subscription is recorded", async () => {
    const db = new FakeD1();
    const userId = "usr_pro";
    db.entitlements.set(userId, { status: "pro", current_period_end: null, grace_until: null, updated_at: "now" });
    const token = await issueMcpKey(db, userId);
    db.usage.set(`${userId}|2026-05`, { call_count: 21, updated_at: "now" });
    db.topics.set("Faith", { name: "Faith", category: "theme", verse_count: 0, verse_refs: "[]" });
    const response = await rpc(db, token, {
      id: 5,
      method: "tools/call",
      params: { name: "get_verses_by_topic", arguments: { topic: "Faith" } }
    });
    // 21 free calls > 20 free limit would 429, but pro tier has 10k → succeeds.
    expect(response.status).toBe(200);
    const body = await response.json() as RpcResult;
    expect(body.result?.isError).toBe(false);
  });

  it("returns all ranges for a pericope name that appears more than once", async () => {
    const db = new FakeD1();
    db.pericopes.push(
      {
        name: "John on Patmos",
        category: "story",
        book: "Revelation",
        verse_range: "Revelation 7:1-8",
        verse_refs: JSON.stringify(["Revelation 7:1"]),
        topics: JSON.stringify(["Protection"])
      },
      {
        name: "John on Patmos",
        category: "story",
        book: "Revelation",
        verse_range: "Revelation 7:9-17",
        verse_refs: JSON.stringify(["Revelation 7:9"]),
        topics: JSON.stringify(["Worship"])
      }
    );
    db.verses.set("Revelation 7:1", {
      ref: "Revelation 7:1", book: "Revelation", chapter: 7, verse: 1,
      text: "After this, I saw four angels standing at the four corners of the earth...",
      topics: JSON.stringify(["Protection"]), pericopes: JSON.stringify(["John on Patmos"])
    });
    db.verses.set("Revelation 7:9", {
      ref: "Revelation 7:9", book: "Revelation", chapter: 7, verse: 9,
      text: "After these things I looked, and behold, a great multitude...",
      topics: JSON.stringify(["Worship"]), pericopes: JSON.stringify(["John on Patmos"])
    });
    const token = await issueMcpKey(db, "usr_patmos");
    const response = await rpc(db, token, {
      id: 6,
      method: "tools/call",
      params: { name: "get_pericope", arguments: { name: "John on Patmos" } }
    });
    const body = await response.json() as RpcResult;
    expect(body.result?.isError).toBe(false);
    const data = JSON.parse((body.result?.content as Array<{ text: string }>)[0].text);
    expect(data.verse_range).toBe("Revelation 7:1-8; Revelation 7:9-17");
    expect(data.verse_refs).toEqual(["Revelation 7:1", "Revelation 7:9"]);
    expect(data.topics).toEqual(["Protection", "Worship"]);
    expect(data.segments).toHaveLength(2);
    expect(data.verses.map((verse: { ref: string }) => verse.ref)).toEqual(["Revelation 7:1", "Revelation 7:9"]);
  });
});

interface RpcResult {
  jsonrpc: string;
  id: number | string | null;
  result?: { content?: unknown; tools?: unknown; isError?: boolean } & Record<string, unknown>;
  error?: { code: number; message: string };
}

async function rpc(db: FakeD1, token: string, body: { id: number | string; method: string; params?: unknown }): Promise<Response> {
  return fetch_("https://ezramcp.com/v1/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: "2.0", ...body })
  }, db);
}

async function fetch_(url: string, init: RequestInit, db: FakeD1): Promise<Response> {
  return worker.fetch(new Request(url, init), env(db));
}

function env(db: FakeD1): Parameters<typeof worker.fetch>[1] {
  return {
    DB: db,
    TOKEN_HASH_PEPPER: "pepper",
    STRIPE_SECRET_KEY: "sk_test",
    STRIPE_WEBHOOK_SECRET: "whsec",
    STRIPE_PRICE_EZRA_PRO_MONTHLY: "price_pro",
    STRIPE_PRICE_EZRA_MAX_MONTHLY: "price_max",
    EZRA_MCP_UPGRADE_URL: "https://ezramcp.com/pro/"
  };
}

async function issueMcpKey(db: FakeD1, userId: string): Promise<string> {
  const token = `ezra_live_test_${userId}`;
  const hash = await sha256Hex(`pepper${token}`);
  db.deviceTokensByHash.set(hash, {
    id: `dtok_${userId}`,
    user_id: userId,
    scopes: JSON.stringify(["mcp:call"]),
    revoked_at: null
  });
  return token;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface DeviceTokenRow {
  id: string;
  user_id: string;
  scopes: string;
  revoked_at: string | null;
}

interface UsageRow {
  call_count: number;
  updated_at: string;
}

interface EntitlementRow {
  status: string;
  current_period_end: string | null;
  grace_until: string | null;
  updated_at: string;
}

interface TopicRow {
  name: string;
  category: string;
  verse_count: number;
  verse_refs: string;
}

interface VerseRow {
  ref: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  topics: string;
  pericopes: string;
}

interface PericopeRow {
  name: string;
  category: string;
  book: string | null;
  verse_range: string;
  verse_refs: string;
  topics: string;
}

class FakeD1 {
  deviceTokensByHash = new Map<string, DeviceTokenRow>();
  usage = new Map<string, UsageRow>();
  entitlements = new Map<string, EntitlementRow>();
  topics = new Map<string, TopicRow>();
  verses = new Map<string, VerseRow>();
  pericopes: PericopeRow[] = [];
  users = new Map<string, { email: string | null }>();

  prepare(query: string): FakeStatement {
    return new FakeStatement(this, query);
  }
}

class FakeStatement {
  private values: unknown[] = [];
  constructor(private readonly db: FakeD1, private readonly query: string) {}

  bind(...values: unknown[]): FakeStatement {
    this.values = values;
    return this;
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    const q = this.query;
    if (q.includes("FROM device_tokens WHERE token_hash")) {
      const row = this.db.deviceTokensByHash.get(String(this.values[0]));
      if (!row) return null;
      return { user_id: row.user_id, device_id: row.id, scopes: row.scopes, revoked_at: row.revoked_at } as T;
    }
    if (q.includes("FROM entitlements WHERE user_id")) {
      const row = this.db.entitlements.get(String(this.values[0]));
      return row ? ({ status: row.status, grace_until: row.grace_until } as T) : null;
    }
    if (q.includes("FROM usage_counters WHERE user_id")) {
      const row = this.db.usage.get(`${String(this.values[0])}|${String(this.values[1])}`);
      return row ? ({ call_count: row.call_count } as T) : null;
    }
    if (q.includes("FROM topics WHERE name")) {
      const row = this.db.topics.get(String(this.values[0]));
      if (!row) return null;
      if (q.includes("verse_refs FROM topics")) {
        return { verse_refs: row.verse_refs } as T;
      }
      return row as T;
    }
    if (q.includes("FROM verses WHERE ref")) {
      const row = this.db.verses.get(String(this.values[0]));
      return row ? (row as T) : null;
    }
    return null;
  }

  async all<T = Record<string, unknown>>(): Promise<{ results?: T[] }> {
    const q = this.query;
    if (q.includes("FROM verses WHERE ref IN")) {
      const refs = this.values.map(String);
      const rows: VerseRow[] = [];
      for (const ref of refs) {
        const row = this.db.verses.get(ref);
        if (row) rows.push(row);
      }
      return { results: rows as unknown as T[] };
    }
    if (q.includes("FROM topics") && q.includes("ORDER BY verse_count")) {
      let rows = [...this.db.topics.values()];
      if (q.includes("WHERE category =")) {
        rows = rows.filter((row) => row.category === String(this.values[0]));
      }
      return { results: rows as unknown as T[] };
    }
    if (q.includes("FROM pericopes WHERE name")) {
      const name = String(this.values[0]);
      const rows = this.db.pericopes
        .filter((row) => row.name === name)
        .sort((a, b) => a.verse_range.localeCompare(b.verse_range));
      return { results: rows as unknown as T[] };
    }
    if (q.includes("FROM verses WHERE book")) {
      const book = String(this.values[0]);
      const chapter = Number(this.values[1]);
      const rows = [...this.db.verses.values()].filter((v) => v.book === book && v.chapter === chapter);
      return { results: rows as unknown as T[] };
    }
    return { results: [] };
  }

  async run(): Promise<{ success: boolean }> {
    const q = this.query;
    if (q.startsWith("UPDATE device_tokens SET last_seen_at")) return { success: true };
    if (q.startsWith("INSERT INTO usage_counters")) {
      const key = `${String(this.values[0])}|${String(this.values[1])}`;
      if (!this.db.usage.has(key)) {
        this.db.usage.set(key, { call_count: 0, updated_at: String(this.values[2]) });
      }
      return { success: true };
    }
    if (q.startsWith("UPDATE usage_counters SET call_count")) {
      const key = `${String(this.values[1])}|${String(this.values[2])}`;
      const row = this.db.usage.get(key);
      if (row) {
        this.db.usage.set(key, { call_count: row.call_count + 1, updated_at: String(this.values[0]) });
      }
      return { success: true };
    }
    if (q.startsWith("INSERT OR IGNORE INTO users") || q.startsWith("INSERT INTO device_tokens") || q.startsWith("UPDATE users SET email")) {
      return { success: true };
    }
    return { success: true };
  }
}
