import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runBibleCoderCli } from "../src/index.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Bible Coder CLI free tier", () => {
  it("runs the Bibe Code first-run setup with bundled local texts by default", async () => {
    const configDir = tempConfigDir();
    const result = await run([], configDir, {}, undefined, process.cwd(), undefined, [
      "",
      "",
      "",
      "Memorize verses before shipping",
      ""
    ]);

    expect(result.code).toBe(0);
    expect(result.stderr).toEqual([]);
    expect(result.stdout.join("\n")).toContain("Bibe Code");
    expect(result.stdout.join("\n")).toContain("Stop Vibe Coding. Start Bibe Coding.");
    expect(result.stdout.join("\n")).toContain("Using bundled WEB/KJV local texts.");
    expect(result.stdout.join("\n")).toContain("Created plan plan_");
    expect(result.stdout.join("\n")).toContain("Installed Codex ambient coda hook");
    expect(result.stdout.join("\n")).toContain("Installed Claude Code ambient coda hook");
    expect(result.stdout.join("\n")).toContain("Installed Gemini CLI (experimental) ambient coda hook");
    expect(JSON.parse(readFileSync(join(configDir, "preferences.json"), "utf8"))).toMatchObject({
      mode: "local",
      bibleId: "web",
      goal: "Memorize verses before shipping",
      blockPreference: "neither"
    });
    expect(existsSync(join(configDir, "state.sqlite"))).toBe(true);
    expect(readFileSync(join(configDir, ".codex", "hooks.json"), "utf8")).toContain("bible-coder hooks run --client codex");
    expect(readFileSync(join(configDir, ".claude", "settings.json"), "utf8")).toContain("bible-coder hooks run --client claude");
    expect(readFileSync(join(configDir, ".gemini", "settings.json"), "utf8")).toContain("bible-coder hooks run --client gemini");
  });

  it("can smoke the cloud setup path against the remote API contract", async () => {
    const configDir = tempConfigDir();
    const requests: Array<{ path: string; method: string }> = [];
    const result = await run([], configDir, {
      BIBLE_CODER_API_URL: "https://api.example.com",
      BIBLE_CODER_TOKEN: "bc_test_existing"
    }, async (input, init) => {
      const url = new URL(String(input));
      requests.push({ path: url.pathname, method: init?.method ?? "GET" });
      if (url.pathname === "/v1/bibles") {
        return new Response(JSON.stringify({ bibles: [{ id: "bible_web", abbreviation: "WEB", name: "World English Bible" }] }), { status: 200 });
      }
      if (url.pathname === "/v1/device-tokens") {
        return new Response(JSON.stringify({ token: "bc_test_saved_token" }), { status: 201 });
      }
      if (url.pathname === "/v1/checkout/session") {
        return new Response(JSON.stringify({ url: "https://checkout.stripe.test/session" }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }, process.cwd(), undefined, [
      "",
      "Cloud",
      "",
      "1",
      "",
      "Read the Gospels before launch",
      "",
      "Both"
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("Available cloud Bible versions:");
    expect(result.stdout.join("\n")).toContain("https://checkout.stripe.test/session");
    expect(result.stdout.join("\n")).toContain("Prompt blocking preference saved.");
    expect(JSON.parse(readFileSync(join(configDir, "preferences.json"), "utf8"))).toMatchObject({
      mode: "cloud",
      bibleId: "bible_web",
      blockPreference: "both"
    });
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      "POST /v1/device-tokens",
      "GET /v1/bibles",
      "POST /v1/checkout/session"
    ]);
  });

  it("runs cloud login before checking catalog and keeps goals cloud-backed when the catalog is empty", async () => {
    const configDir = tempConfigDir();
    const requests: Array<{ path: string; method: string }> = [];
    const result = await run([], configDir, {
      BIBLE_CODER_API_URL: "https://api.example.com"
    }, async (input, init) => {
      const url = new URL(String(input));
      requests.push({ path: url.pathname, method: init?.method ?? "GET" });
      if (url.pathname === "/v1/device-tokens") {
        return new Response(JSON.stringify({ token: "bc_test_saved_token" }), { status: 201 });
      }
      if (url.pathname === "/v1/bibles") {
        return new Response(JSON.stringify({ bibles: [] }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }, process.cwd(), undefined, [
      "",
      "Cloud",
      "",
      "n",
      "Read one chapter before coding",
      "",
      "Neither"
    ]);

    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("Server sync token saved.");
    expect(result.stdout.join("\n")).toContain("Cloud Bible catalog has no premium versions enabled yet.");
    expect(result.stdout.join("\n")).not.toContain("Falling back to Local");
    expect(JSON.parse(readFileSync(join(configDir, "preferences.json"), "utf8"))).toMatchObject({
      mode: "cloud",
      bibleId: "web",
      goal: "Read one chapter before coding",
      blockPreference: "neither"
    });
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      "POST /v1/device-tokens",
      "GET /v1/bibles"
    ]);
  });

  it("reads local WEB/KJV passages without server access", async () => {
    const result = await run(["read", "John", "3:16", "--translation", "kjv"]);

    expect(result.code).toBe(0);
    expect(result.stderr).toEqual([]);
    expect(result.stdout.join("\n")).toContain("John 3:16 (KJV)");
    expect(result.stdout.join("\n")).toContain("only begotten Son");
    expect(result.stdout.join("\n")).toContain("Attribution: King James Version");
  });

  it("creates a local plan and records progress by reference", async () => {
    const configDir = tempConfigDir();
    const create = await run(
      ["plan", "create", "--goal", "peace before shipping", "--days", "2", "--reference", "John 3:16", "--reference", "Romans 8:28"],
      configDir,
    );
    expect(create.code).toBe(0);
    const planId = create.stdout[0]?.match(/Created plan ([^:]+):/)?.[1];
    expect(planId).toMatch(/^plan_/);

    const initial = await run(["progress", "--plan", planId ?? ""], configDir);
    expect(initial.stdout.join("\n")).toContain("0%");
    expect(initial.stdout.join("\n")).toContain("(0/2)");

    const record = await run(["progress", "record", "--plan", planId ?? "", "--reference", "John 3:16"], configDir);
    expect(record.code).toBe(0);
    expect(record.stdout.join("\n")).toContain("Recorded progress for John 3:16");

    const after = await run(["progress", "--plan", planId ?? ""], configDir);
    expect(after.stdout.join("\n")).toContain("50%");
    expect(after.stdout.join("\n")).toContain("(1/2)");
  });

  it("shows and updates the free current goal", async () => {
    const configDir = tempConfigDir();
    const empty = await run(["goal"], configDir);
    expect(empty.code).toBe(0);
    expect(empty.stdout.join("\n")).toContain("No local Bible Coder goal yet.");

    const updated = await run(["goal", "update", "--goal", "Read Luke before standup"], configDir);
    expect(updated.code).toBe(0);
    expect(updated.stdout.join("\n")).toContain("Updated goal: Read Luke before standup");

    const status = await run(["goal"], configDir);
    expect(status.code).toBe(0);
    expect(status.stdout.join("\n")).toContain("Current goal: Read Luke before standup");
    expect(status.stdout.join("\n")).toContain("Progress:");
    expect(status.stdout.join("\n")).toContain("Next:");
  });

  it("shows a coda verse from the current goal and can record progress", async () => {
    const configDir = tempConfigDir();
    const create = await run(
      ["plan", "create", "--goal", "peace before coding", "--days", "2", "--reference", "John 3:16", "--reference", "Romans 8:28"],
      configDir,
    );
    const planId = create.stdout[0]?.match(/Created plan ([^:]+):/)?.[1] ?? "";

    const coda = await run(["coda", "--record"], configDir);
    expect(coda.code).toBe(0);
    expect(coda.stdout.join("\n")).toContain("Bibe Code coda");
    expect(coda.stdout.join("\n")).toContain("Goal: peace before coding");
    expect(coda.stdout.join("\n")).toContain("Next: Day 1 - John 3:16");
    expect(coda.stdout.join("\n")).toContain("For God so loved the world");
    expect(coda.stdout.join("\n")).toContain("Recorded progress for John 3:16");
    expect(coda.stdout.join("\n")).toContain("Progress:");
    expect(coda.stdout.join("\n")).toContain("(1/2)");

    const next = await run(["coda"], configDir);
    expect(next.stdout.join("\n")).toContain("Next: Day 2 - Romans 8:28");
    expect(next.stdout.join("\n")).not.toContain("Recorded progress");

    const progress = await run(["progress", "--plan", planId], configDir);
    expect(progress.stdout.join("\n")).toContain("(1/2)");
  });

  it("shows a default coda verse before setup without recording anything", async () => {
    const result = await run(["coda"], tempConfigDir());

    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("Bibe Code coda");
    expect(result.stdout.join("\n")).toContain("John 3:16 (WEB)");
    expect(result.stdout.join("\n")).toContain("No goal is configured yet.");
  });

  it("installs ambient hook configs only after explicit confirmation", async () => {
    const configDir = tempConfigDir();
    const preview = await run(["hooks", "install", "--client", "codex"], configDir);
    expect(preview.code).toBe(0);
    expect(preview.stdout.join("\n")).toContain("Preview: would install");
    expect(existsSync(join(configDir, ".codex", "hooks.json"))).toBe(false);

    const installed = await run(["hooks", "install", "--client", "all", "--scope", "user", "--mode", "coda", "--yes"], configDir);
    expect(installed.code).toBe(0);
    expect(installed.stdout.join("\n")).toContain("Installed Codex ambient coda hook");
    expect(installed.stdout.join("\n")).toContain("Installed Claude Code ambient coda hook");
    expect(installed.stdout.join("\n")).toContain("Installed Gemini CLI (experimental) ambient coda hook");

    const codexConfig = JSON.parse(readFileSync(join(configDir, ".codex", "hooks.json"), "utf8")) as {
      hooks?: { SessionStart?: unknown[]; UserPromptSubmit?: unknown[] };
    };
    expect(codexConfig.hooks?.SessionStart).toHaveLength(1);
    expect(codexConfig.hooks?.UserPromptSubmit).toHaveLength(1);

    const doctor = await run(["hooks", "doctor", "--client", "all"], configDir);
    expect(doctor.stdout.join("\n")).toContain("Codex: installed");
    expect(doctor.stdout.join("\n")).toContain("Claude Code: installed");
    expect(doctor.stdout.join("\n")).toContain("Gemini CLI (experimental): installed");
  });

  it("preserves existing client hooks and removes only Bibe Code hooks", async () => {
    const configDir = tempConfigDir();
    const codexDir = join(configDir, ".codex");
    mkdirSync(codexDir, { recursive: true });
    writeFileSync(
      join(codexDir, "hooks.json"),
      JSON.stringify({
        hooks: {
          UserPromptSubmit: [
            {
              hooks: [{ type: "command", command: "echo keep-me" }]
            }
          ]
        }
      }, null, 2),
    );

    await run(["hooks", "install", "--client", "codex", "--yes"], configDir);
    const installed = readFileSync(join(codexDir, "hooks.json"), "utf8");
    expect(installed).toContain("echo keep-me");
    expect(installed).toContain("bible-coder hooks run --client codex");
    expect(existsSync(join(codexDir, "hooks.json.bible-coder-backup.20260514T080000Z"))).toBe(true);

    const removed = await run(["hooks", "uninstall", "--client", "codex", "--yes"], configDir);
    expect(removed.code).toBe(0);
    const after = readFileSync(join(codexDir, "hooks.json"), "utf8");
    expect(after).toContain("echo keep-me");
    expect(after).not.toContain("bible-coder hooks run --client codex");
  });

  it("runs the ambient hook adapter as user-visible JSON and records progress", async () => {
    const configDir = tempConfigDir();
    await run(
      ["plan", "create", "--goal", "peace before coding", "--days", "2", "--reference", "John 3:16", "--reference", "Romans 8:28"],
      configDir,
    );

    const hook = await run(["hooks", "run", "--client", "codex", "--event", "UserPromptSubmit", "--mode", "coda", "--record"], configDir);
    expect(hook.code).toBe(0);
    expect(hook.stderr).toEqual([]);
    expect(hook.stdout).toHaveLength(1);
    const payload = JSON.parse(hook.stdout[0] ?? "{}") as { systemMessage?: string; hookSpecificOutput?: unknown };
    expect(payload.systemMessage).toContain("Bibe Code coda");
    expect(payload.systemMessage).toContain("Goal: peace before coding");
    expect(payload.systemMessage).toContain("Recorded progress for John 3:16");
    expect(payload.hookSpecificOutput).toBeUndefined();

    const next = await run(["hooks", "run", "--client", "codex", "--event", "UserPromptSubmit", "--mode", "coda"], configDir);
    const nextPayload = JSON.parse(next.stdout[0] ?? "{}") as { systemMessage?: string };
    expect(nextPayload.systemMessage).toContain("Next: Day 2 - Romans 8:28");
  });

  it("shows and records deterministic SM-2 reviews", async () => {
    const configDir = tempConfigDir();
    const create = await run(["plan", "create", "--goal", "purpose", "--days", "1", "--reference", "Romans 8:28"], configDir);
    const planId = create.stdout[0]?.match(/Created plan ([^:]+):/)?.[1];
    expect(planId).toBeTruthy();

    const next = await run(["review"], configDir);
    expect(next.stdout.join("\n")).toContain("Next review: Romans 8:28");
    const cardId = next.stdout.find((line) => line.startsWith("Card: "))?.replace("Card: ", "");
    expect(cardId).toBe("romans.8.28-8.28");

    const recorded = await run(["review", "record", "--card", cardId ?? "", "--quality", "5"], configDir);
    expect(recorded.code).toBe(0);
    expect(recorded.stdout.join("\n")).toContain("Next due: 2026-05-15T08:00:00.000Z");
  });

  it("initializes local auth and state files with private permissions", async () => {
    const configDir = tempConfigDir();
    const result = await run(["login"], configDir);

    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("Local Bible Coder profile is ready.");
    expect(statSync(join(configDir, "auth.json")).mode & 0o777).toBe(0o600);
    expect(statSync(join(configDir, "state.sqlite")).mode & 0o777).toBe(0o600);
  });

  it("explains server setup when checkout and sync are not configured", async () => {
    expect((await run(["checkout"])).stdout.join("\n")).toContain("Run bible-coder login");
    expect((await run(["sync"])).stdout.join("\n")).toContain("Run bible-coder login");
  });

  it("issues and stores a server sync token during login", async () => {
    const configDir = tempConfigDir();
    const requests: Array<{ url: string; authorization: string | null; body: string | null }> = [];
    const result = await run(["login", "--device-name", "Codex Laptop"], configDir, {
      BIBLE_CODER_API_URL: "https://api.example.com"
    }, async (input, init) => {
      const headers = new Headers(init?.headers);
      requests.push({
        url: String(input),
        authorization: headers.get("authorization"),
        body: typeof init?.body === "string" ? init.body : null
      });
      return new Response(JSON.stringify({ token: "bc_test_sync_token" }), { status: 201 });
    });

    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("Server sync token saved.");
    expect(result.stdout.join("\n")).not.toContain("bc_test_sync_token");
    expect(requests[0]?.url).toBe("https://api.example.com/v1/device-tokens");
    expect(requests[0]?.authorization).toBeNull();
    expect(requests[0]?.body).toContain("Codex Laptop");
    expect(JSON.parse(readFileSync(join(configDir, "auth.json"), "utf8"))).toMatchObject({ syncToken: "bc_test_sync_token" });
    expect(statSync(join(configDir, "auth.json")).mode & 0o777).toBe(0o600);
  });

  it("requests Stripe Checkout from the server when configured", async () => {
    const requests: Array<{ url: string; authorization: string | null; body: string | null }> = [];
    const result = await run(["checkout", "--success-url", "https://example.com/success"], tempConfigDir(), {
      BIBLE_CODER_API_URL: "https://api.example.com",
      BIBLE_CODER_TOKEN: "bc_test_token"
    }, async (input, init) => {
      const headers = new Headers(init?.headers);
      requests.push({
        url: String(input),
        authorization: headers.get("authorization"),
        body: typeof init?.body === "string" ? init.body : null
      });
      return new Response(JSON.stringify({ url: "https://checkout.stripe.test/session" }), { status: 200 });
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toEqual(["https://checkout.stripe.test/session"]);
    expect(requests[0]?.url).toBe("https://api.example.com/v1/checkout/session");
    expect(requests[0]?.authorization).toBe("Bearer bc_test_token");
    expect(requests[0]?.body).toContain("https://example.com/success");
  });

  it("uses the saved sync token for Stripe Checkout", async () => {
    const configDir = tempConfigDir();
    await run(["login"], configDir, {
      BIBLE_CODER_API_URL: "https://api.example.com"
    }, async () => new Response(JSON.stringify({ token: "bc_test_saved_token" }), { status: 201 }));

    const requests: Array<{ authorization: string | null }> = [];
    const result = await run(["checkout"], configDir, {
      BIBLE_CODER_API_URL: "https://api.example.com"
    }, async (input, init) => {
      requests.push({ authorization: new Headers(init?.headers).get("authorization") });
      return new Response(JSON.stringify({ url: "https://checkout.stripe.test/session" }), { status: 200 });
    });

    expect(result.code).toBe(0);
    expect(result.stdout).toEqual(["https://checkout.stripe.test/session"]);
    expect(requests[0]?.authorization).toBe("Bearer bc_test_saved_token");
  });

  it("syncs local plans and progress events to the server", async () => {
    const configDir = tempConfigDir();
    const create = await run(
      ["plan", "create", "--goal", "peace", "--days", "1", "--reference", "John 3:16"],
      configDir,
    );
    const planId = create.stdout[0]?.match(/Created plan ([^:]+):/)?.[1] ?? "";
    await run(["progress", "record", "--plan", planId, "--reference", "John 3:16"], configDir);
    await run(["login"], configDir, {
      BIBLE_CODER_API_URL: "https://api.example.com"
    }, async () => new Response(JSON.stringify({ token: "bc_test_sync_token" }), { status: 201 }));

    const requests: Array<{ path: string; method: string; body: string | null }> = [];
    const result = await run(["sync"], configDir, {
      BIBLE_CODER_API_URL: "https://api.example.com"
    }, async (input, init) => {
      const url = new URL(String(input));
      requests.push({ path: url.pathname, method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : null });
      if (url.pathname === "/v1/progress" && (init?.method ?? "GET") === "GET") {
        return new Response(JSON.stringify({ events: [{ id: "pevt_1" }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: url.pathname === "/health" ? 200 : 201 });
    });

    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("Bible Coder sync connected.");
    expect(result.stdout.join("\n")).toContain("Uploaded plans: 1");
    expect(result.stdout.join("\n")).toContain("Uploaded progress events: 1");
    expect(result.stdout.join("\n")).toContain("Server progress events: 1");
    expect(requests.map((request) => `${request.method} ${request.path}`)).toEqual([
      "GET /health",
      "POST /v1/plans",
      "POST /v1/progress",
      "GET /v1/progress"
    ]);
    expect(requests[1]?.body).toContain(planId);
    expect(requests[2]?.body).toContain("john.3.16-3.16");
  });

  it("requires premium entitlement before installing Prayer Gate hooks", async () => {
    const repo = tempGitRepo();
    const result = await run(["block", "enable"], tempConfigDir(), {}, undefined, repo);

    expect(result.code).toBe(1);
    expect(result.stderr.join("\n")).toContain("requires active Bible Coder premium");
    expect(result.stdout.join("\n")).not.toContain("enabled");
  });

  it("installs Prayer Gate as a reversible pre-push wrapper", async () => {
    const repo = tempGitRepo();
    const hookPath = join(repo, ".git", "hooks", "pre-push");
    execFileSync("mkdir", ["-p", join(repo, ".git", "hooks")]);
    execFileSync("sh", ["-c", `printf '%s\\n' '#!/usr/bin/env bash' 'echo original hook' > ${JSON.stringify(hookPath)} && chmod +x ${JSON.stringify(hookPath)}`]);

    const enabled = await run(["block", "enable"], tempConfigDir(), { BIBLE_CODER_PREMIUM: "true" }, undefined, repo);
    expect(enabled.code).toBe(0);
    expect(enabled.stdout.join("\n")).toContain("Prayer Gate enabled");

    const hook = execFileSync("cat", [hookPath], { encoding: "utf8" });
    expect(hook).toContain("BEGIN Bible Coder Prayer Gate");
    expect(hook).toContain("/dev/tty");
    expect(hook).toContain("I have prayed");
    expect(hook).toContain("Bible Coder cannot verify private prayer");
    expect(hook).not.toContain("prayer verified");
    expect(hook).toMatch(/pre-push\.bible-coder-backup\.\d{8}T\d{6}Z/);

    const status = await run(["block", "status"], tempConfigDir(), {}, undefined, repo);
    expect(status.stdout.join("\n")).toContain("enabled: true");

    const disabled = await run(["block", "disable"], tempConfigDir(), {}, undefined, repo);
    expect(disabled.code).toBe(0);
    expect(disabled.stdout.join("\n")).toContain("Prayer Gate disabled");
    expect(execFileSync("cat", [hookPath], { encoding: "utf8" })).toContain("original hook");
  });

  it("requires the exact Prayer Gate attestation for block test", async () => {
    const wrong = await run(["block", "test"], tempConfigDir(), {}, undefined, process.cwd(), async () => "amen");
    expect(wrong.code).toBe(1);
    expect(wrong.stderr.join("\n")).toContain("attestation did not match");

    const exact = await run(["block", "test"], tempConfigDir(), {}, undefined, process.cwd(), async () => "I have prayed");
    expect(exact.code).toBe(0);
    expect(exact.stdout.join("\n")).toContain("Prayer Gate attestation accepted");
  });

  it("checks prompt hook coverage without mutating agent configs", async () => {
    const configDir = tempConfigDir();
    const result = await run(["block", "doctor"], configDir, { HOME: configDir });

    expect(result.code).toBe(0);
    expect(result.stdout.join("\n")).toContain("Prompt block doctor");
    expect(result.stdout.join("\n")).toContain("Codex: not configured");
    expect(result.stdout.join("\n")).toContain("Claude Code: not configured");
    expect(result.stdout.join("\n")).toContain("Gemini CLI: not configured");
  });
});

async function run(
  argv: string[],
  configDir = tempConfigDir(),
  extraEnv: NodeJS.ProcessEnv = {},
  fetchImpl?: typeof fetch,
  cwd = process.cwd(),
  readAttestation?: () => Promise<string> | string,
  promptResponses: string[] = [],
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let promptIndex = 0;
  const code = await runBibleCoderCli(argv, {
    env: { ...process.env, HOME: configDir, BIBLE_CODER_HOOK_COMMAND: "bible-coder", ...extraEnv, BIBLE_CODER_CONFIG_DIR: configDir },
    now: new Date("2026-05-14T08:00:00.000Z"),
    cwd,
    fetchImpl,
    readAttestation,
    readPrompt: (prompt) => {
      stdout.push(prompt);
      const response = promptResponses[promptIndex] ?? "";
      promptIndex += 1;
      return response;
    },
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line)
  });
  return { code, stdout, stderr };
}

function tempConfigDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "bible-coder-cli-"));
  tempDirs.push(dir);
  return dir;
}

function tempGitRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "bible-coder-git-"));
  tempDirs.push(dir);
  execFileSync("git", ["init"], { cwd: dir, stdio: "ignore" });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
  execFileSync("git", ["config", "user.name", "Bible Coder Test"], { cwd: dir });
  execFileSync("sh", ["-c", "printf 'hello\\n' > README.md"], { cwd: dir });
  execFileSync("git", ["add", "README.md"], { cwd: dir });
  execFileSync("git", ["commit", "-m", "initial"], { cwd: dir, stdio: "ignore" });
  return dir;
}
