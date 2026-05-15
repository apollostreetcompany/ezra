import { stdin as defaultStdin, stdout as defaultStdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { createPlan, getLocalPassage, localBibles, parseReference, progressBar, referenceId, summarizeProgress, type LocalTranslationId } from "@bible-coder/core";
import { runBlockCommand } from "./commands/block.js";
import { runHooksCommand } from "./commands/hooks.js";
import { resolveLocalPaths, writeAuth, writeSetupPreferences, type LocalAuth, type LocalPaths, type LocalSetupPreferences } from "./local-state/paths.js";
import { LocalStateStore } from "./local-state/store.js";

export interface CliRunOptions {
  env?: NodeJS.ProcessEnv;
  now?: Date;
  cwd?: string;
  fetchImpl?: typeof fetch;
  readAttestation?: () => Promise<string> | string;
  readPrompt?: (prompt: string) => Promise<string> | string;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}

interface ParsedArgs {
  positional: string[];
  flags: Map<string, string[]>;
}

interface ServerConfig {
  apiUrl: string;
  token: string;
}

interface CloudBibleChoice {
  id: string;
  abbreviation: string;
  name: string;
}

interface PromptReader {
  ask: (prompt: string) => Promise<string>;
  close: () => void;
}

export const bibleCoderCliVersion = "0.1.0";

export async function runBibleCoderCli(argv: string[], options: CliRunOptions = {}): Promise<number> {
  const output = options.stdout ?? console.log;
  const errorOutput = options.stderr ?? console.error;
  const env = options.env ?? process.env;
  const nowDate = options.now ?? new Date();
  const now = nowDate.toISOString();
  const paths = resolveLocalPaths(env);
  const [command = "setup", ...rest] = argv;
  const promptReader = createPromptReader(options.readPrompt);

  try {
    if (command === "setup") {
      return await withStore(paths, async (store) =>
        commandSetupWizard(store, paths, nowDate, env, options.fetchImpl ?? fetch, output, errorOutput, promptReader.ask, options.cwd ?? process.cwd()),
      );
    }
    if (command === "help" || command === "--help" || command === "-h") {
      printHelp(output);
      return 0;
    }
    if (command === "--version" || command === "-v") {
      output(bibleCoderCliVersion);
      return 0;
    }
    if (command === "login") {
      return await withStore(paths, async (store) => commandLogin(rest, store, paths, now, env, options.fetchImpl ?? fetch, output));
    }
    if (command === "checkout") {
      return await withStore(paths, async (store) => commandCheckout(rest, store, paths, now, env, options.fetchImpl ?? fetch, output));
    }
    if (command === "sync") {
      return await withStore(paths, async (store) => commandSync(store, paths, now, env, options.fetchImpl ?? fetch, output));
    }
    if (command === "block") {
      const blockOptions = {
        env,
        now: nowDate,
        cwd: options.cwd ?? process.cwd(),
        stdout: output,
        stderr: errorOutput
      };
      return await runBlockCommand(
        rest,
        options.readAttestation ? { ...blockOptions, readAttestation: options.readAttestation } : blockOptions,
      );
    }
    if (command === "hooks") {
      return await runHooksCommand(rest, {
        env,
        now: nowDate,
        cwd: options.cwd ?? process.cwd(),
        stdout: output,
        stderr: errorOutput
      });
    }
    if (command === "read") {
      return commandRead(rest, output);
    }
    if (command === "coda") {
      return await withStore(paths, async (store) => commandCoda(rest, store, now, output));
    }
    if (command === "plan") {
      return await withStore(paths, async (store) => commandPlan(rest, store, now, output));
    }
    if (command === "goal") {
      return await withStore(paths, async (store) => commandGoal(rest, store, now, output, promptReader.ask));
    }
    if (command === "progress") {
      return await withStore(paths, async (store) => commandProgress(rest, store, now, output));
    }
    if (command === "review") {
      return await withStore(paths, async (store) => commandReview(rest, store, now, output));
    }
    errorOutput(`Unknown command: ${command}`);
    printHelp(errorOutput);
    return 1;
  } catch (error) {
    errorOutput(error instanceof Error ? error.message : String(error));
    return 1;
  } finally {
    promptReader.close();
  }
}

async function commandCheckout(
  args: string[],
  store: LocalStateStore,
  paths: LocalPaths,
  now: string,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
  output: (line: string) => void,
): Promise<number> {
  const auth = store.ensureAuth(paths, now);
  const config = readServerConfig(env, auth);
  if (!config) {
    output("Stripe Checkout requires BIBLE_CODER_API_URL and a sync token. Run bible-coder login with BIBLE_CODER_API_URL set first.");
    return 0;
  }
  const parsed = parseArgs(args);
  const body = await serverRequest<{ url?: string | null }>(config, "/v1/checkout/session", fetchImpl, {
    method: "POST",
    body: JSON.stringify({
      successUrl: firstFlag(parsed, "success-url") ?? "https://bible-coder.local/checkout/success",
      cancelUrl: firstFlag(parsed, "cancel-url") ?? "https://bible-coder.local/checkout/cancel"
    })
  });
  if (!body.url) {
    throw new Error("Checkout session did not include a URL.");
  }
  output(body.url);
  return 0;
}

function printHelp(output: (line: string) => void): void {
  output(`Bible Coder CLI ${bibleCoderCliVersion}`);
  output("Commands:");
  output("  bible-coder setup");
  output("  bible-coder read <reference> [--translation web|kjv]");
  output("  bible-coder coda [--record] [--translation web|kjv]");
  output("  bible-coder plan create --goal <goal> [--title <title>] [--days <n>] [--reference <ref>...]");
  output("  bible-coder goal");
  output("  bible-coder goal update --goal <goal>");
  output("  bible-coder progress [--plan <plan-id>]");
  output("  bible-coder progress record --plan <plan-id> (--item <item-id> | --reference <ref>)");
  output("  bible-coder review [next]");
  output("  bible-coder review record --card <card-id> --quality <0-5>");
  output("  bible-coder block enable|disable|status|test|prompt|doctor");
  output("  bible-coder hooks doctor|install|uninstall|run");
  output("  bible-coder login | checkout | sync");
}

async function withStore<T>(paths: LocalPaths, callback: (store: LocalStateStore) => Promise<T> | T): Promise<T> {
  const store = await LocalStateStore.open(paths);
  try {
    return await callback(store);
  } finally {
    store.close();
  }
}

async function commandLogin(
  args: string[],
  store: LocalStateStore,
  paths: LocalPaths,
  now: string,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
  output: (line: string) => void,
): Promise<number> {
  const auth = store.ensureAuth(paths, now);
  output("Local Bible Coder profile is ready.");
  output(`Config: ${paths.configDir}`);
  output(`Device: ${auth.deviceId.slice(0, 18)}...`);
  const apiUrl = env.BIBLE_CODER_API_URL;
  if (!apiUrl) {
    output("Set BIBLE_CODER_API_URL to issue and save a server sync token.");
    return 0;
  }

  const parsed = parseArgs(args);
  const deviceName = firstFlag(parsed, "device-name") ?? auth.deviceId;
  const token = await issueDeviceToken(apiUrl, auth.syncToken ?? env.BIBLE_CODER_TOKEN, deviceName, fetchImpl);
  const updated: LocalAuth = { ...auth, syncToken: token };
  writeAuth(paths, updated);
  output("Server sync token saved.");
  output("Token: stored locally and not printed.");
  return 0;
}

async function commandSetupWizard(
  store: LocalStateStore,
  paths: LocalPaths,
  nowDate: Date,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
  output: (line: string) => void,
  errorOutput: (line: string) => void,
  readPrompt: (prompt: string) => Promise<string> | string,
  cwd: string,
): Promise<number> {
  const now = nowDate.toISOString();
  printBibeCodeIntro(output);
  if (!yes(await readPrompt("Do you want to install or configure Bibe Code? [Y/n] "))) {
    output("Setup skipped. Run bible-coder help for commands.");
    return 0;
  }

  let mode: "local" | "cloud" = normalizeMode(await readPrompt("Where do you want to install? Local or Cloud [Local] "));
  let biblePath: string | null = null;
  let bibleId = "web";
  let cloudLoginOk = false;

  if (mode === "local") {
    const pathInput = String(await readPrompt("Path to local Bible folder (blank uses bundled WEB/KJV): ")).trim();
    biblePath = pathInput || null;
    output(biblePath ? `Local Bible path recorded: ${biblePath}` : "Using bundled WEB/KJV local texts.");
  } else {
    const apiUrl = env.BIBLE_CODER_API_URL;
    if (!apiUrl) {
      output("Cloud setup needs BIBLE_CODER_API_URL. Falling back to Local with bundled WEB/KJV.");
      mode = "local";
    } else {
      if (yes(await readPrompt("Run bible-coder login now? [Y/n] "))) {
        try {
          const loginCode = await commandLogin(["--device-name", "Bibe Code CLI"], store, paths, now, env, fetchImpl, output);
          cloudLoginOk = loginCode === 0;
        } catch (error) {
          errorOutput(error instanceof Error ? error.message : String(error));
          output("Cloud login did not complete. Falling back to Local with bundled WEB/KJV.");
          mode = "local";
        }
      } else {
        output("Cloud login skipped. Falling back to Local with bundled WEB/KJV.");
        mode = "local";
      }

      if (mode === "cloud") {
        const choices = await listCloudBibleChoices(apiUrl, fetchImpl).catch(() => [] as CloudBibleChoice[]);
        if (choices.length === 0) {
          output("Cloud Bible catalog has no premium versions enabled yet.");
          output("Continuing cloud setup for free goals and sync. Custom Bibles can be requested after subscription support is ready.");
          bibleId = "web";
        } else {
          output("Available cloud Bible versions:");
          choices.forEach((choice, index) => output(`  ${index + 1}. ${choice.abbreviation} - ${choice.name} (${choice.id})`));
          bibleId = chooseBible(choices, await readPrompt("Choose a Bible version [1]: ")).id;
        }
        if (cloudLoginOk && yes(await readPrompt("Start Stripe Checkout now? [Y/n] "))) {
          await commandCheckout([], store, paths, now, env, fetchImpl, output);
        }
      }
    }
  }

  const goalInput = String(await readPrompt('What is your goal? [Read entire bible, 1 chapter at a time] ')).trim();
  const goal = goalInput || "Read entire bible, 1 chapter at a time";
  output(`Goal heard: ${goal}`);
  output("Plan: start with a 7-day reference-first plan, then adjust with /biblegoal or /biblegoal-update.");
  if (!yes(await readPrompt("Confirm this goal? [Y/n] "))) {
    output("Goal not saved. Run bible-coder setup again when ready.");
    return 0;
  }

  const plan = createPlan({
    title: `Bibe Code Goal: ${goal}`,
    goal,
    days: 7,
    items: suggestReferences(goal).map((reference, index) => ({
      day: index + 1,
      reference,
      kind: "reading"
    }))
  });
  store.savePlan(plan, now);
  output(`Created plan ${plan.id}: ${plan.title}`);
  output("Bible Coder will tell you when your goal is hit.");
  output("Use /biblegoal to view it, and /biblegoal-update to change it inside supported agent clients.");

  let blockPreference: LocalSetupPreferences["blockPreference"] = "neither";
  if (mode === "cloud" && cloudLoginOk) {
    blockPreference = normalizeBlockPreference(await readPrompt("Premium: block prompts until prayed or read a verse? Pray, Read, Both, Neither [Neither] "));
    if (blockPreference !== "neither") {
      output("Prompt blocking preference saved. Run bible-coder block doctor to verify Codex, Claude Code, and Gemini CLI hook coverage.");
    }
  }

  if (yes(await readPrompt("Install ambient Bible coda hooks for Codex, Claude Code, and Gemini CLI? [Y/n] "))) {
    await runHooksCommand(["install", "--client", "all", "--scope", "user", "--mode", "coda", "--yes"], {
      env,
      now: nowDate,
      cwd,
      stdout: output,
      stderr: errorOutput
    });
  } else {
    output("Ambient hook install skipped. Run bible-coder hooks install --client all --scope user --mode coda --yes when ready.");
  }

  writeSetupPreferences(paths, {
    installedAt: now,
    mode,
    biblePath,
    bibleId,
    goal,
    blockPreference
  });
  output(`Setup saved: ${paths.preferencesPath}`);
  return 0;
}

async function commandGoal(
  args: string[],
  store: LocalStateStore,
  now: string,
  output: (line: string) => void,
  readPrompt: (prompt: string) => Promise<string> | string,
): Promise<number> {
  const [subcommand, ...rest] = args;
  if (subcommand === "update") {
    const parsed = parseArgs(rest);
    const promptGoal = firstFlag(parsed, "goal") ?? parsed.positional.join(" ");
    const goal = promptGoal.trim() || String(await readPrompt("What is your Bible Coder goal? ")).trim();
    if (!goal) {
      throw new Error("Goal is required. Use bible-coder goal update --goal <goal>.");
    }
    const days = readPositiveInteger(firstFlag(parsed, "days") ?? "7", "days");
    const plan = createPlan({
      title: `Bibe Code Goal: ${goal}`,
      goal,
      days,
      items: suggestReferences(goal).slice(0, days).map((reference, index) => ({
        day: index + 1,
        reference,
        kind: "reading"
      }))
    });
    store.savePlan(plan, now);
    output(`Updated goal: ${goal}`);
    output(`Created plan ${plan.id}: ${plan.title}`);
    output("Goals are free. Premium only gates custom Bibles, Prayer Gate /block, and future leaderboard features.");
    return 0;
  }

  if (subcommand && subcommand !== "status") {
    output("Usage: bible-coder goal | bible-coder goal update --goal <goal>");
    return 1;
  }

  const summary = store.planProgress();
  if (!summary) {
    output("No local Bible Coder goal yet. Run bible-coder setup or bible-coder goal update --goal <goal>.");
    return 0;
  }
  const progress = summarizeProgress(summary.total, summary.completed);
  const next = store.getPlanItems(summary.plan.id).find((item) => !item.completedAt);
  output(`Current goal: ${summary.plan.goal}`);
  output(`Plan: ${summary.plan.title} (${summary.plan.id})`);
  output(`Progress: ${progressBar(progress)} (${summary.completed}/${summary.total})`);
  if (next) {
    output(`Next: Day ${next.day} - ${next.reference}`);
  } else {
    output("Next: goal complete");
  }
  return 0;
}

async function commandSync(
  store: LocalStateStore,
  paths: LocalPaths,
  now: string,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
  output: (line: string) => void,
): Promise<number> {
  const auth = store.ensureAuth(paths, now);
  const config = readServerConfig(env, auth);
  if (!config) {
    output("Server sync requires BIBLE_CODER_API_URL and a sync token. Run bible-coder login with BIBLE_CODER_API_URL set first.");
    return 0;
  }

  await serverRequest(config, "/health", fetchImpl);
  const plans = store.listPlans();
  for (const plan of plans) {
    await serverRequest(config, "/v1/plans", fetchImpl, {
      method: "POST",
      body: JSON.stringify({
        id: plan.id,
        title: plan.title,
        goal: plan.goal,
        days: plan.days,
        items: store.getPlanItems(plan.id).map((item) => ({
          id: item.id,
          day: item.day,
          reference: item.reference,
          kind: item.kind,
          ...(item.prompt ? { prompt: item.prompt } : {})
        }))
      })
    });
  }
  const progressEvents = store.listProgressEvents();
  for (const event of progressEvents) {
    await serverRequest(config, "/v1/progress", fetchImpl, {
      method: "POST",
      body: JSON.stringify({
        idempotencyKey: event.idempotencyKey,
        planId: event.planId,
        referenceId: event.itemId,
        action: event.action,
        occurredAt: event.occurredAt,
        payload: {}
      })
    });
  }
  const syncedProgress = await serverRequest<{ events?: unknown[] }>(config, "/v1/progress", fetchImpl);
  output("Bible Coder sync connected.");
  output(`Uploaded plans: ${plans.length}`);
  output(`Uploaded progress events: ${progressEvents.length}`);
  output(`Server progress events: ${Array.isArray(syncedProgress.events) ? syncedProgress.events.length : 0}`);
  return 0;
}

function commandRead(args: string[], output: (line: string) => void): number {
  const parsed = parseArgs(args);
  const translation = readTranslation(parsed);
  const reference = readReference(parsed);
  const passage = getLocalPassage(reference, translation);
  const bible = localBibles[translation];
  output(`${passage.reference} (${bible.abbreviation})`);
  for (const verse of passage.verses) {
    output(`${verse.verse}. ${verse.text}`);
  }
  output(`Attribution: ${passage.attribution}`);
  return 0;
}

function commandCoda(args: string[], store: LocalStateStore, now: string, output: (line: string) => void): number {
  const parsed = parseArgs(args);
  const translation = readTranslation(parsed);
  const shouldRecord = flagEnabled(parsed, "record");
  const summary = store.planProgress(firstFlag(parsed, "plan"));

  output("Bibe Code coda");
  if (!summary) {
    const passage = getLocalPassage("John 3:16", translation);
    const bible = localBibles[translation];
    output(`${passage.reference} (${bible.abbreviation})`);
    for (const verse of passage.verses) {
      output(`${verse.verse}. ${verse.text}`);
    }
    output("No goal is configured yet. Run bible-coder setup to start a free goal.");
    output(`Attribution: ${passage.attribution}`);
    return 0;
  }

  const items = store.getPlanItems(summary.plan.id);
  const next = items.find((item) => !item.completedAt);
  const item = next ?? items.at(-1);
  if (!item) {
    output(`Current goal: ${summary.plan.goal}`);
    output("No plan items found. Run bible-coder goal update --goal <goal>.");
    return 0;
  }

  const passage = getLocalPassage(item.reference, translation);
  const bible = localBibles[translation];
  output(`Goal: ${summary.plan.goal}`);
  output(`${next ? "Next" : "Latest"}: Day ${item.day} - ${item.reference}`);
  output(`${passage.reference} (${bible.abbreviation})`);
  for (const verse of passage.verses) {
    output(`${verse.verse}. ${verse.text}`);
  }

  if (shouldRecord && next) {
    store.markProgress(summary.plan.id, item.id, now);
    output(`Recorded progress for ${item.reference} (${item.id}).`);
  } else if (!next) {
    output("Goal complete.");
  }

  const updated = store.planProgress(summary.plan.id) ?? summary;
  const progress = summarizeProgress(updated.total, updated.completed);
  output(`Progress: ${progressBar(progress)} (${updated.completed}/${updated.total})`);
  output(`Attribution: ${passage.attribution}`);
  return 0;
}

function commandPlan(args: string[], store: LocalStateStore, now: string, output: (line: string) => void): number {
  const [subcommand = "help", ...rest] = args;
  if (subcommand !== "create") {
    output("Usage: bible-coder plan create --goal <goal> [--title <title>] [--days <n>] [--reference <ref>...]");
    return subcommand === "help" ? 0 : 1;
  }

  const parsed = parseArgs(rest);
  const goal = firstFlag(parsed, "goal") ?? parsed.positional.join(" ");
  if (!goal.trim()) {
    throw new Error("Plan goal is required. Use --goal <goal>.");
  }
  const days = readPositiveInteger(firstFlag(parsed, "days") ?? "7", "days");
  const title = firstFlag(parsed, "title") ?? `Bible Coder Plan: ${goal}`;
  const references = readPlanReferences(parsed, goal, days);
  const plan = createPlan({
    title,
    goal,
    days,
    items: references.map((reference, index) => ({
      day: Math.min(index + 1, days),
      reference,
      kind: "reading"
    }))
  });
  store.savePlan(plan, now);
  output(`Created plan ${plan.id}: ${plan.title}`);
  for (const item of plan.items) {
    output(`Day ${item.day}: ${item.reference} [${item.id}]`);
  }
  return 0;
}

function commandProgress(args: string[], store: LocalStateStore, now: string, output: (line: string) => void): number {
  const [subcommand, ...rest] = args;
  if (subcommand === "record") {
    const parsed = parseArgs(rest);
    const planId = requiredFlag(parsed, "plan");
    const itemId = firstFlag(parsed, "item") ?? referenceId(parseReference(requiredFlag(parsed, "reference")));
    const item = store.markProgress(planId, itemId, now);
    output(`Recorded progress for ${item.reference} (${item.id}).`);
    return 0;
  }

  const parsed = parseArgs(subcommand ? [subcommand, ...rest] : rest);
  const summary = store.planProgress(firstFlag(parsed, "plan"));
  if (!summary) {
    output("No local plans yet. Create one with bible-coder plan create --goal <goal>.");
    return 0;
  }
  const progress = summarizeProgress(summary.total, summary.completed);
  output(`${summary.plan.title}`);
  output(`${progressBar(progress)} (${summary.completed}/${summary.total})`);
  return 0;
}

function commandReview(args: string[], store: LocalStateStore, now: string, output: (line: string) => void): number {
  const [subcommand = "next", ...rest] = args;
  if (subcommand === "record") {
    const parsed = parseArgs(rest);
    const cardId = requiredFlag(parsed, "card");
    const quality = readReviewQuality(requiredFlag(parsed, "quality"));
    const card = store.recordReview(cardId, quality, now);
    output(`Recorded review for ${card.id}. Next due: ${card.dueAt}`);
    return 0;
  }

  if (subcommand !== "next") {
    output("Usage: bible-coder review [next] | bible-coder review record --card <id> --quality <0-5>");
    return 1;
  }

  const next = store.nextReview(now);
  if (!next) {
    output("No reviews due.");
    return 0;
  }
  output(`Next review: ${next.reference}`);
  output(`Card: ${next.card.id}`);
  output(`Due: ${next.card.dueAt}`);
  return 0;
}

function parseArgs(args: string[]): ParsedArgs {
  const positional: string[] = [];
  const flags = new Map<string, string[]>();
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value?.startsWith("--")) {
      const key = value.slice(2);
      const next = args[index + 1];
      const flagValue = next && !next.startsWith("--") ? next : "true";
      if (flagValue !== "true") {
        index += 1;
      }
      flags.set(key, [...(flags.get(key) ?? []), flagValue]);
    } else if (value !== undefined) {
      positional.push(value);
    }
  }
  return { positional, flags };
}

