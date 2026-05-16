import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const ezraCliVersion = "0.1.0";
export const defaultEzraApiUrl = "https://ezramcp.com";
const defaultCheckoutSuccessUrl = "https://ezramcp.com/checkout/success?session_id={CHECKOUT_SESSION_ID}";
const defaultCheckoutCancelUrl = "https://ezramcp.com/checkout/cancel";
const defaultBillingReturnUrl = "https://ezramcp.com/account/";

export interface EzraCliOptions {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

export interface EzraAuth {
  sessionToken?: string;
  apiKey?: string;
  apiKeyPrefix?: string;
  updatedAt?: string;
}

interface EzraPaths {
  configDir: string;
  authPath: string;
}

interface ParsedArgs {
  positional: string[];
  flags: Map<string, string[]>;
}

interface RequestConfig {
  apiUrl: string;
  token: string;
}

export async function runEzraCli(argv: string[], options: EzraCliOptions = {}): Promise<number> {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const output = options.stdout ?? console.log;
  const errorOutput = options.stderr ?? console.error;
  const [command = "help", ...rest] = argv;

  try {
    if (command === "--version" || command === "-v") {
      output(ezraCliVersion);
      return 0;
    }
    if (command === "help" || command === "--help" || command === "-h") {
      printHelp(output);
      return 0;
    }
    if (command === "setup") {
      return commandSetup(env, output);
    }
    if (command === "login") {
      return await commandLogin(rest, env, fetchImpl, output);
    }
    if (command === "key") {
      return await commandKey(rest, env, fetchImpl, output);
    }
    if (command === "status") {
      return await commandStatus(env, fetchImpl, output);
    }
    if (command === "checkout") {
      return await commandCheckout(rest, env, fetchImpl, output);
    }
    if (command === "billing") {
      return await commandBilling(rest, env, fetchImpl, output);
    }
    errorOutput(`Unknown command: ${command}`);
    printHelp(errorOutput);
    return 1;
  } catch (error) {
    errorOutput(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

export function resolveEzraPaths(env: NodeJS.ProcessEnv = process.env): EzraPaths {
  const configDir = env.EZRA_MCP_CONFIG_DIR || join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "ezra-mcp");
  return { configDir, authPath: join(configDir, "auth.json") };
}

function commandSetup(env: NodeJS.ProcessEnv, output: (line: string) => void): number {
  const paths = resolveEzraPaths(env);
  ensureConfigDir(paths);
  const apiUrl = resolveApiUrl(env);
  output("Ezra MCP setup");
  output(`API: ${apiUrl}`);
  output("Next: ezra-mcp login --email you@example.com");
  output("After verifying your magic code: ezra-mcp key create");
  output("MCP bridge command: ezra-mcp-mcp");
  output(`Private config: ${paths.authPath}`);
  return 0;
}

async function commandLogin(
  args: string[],
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
  output: (line: string) => void
): Promise<number> {
  const parsed = parseArgs(args);
  const email = requiredFlag(parsed, "email");
  const code = firstFlag(parsed, "code");
  const apiUrl = resolveApiUrl(env);
  if (!code) {
    const body = await request<{ ok?: boolean; delivery?: string; devCode?: string }>(
      { apiUrl, token: "" },
      "/v1/magic-links/request",
      fetchImpl,
      { method: "POST", body: JSON.stringify({ email }) },
      false
    );
    output(`Magic link requested for ${normalizeEmail(email)}.`);
    output(`Delivery: ${body.delivery ?? "email"}.`);
    if (body.devCode) {
      output(`Dev code: ${body.devCode}`);
    }
    output("Verify with: ezra-mcp login --email you@example.com --code <code>");
    return 0;
  }

  const body = await request<{ token?: string }>(
    { apiUrl, token: "" },
    "/v1/magic-links/verify",
    fetchImpl,
    {
      method: "POST",
      body: JSON.stringify({
        email,
        code,
        deviceName: firstFlag(parsed, "device-name") ?? "Ezra MCP CLI"
      })
    },
    false
  );
  if (!body.token) {
    throw new Error("Magic-link verification did not return a session token.");
  }
  const paths = resolveEzraPaths(env);
  const auth = readAuth(paths);
  writeAuth(paths, { ...auth, sessionToken: body.token, updatedAt: new Date().toISOString() });
  output("Ezra session token saved locally.");
  output("Token: stored privately and not printed.");
  return 0;
}

async function commandKey(args: string[], env: NodeJS.ProcessEnv, fetchImpl: typeof fetch, output: (line: string) => void): Promise<number> {
  const [subcommand = "create", ...rest] = args;
  if (subcommand !== "create") {
    output("Usage: ezra-mcp key create [--name <label>]");
    return 1;
  }
  const parsed = parseArgs(rest);
  const config = sessionConfig(env);
  const body = await request<{ key?: string; prefix?: string; tier?: string; free_calls_remaining?: number }>(
    config,
    "/v1/api-keys",
    fetchImpl,
    {
      method: "POST",
      body: JSON.stringify({ name: firstFlag(parsed, "name") ?? "Ezra MCP local key" })
    }
  );
  if (!body.key) {
    throw new Error("API key response did not include a key.");
  }
  const paths = resolveEzraPaths(env);
  const auth = readAuth(paths);
  const nextAuth: EzraAuth = {
    ...auth,
    apiKey: body.key,
    updatedAt: new Date().toISOString()
  };
  if (body.prefix) {
    nextAuth.apiKeyPrefix = body.prefix;
  }
  writeAuth(paths, nextAuth);
  output("Ezra MCP API key saved locally.");
  output(`Prefix: ${body.prefix ?? "unknown"}`);
  output(`Tier: ${body.tier ?? "unknown"}`);
  if (typeof body.free_calls_remaining === "number") {
    output(`Free calls remaining: ${body.free_calls_remaining}`);
  }
  output("Key: stored privately and not printed.");
  return 0;
}

async function commandStatus(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch, output: (line: string) => void): Promise<number> {
  const config = accountConfig(env);
  const body = await request<{
    tier?: string;
    usage?: { used?: number; limit?: number; remaining?: number };
    apiKey?: { prefix?: string | null };
    billing?: { portal?: string };
  }>(config, "/v1/account/status", fetchImpl);
  output("Ezra MCP status");
  output(`Tier: ${body.tier ?? "unknown"}`);
  if (body.usage) {
    output(`Usage: ${body.usage.used ?? 0}/${body.usage.limit ?? 0} this month`);
    output(`Remaining: ${body.usage.remaining ?? 0}`);
  }
  if (body.apiKey?.prefix) {
    output(`Saved API key prefix: ${body.apiKey.prefix}`);
  }
  return 0;
}

async function commandCheckout(args: string[], env: NodeJS.ProcessEnv, fetchImpl: typeof fetch, output: (line: string) => void): Promise<number> {
  const parsed = parseArgs(args);
  const tier = firstFlag(parsed, "tier") === "max" ? "max" : "pro";
  const body = await request<{ url?: string | null; tier?: string }>(
    sessionConfig(env),
    "/v1/checkout/session",
    fetchImpl,
    {
      method: "POST",
      body: JSON.stringify({
        tier,
        successUrl: firstFlag(parsed, "success-url") ?? defaultCheckoutSuccessUrl,
        cancelUrl: firstFlag(parsed, "cancel-url") ?? defaultCheckoutCancelUrl
      })
    }
  );
  if (!body.url) {
    throw new Error("Checkout session did not include a URL.");
  }
  output(body.url);
  output(`Tier: ${body.tier ?? tier}`);
  output("After checkout: ezra-mcp status");
  return 0;
}

async function commandBilling(args: string[], env: NodeJS.ProcessEnv, fetchImpl: typeof fetch, output: (line: string) => void): Promise<number> {
  const [subcommand = "portal", ...rest] = args;
  if (subcommand !== "portal") {
    output("Usage: ezra-mcp billing portal");
    return 1;
  }
  const parsed = parseArgs(rest);
  const body = await request<{ url?: string | null }>(
    sessionConfig(env),
    "/v1/billing/portal",
    fetchImpl,
    {
      method: "POST",
      body: JSON.stringify({ returnUrl: firstFlag(parsed, "return-url") ?? defaultBillingReturnUrl })
    }
  );
  if (!body.url) {
    throw new Error("Billing portal response did not include a URL.");
  }
  output(body.url);
  return 0;
}

function printHelp(output: (line: string) => void): void {
  output(`Ezra MCP CLI ${ezraCliVersion}`);
  output("Commands:");
  output("  ezra-mcp setup");
  output("  ezra-mcp login --email <email> [--code <code>]");
  output("  ezra-mcp key create [--name <label>]");
  output("  ezra-mcp status");
  output("  ezra-mcp checkout [--tier pro|max]");
  output("  ezra-mcp billing portal");
}

function sessionConfig(env: NodeJS.ProcessEnv): RequestConfig {
  const token = env.EZRA_MCP_SESSION_TOKEN || readAuth(resolveEzraPaths(env)).sessionToken;
  if (!token) {
    throw new Error("Run ezra-mcp login --email <email> and verify your code before this command.");
  }
  return { apiUrl: resolveApiUrl(env), token };
}

function accountConfig(env: NodeJS.ProcessEnv): RequestConfig {
  const auth = readAuth(resolveEzraPaths(env));
  const token = env.EZRA_MCP_SESSION_TOKEN || auth.sessionToken || env.EZRA_MCP_API_KEY || auth.apiKey;
  if (!token) {
    throw new Error("Run ezra-mcp login and ezra-mcp key create first.");
  }
  return { apiUrl: resolveApiUrl(env), token };
}

function resolveApiUrl(env: NodeJS.ProcessEnv): string {
  return (env.EZRA_MCP_API_URL || defaultEzraApiUrl).replace(/\/+$/, "");
}

async function request<T>(
  config: RequestConfig,
  path: string,
  fetchImpl: typeof fetch,
  init: RequestInit = {},
  authenticated = true
): Promise<T> {
  const response = await fetchImpl(new URL(path, config.apiUrl), {
    ...init,
    headers: {
      ...(authenticated ? { authorization: `Bearer ${config.token}` } : {}),
      "content-type": "application/json",
      ...init.headers
    }
  });
  const payload = await response.json().catch(() => ({})) as { error?: unknown };
  if (!response.ok) {
    const error = typeof payload?.error === "string" ? payload.error : `Request failed with status ${response.status}`;
    throw new Error(error);
  }
  return payload as T;
}

function readAuth(paths: EzraPaths): EzraAuth {
  try {
    return JSON.parse(readFileSync(paths.authPath, "utf8")) as EzraAuth;
  } catch {
    return {};
  }
}

function writeAuth(paths: EzraPaths, auth: EzraAuth): void {
  ensureConfigDir(paths);
  writeFileSync(paths.authPath, `${JSON.stringify(auth, null, 2)}\n`, { mode: 0o600 });
  chmodSync(paths.authPath, 0o600);
}

function ensureConfigDir(paths: EzraPaths): void {
  if (!existsSync(paths.configDir)) {
    mkdirSync(paths.configDir, { recursive: true, mode: 0o700 });
  }
  chmodSync(paths.configDir, 0o700);
}

function parseArgs(args: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags = new Map<string, string[]>();
  for (let index = 0; index < args.length; index += 1) {
    const item = args[index]!;
    if (!item.startsWith("--")) {
      positional.push(item);
      continue;
    }
    const key = item.slice(2);
    const next = args[index + 1];
    const value = next && !next.startsWith("--") ? args[++index]! : "true";
    flags.set(key, [...(flags.get(key) ?? []), value]);
  }
  return { positional, flags };
}

function firstFlag(parsed: ParsedArgs, key: string): string | undefined {
  return parsed.flags.get(key)?.[0];
}

function requiredFlag(parsed: ParsedArgs, key: string): string {
  const value = firstFlag(parsed, key);
  if (!value || value === "true") {
    throw new Error(`Missing required --${key}.`);
  }
  return value;
}

function normalizeEmail(value: unknown): string {
  const email = String(value ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("valid_email_required");
  }
  return email;
}
