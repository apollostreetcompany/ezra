import { existsSync, readFileSync, statSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runEzraCli } from "../src/index.js";

describe("Ezra MCP CLI", () => {
  it("requests and verifies magic-link login without printing tokens", async () => {
    const configDir = tempConfigDir();
    const calls: Array<{ path: string; body: unknown; auth: string | null }> = [];
    const fetchImpl = mockFetch(calls, {
      "/v1/magic-links/request": { ok: true, delivery: "dev_echo", devCode: "123456" },
      "/v1/magic-links/verify": { token: "ezra_session_test_token" }
    });

    const request = await run(["login", "--email", "Reader@Example.com"], configDir, fetchImpl);
    const verify = await run(["login", "--email", "reader@example.com", "--code", "123456"], configDir, fetchImpl);

    expect(request.code).toBe(0);
    expect(verify.code).toBe(0);
    expect(request.stdout.join("\n")).toContain("Magic link requested");
    expect(verify.stdout.join("\n")).not.toContain("ezra_session_test_token");
    const authText = readFileSync(join(configDir, "auth.json"), "utf8");
    expect(authText).toContain("ezra_session_test_token");
    expect((statSync(join(configDir, "auth.json")).mode & 0o777).toString(8)).toBe("600");
    expect(calls.map((call) => call.path)).toEqual(["/v1/magic-links/request", "/v1/magic-links/verify"]);
  });

  it("creates and saves an API key without printing the key", async () => {
    const configDir = tempConfigDir();
    const loginFetch = mockFetch([], { "/v1/magic-links/verify": { token: "ezra_session_test_token" } });
    await run(["login", "--email", "reader@example.com", "--code", "123456"], configDir, loginFetch);
    const calls: Array<{ path: string; body: unknown; auth: string | null }> = [];
    const keyFetch = mockFetch(calls, {
      "/v1/api-keys": {
        key: "ezra_live_abc123_secretvalue",
        prefix: "abc123",
        tier: "free",
        free_calls_remaining: 20
      }
    });

    const result = await run(["key", "create", "--name", "local test"], configDir, keyFetch);

    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("Prefix: abc123");
    expect(result.stdout.join("\n")).not.toContain("ezra_live_abc123_secretvalue");
    expect(readFileSync(join(configDir, "auth.json"), "utf8")).toContain("ezra_live_abc123_secretvalue");
    expect(calls[0]?.auth).toBe("Bearer ezra_session_test_token");
  });

  it("reports account status and creates tiered checkout sessions", async () => {
    const configDir = tempConfigDir();
    await run(["login", "--email", "reader@example.com", "--code", "123456"], configDir, mockFetch([], {
      "/v1/magic-links/verify": { token: "ezra_session_test_token" }
    }));
    const calls: Array<{ path: string; body: unknown; auth: string | null }> = [];
    const fetchImpl = mockFetch(calls, {
      "/v1/account/status": { tier: "pro", usage: { used: 2, limit: 10000, remaining: 9998 }, apiKey: { prefix: "abc123" } },
      "/v1/checkout/session": { url: "https://checkout.stripe.com/c/test", tier: "max" },
      "/v1/billing/portal": { url: "https://billing.stripe.com/p/test" }
    });

    const status = await run(["status"], configDir, fetchImpl);
    const checkout = await run(["checkout", "--tier", "max"], configDir, fetchImpl);
    const billing = await run(["billing", "portal"], configDir, fetchImpl);

    expect(status.stdout.join("\n")).toContain("Tier: pro");
    expect(checkout.stdout.join("\n")).toContain("https://checkout.stripe.com/c/test");
    expect(billing.stdout.join("\n")).toContain("https://billing.stripe.com/p/test");
    expect(calls.find((call) => call.path === "/v1/checkout/session")?.body).toMatchObject({ tier: "max" });
  });
});

function tempConfigDir(): string {
  return mkdtempSync(join(tmpdir(), "ezra-cli-"));
}

async function run(args: string[], configDir: string, fetchImpl: typeof fetch = mockFetch([], {})) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await runEzraCli(args, {
    env: { ...process.env, EZRA_MCP_CONFIG_DIR: configDir, EZRA_MCP_API_URL: "https://api.test" },
    fetchImpl,
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line)
  });
  expect(existsSync(configDir)).toBe(true);
  return { code, stdout, stderr };
}

function mockFetch(
  calls: Array<{ path: string; body: unknown; auth: string | null }>,
  responses: Record<string, unknown>
): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({
      path: url.pathname,
      body: init?.body ? JSON.parse(String(init.body)) : null,
      auth: new Headers(init?.headers).get("authorization")
    });
    const body = responses[url.pathname] ?? { ok: true };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}