function readTranslation(parsed: ParsedArgs): LocalTranslationId {
  const translation = firstFlag(parsed, "translation") ?? firstFlag(parsed, "bible") ?? "web";
  if (translation !== "web" && translation !== "kjv") {
    throw new Error("Free CLI translations are limited to web or kjv.");
  }
  return translation;
}

function readReference(parsed: ParsedArgs): string {
  const reference = firstFlag(parsed, "reference") ?? parsed.positional.join(" ");
  if (!reference.trim()) {
    throw new Error("Reference is required.");
  }
  return reference;
}

function readPlanReferences(parsed: ParsedArgs, goal: string, days: number): string[] {
  const explicit = [...allFlags(parsed, "reference"), ...allFlags(parsed, "references").flatMap((value) => value.split(","))]
    .map((value) => value.trim())
    .filter(Boolean);
  const references = explicit.length > 0 ? explicit : suggestReferences(goal);
  return references.slice(0, Math.max(1, days));
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

function printBibeCodeIntro(output: (line: string) => void): void {
  output(" ____  _ _          ____          _");
  output("| __ )(_) |__   ___ / ___|___   __| | ___");
  output("|  _ \\| | '_ \\ / _ \\ |   / _ \\ / _` |/ _ \\");
  output("| |_) | | |_) |  __/ |__| (_) | (_| |  __/");
  output("|____/|_|_.__/ \\___|\\____\\___/ \\__,_|\\___|");
  output("                 +");
  output("Bibe Code");
  output("Stop Vibe Coding. Start Bibe Coding.");
}

function createPromptReader(custom?: (prompt: string) => Promise<string> | string): PromptReader {
  if (custom) {
    return {
      ask: async (prompt) => String(await custom(prompt)),
      close: () => {}
    };
  }
  if (!defaultStdin.isTTY) {
    let linesPromise: Promise<string[]> | undefined;
    return {
      ask: async (prompt) => {
        defaultStdout.write(prompt);
        linesPromise ??= readPipedPromptLines();
        const lines = await linesPromise;
        return lines.shift() ?? "";
      },
      close: () => {}
    };
  }
  const readline = createInterface({ input: defaultStdin, output: defaultStdout });
  return {
    ask: (prompt) => readline.question(prompt),
    close: () => readline.close()
  };
}

async function readPipedPromptLines(): Promise<string[]> {
  const chunks: Buffer[] = [];
  for await (const chunk of defaultStdin) {
    chunks.push(Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks).toString("utf8").split(/\r?\n/);
}

function yes(value: unknown): boolean {
  const normalized = String(value).trim().toLowerCase();
  return normalized === "" || normalized === "y" || normalized === "yes";
}

function normalizeMode(value: unknown): "local" | "cloud" {
  const normalized = String(value).trim().toLowerCase();
  return normalized === "cloud" || normalized === "c" || normalized === "2" ? "cloud" : "local";
}

function normalizeBlockPreference(value: unknown): LocalSetupPreferences["blockPreference"] {
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "pray" || normalized === "p") {
    return "pray";
  }
  if (normalized === "read" || normalized === "r") {
    return "read";
  }
  if (normalized === "both" || normalized === "b") {
    return "both";
  }
  return "neither";
}

async function listCloudBibleChoices(apiUrl: string, fetchImpl: typeof fetch): Promise<CloudBibleChoice[]> {
  const response = await fetchImpl(new URL("/v1/bibles", apiUrl));
  if (!response.ok) {
    throw new Error(`Cloud Bible catalog request failed with status ${response.status}.`);
  }
  const payload = (await response.json()) as { bibles?: Array<Partial<CloudBibleChoice>> };
  return (payload.bibles ?? [])
    .filter((choice): choice is CloudBibleChoice => Boolean(choice.id && choice.abbreviation && choice.name))
    .slice(0, 12);
}

function chooseBible(choices: CloudBibleChoice[], input: unknown): CloudBibleChoice {
  const index = Number.parseInt(String(input).trim() || "1", 10) - 1;
  return choices[index] ?? choices[0]!;
}

function firstFlag(parsed: ParsedArgs, key: string): string | undefined {
  return parsed.flags.get(key)?.[0];
}

function flagEnabled(parsed: ParsedArgs, key: string): boolean {
  const value = firstFlag(parsed, key);
  return value !== undefined && value.toLowerCase() !== "false" && value !== "0";
}

function allFlags(parsed: ParsedArgs, key: string): string[] {
  return parsed.flags.get(key) ?? [];
}

function readServerConfig(env: NodeJS.ProcessEnv, auth: LocalAuth): ServerConfig | undefined {
  const apiUrl = env.BIBLE_CODER_API_URL;
  const token = env.BIBLE_CODER_TOKEN || auth.syncToken || undefined;
  if (!apiUrl || !token) {
    return undefined;
  }
  return { apiUrl, token };
}

async function issueDeviceToken(apiUrl: string, existingToken: string | undefined, deviceName: string, fetchImpl: typeof fetch): Promise<string> {
  const body = JSON.stringify({ deviceName });
  const first = await fetchImpl(new URL("/v1/device-tokens", apiUrl), {
    method: "POST",
    headers: {
      ...(existingToken ? { authorization: `Bearer ${existingToken}` } : {}),
      "content-type": "application/json"
    },
    body
  });
  const response =
    first.status === 401 && existingToken
      ? await fetchImpl(new URL("/v1/device-tokens", apiUrl), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body
        })
      : first;
  if (!response.ok) {
    throw new Error(`Device token request failed with status ${response.status}.`);
  }
  const payload = (await response.json()) as { token?: string };
  if (!payload.token) {
    throw new Error("Device token response did not include a token.");
  }
  return payload.token;
}

async function serverRequest<T = Record<string, unknown>>(
  config: ServerConfig,
  path: string,
  fetchImpl: typeof fetch,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetchImpl(new URL(path, config.apiUrl), {
    ...init,
    headers: {
      authorization: `Bearer ${config.token}`,
      "content-type": "application/json",
      ...(init.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(`Server request failed with status ${response.status}.`);
  }
  return await response.json() as T;
}

function requiredFlag(parsed: ParsedArgs, key: string): string {
  const value = firstFlag(parsed, key);
  if (!value || value === "true") {
    throw new Error(`Missing required --${key} value.`);
  }
  return value;
}

function readPositiveInteger(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function readReviewQuality(value: string): 0 | 1 | 2 | 3 | 4 | 5 {
  const parsed = Number.parseInt(value, 10);
  if (parsed !== 0 && parsed !== 1 && parsed !== 2 && parsed !== 3 && parsed !== 4 && parsed !== 5) {
    throw new Error("Review quality must be an integer from 0 to 5.");
  }
  return parsed;
}
