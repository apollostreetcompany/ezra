import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { getLocalPassage, localBibles, progressBar, summarizeProgress, type LocalTranslationId } from "@bible-coder/core";
import { resolveLocalPaths } from "../local-state/paths.js";
import { LocalStateStore } from "../local-state/store.js";

export interface HooksCommandOptions {
  env: NodeJS.ProcessEnv;
  now: Date;
  cwd: string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

type HookClient = "codex" | "claude" | "gemini";
type HookScope = "user" | "project";
type HookMode = "coda" | "block";
type JsonObject = Record<string, unknown>;

interface ParsedArgs {
  positional: string[];
  flags: Map<string, string[]>;
}

interface HookTarget {
  client: HookClient;
  label: string;
  path: string;
  events: HookEventInstall[];
  experimental?: true;
}

interface HookEventInstall {
  event: string;
  matcher?: string;
  record: boolean;
}

const bibeHookCommandMarker = "hooks run";

export async function runHooksCommand(args: string[], options: HooksCommandOptions): Promise<number> {
  const [subcommand = "help", ...rest] = args;
  if (subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    printHooksHelp(options.stdout);
    return 0;
  }
  if (subcommand === "doctor") {
    return doctorHooks(rest, options);
  }
  if (subcommand === "install") {
    return installHooks(rest, options);
  }
  if (subcommand === "uninstall") {
    return uninstallHooks(rest, options);
  }
  if (subcommand === "run") {
    return runHookAdapter(rest, options);
  }
  options.stderr(`Unknown hooks command: ${subcommand}`);
  printHooksHelp(options.stderr);
  return 1;
}

function printHooksHelp(output: (line: string) => void): void {
  output("Usage:");
  output("  bible-coder hooks doctor [--client codex|claude|gemini|all] [--scope user|project]");
  output("  bible-coder hooks install [--client codex|claude|gemini|all] [--scope user|project] [--mode coda] [--yes]");
  output("  bible-coder hooks uninstall [--client codex|claude|gemini|all] [--scope user|project] [--yes]");
  output("  bible-coder hooks run --client <client> --event <event> [--record] [--translation web|kjv]");
}

function doctorHooks(args: string[], options: HooksCommandOptions): number {
  const parsed = parseArgs(args);
  const targets = hookTargets(readClients(parsed), readScope(parsed), options);
  options.stdout("Bibe Code hook doctor");
  for (const target of targets) {
    const config = readConfig(target.path);
    const installed = target.events.some((event) => hasBibeHook(config, event.event));
    const suffix = target.experimental ? " (experimental)" : "";
    options.stdout(`${target.label}${suffix}: ${installed ? "installed" : "not configured"} (${target.path})`);
  }
  return 0;
}

function installHooks(args: string[], options: HooksCommandOptions): number {
  const parsed = parseArgs(args);
  const mode = readMode(parsed);
  if (mode === "block") {
    options.stderr("Prompt /block hooks are not installed by this v1 ambient coda command yet. Use bible-coder block enable for the Git pre-push Prayer Gate.");
    return 1;
  }
  const confirmed = flagEnabled(parsed, "yes");
  const targets = hookTargets(readClients(parsed), readScope(parsed), options);
  const baseCommand = hookBaseCommand(options.env);
  if (!confirmed) {
    options.stdout("Preview: would install Bibe Code ambient coda hooks.");
    for (const target of targets) {
      options.stdout(`${target.label}: ${target.path}`);
      for (const event of target.events) {
        options.stdout(`  ${event.event}: ${buildRunCommand(baseCommand, target.client, event.event, mode, event.record)}`);
      }
    }
    options.stdout("Re-run with --yes to write config files.");
    return 0;
  }

  for (const target of targets) {
    const config = readConfig(target.path);
    removeBibeHooks(config);
    for (const event of target.events) {
      addBibeHook(config, target, event, buildRunCommand(baseCommand, target.client, event.event, mode, event.record));
    }
    writeConfig(target.path, config, options.now);
    const suffix = target.experimental ? " (experimental)" : "";
    options.stdout(`Installed ${target.label}${suffix} ambient coda hook: ${target.path}`);
  }
  options.stdout("Open a new agent session. Codex may ask you to review/trust the new hook once via /hooks before it runs.");
  return 0;
}

function uninstallHooks(args: string[], options: HooksCommandOptions): number {
  const parsed = parseArgs(args);
  const confirmed = flagEnabled(parsed, "yes");
  const targets = hookTargets(readClients(parsed), readScope(parsed), options);
  if (!confirmed) {
    options.stdout("Preview: would remove Bibe Code ambient hooks from:");
    targets.forEach((target) => options.stdout(`${target.label}: ${target.path}`));
    options.stdout("Re-run with --yes to write config files.");
    return 0;
  }

  for (const target of targets) {
    const config = readConfig(target.path);
    const changed = removeBibeHooks(config);
    if (changed) {
      writeConfig(target.path, config, options.now);
      options.stdout(`Removed ${target.label} ambient coda hook: ${target.path}`);
    } else {
      options.stdout(`${target.label}: no Bibe Code ambient hook found (${target.path})`);
    }
  }
  return 0;
}

async function runHookAdapter(args: string[], options: HooksCommandOptions): Promise<number> {
  const parsed = parseArgs(args);
  const translation = readTranslation(parsed);
  const shouldRecord = flagEnabled(parsed, "record");
  const paths = resolveLocalPaths(options.env);
  let store: LocalStateStore | undefined;
  try {
    store = await LocalStateStore.open(paths);
    const systemMessage = renderCodaMessage(store, options.now.toISOString(), translation, shouldRecord);
    options.stdout(JSON.stringify({ systemMessage, suppressOutput: true }));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.stdout(JSON.stringify({ systemMessage: `Bibe Code coda unavailable: ${message}`, suppressOutput: true }));
    return 0;
  } finally {
    store?.close();
  }
}

function renderCodaMessage(store: LocalStateStore, now: string, translation: LocalTranslationId, shouldRecord: boolean): string {
  const lines: string[] = ["Bibe Code coda"];
  const summary = store.planProgress();
  if (!summary) {
    const passage = getLocalPassage("John 3:16", translation);
    const bible = localBibles[translation];
    lines.push(`${passage.reference} (${bible.abbreviation})`);
    for (const verse of passage.verses) {
      lines.push(`${verse.verse}. ${verse.text}`);
    }
    lines.push("No goal is configured yet. Run bible-coder setup to start a free goal.");
    lines.push(`Attribution: ${passage.attribution}`);
    return lines.join("\n");
  }

  const items = store.getPlanItems(summary.plan.id);
  const next = items.find((item) => !item.completedAt);
  const item = next ?? items.at(-1);
  if (!item) {
    lines.push(`Current goal: ${summary.plan.goal}`);
    lines.push("No plan items found. Run bible-coder goal update --goal <goal>.");
    return lines.join("\n");
  }

  const passage = getLocalPassage(item.reference, translation);
  const bible = localBibles[translation];
  lines.push(`Goal: ${summary.plan.goal}`);
  lines.push(`${next ? "Next" : "Latest"}: Day ${item.day} - ${item.reference}`);
  lines.push(`${passage.reference} (${bible.abbreviation})`);
  for (const verse of passage.verses) {
    lines.push(`${verse.verse}. ${verse.text}`);
  }

  if (shouldRecord && next) {
    store.markProgress(summary.plan.id, item.id, now);
    lines.push(`Recorded progress for ${item.reference} (${item.id}).`);
  } else if (!next) {
    lines.push("Goal complete.");
  }

  const updated = store.planProgress(summary.plan.id) ?? summary;
  const progress = summarizeProgress(updated.total, updated.completed);
  lines.push(`Progress: ${progressBar(progress)} (${updated.completed}/${updated.total})`);
  lines.push(`Attribution: ${passage.attribution}`);
  return lines.join("\n");
}

function hookTargets(clients: HookClient[], scope: HookScope, options: HooksCommandOptions): HookTarget[] {
  const home = options.env.HOME || homedir();
  return clients.map((client) => {
    if (client === "codex") {
      return {
        client,
        label: "Codex",
        path: scope === "user" ? join(home, ".codex", "hooks.json") : join(resolve(options.cwd), ".codex", "hooks.json"),
        events: [
          { event: "SessionStart", matcher: "startup|resume", record: false },
          { event: "UserPromptSubmit", record: true }
        ]
      };
    }
    if (client === "claude") {
      return {
        client,
        label: "Claude Code",
        path: scope === "user" ? join(home, ".claude", "settings.json") : join(resolve(options.cwd), ".claude", "settings.local.json"),
        events: [
          { event: "SessionStart", matcher: "startup|resume", record: false },
          { event: "UserPromptSubmit", record: true }
        ]
      };
    }
    return {
      client,
      label: "Gemini CLI",
      path: scope === "user" ? join(home, ".gemini", "settings.json") : join(resolve(options.cwd), ".gemini", "settings.json"),
      experimental: true,
      events: [
        { event: "SessionStart", record: false },
        { event: "BeforeAgent", record: true }
      ]
    };
  });
}

function addBibeHook(config: JsonObject, target: HookTarget, event: HookEventInstall, command: string): void {
  const hooks = ensureHooks(config);
  const groupsValue = hooks[event.event];
  const groups = Array.isArray(groupsValue) ? [...groupsValue] : [];
  groups.push(makeHookGroup(target, event, command));
  hooks[event.event] = groups;
}

function makeHookGroup(target: HookTarget, event: HookEventInstall, command: string): JsonObject {
  const handler: JsonObject =
    target.client === "gemini"
      ? {
          type: "command",
          name: "bibe-code-coda",
          command,
          timeout: 5000,
          description: "Show the current Bibe Code goal verse without adding it to model context."
        }
      : {
          type: "command",
          command,
          timeout: 5,
          statusMessage: "Bibe Code coda"
        };
  const group: JsonObject = { hooks: [handler] };
  if (event.matcher) {
    group.matcher = event.matcher;
  }
  return group;
}

function hasBibeHook(config: JsonObject, event: string): boolean {
  const hooks = asRecord(config.hooks);
  if (!hooks) {
    return false;
  }
  const groups = hooks[event];
  if (!Array.isArray(groups)) {
    return false;
  }
  return groups.some((group) => {
    const groupObject = asRecord(group);
    const handlers = groupObject ? groupObject.hooks : undefined;
    return Array.isArray(handlers) && handlers.some(isBibeHook);
  });
}

function removeBibeHooks(config: JsonObject): boolean {
  const hooks = asRecord(config.hooks);
  if (!hooks) {
    return false;
  }
  let changed = false;
  for (const event of Object.keys(hooks)) {
    const groupsValue = hooks[event];
    if (!Array.isArray(groupsValue)) {
      continue;
    }
    const nextGroups: unknown[] = [];
    for (const group of groupsValue) {
      const groupObject = asRecord(group);
      if (!groupObject || !Array.isArray(groupObject.hooks)) {
        nextGroups.push(group);
        continue;
      }
      const nextHandlers = groupObject.hooks.filter((handler) => !isBibeHook(handler));
      if (nextHandlers.length !== groupObject.hooks.length) {
        changed = true;
      }
      if (nextHandlers.length > 0) {
        nextGroups.push({ ...groupObject, hooks: nextHandlers });
      } else {
        changed = true;
      }
    }
    if (nextGroups.length > 0) {
      hooks[event] = nextGroups;
    } else {
      delete hooks[event];
    }
  }
  return changed;
}

function isBibeHook(value: unknown): boolean {
  const object = asRecord(value);
  if (!object) {
    return false;
  }
  const command = typeof object.command === "string" ? object.command : "";
  const name = typeof object.name === "string" ? object.name : "";
  return name === "bibe-code-coda" || (command.includes(bibeHookCommandMarker) && command.includes("--mode coda"));
}

function readConfig(path: string): JsonObject {
  if (!existsSync(path)) {
    return {};
  }
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  const object = asRecord(parsed);
  if (!object) {
    throw new Error(`Expected JSON object in ${path}.`);
  }
  return { ...object };
}

function writeConfig(path: string, config: JsonObject, now: Date): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (existsSync(path)) {
    copyFileSync(path, `${path}.bible-coder-backup.${timestampForPath(now)}`);
  }
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
}

function ensureHooks(config: JsonObject): JsonObject {
  const existing = asRecord(config.hooks);
  if (existing) {
    config.hooks = existing;
    return existing;
  }
  const hooks: JsonObject = {};
  config.hooks = hooks;
  return hooks;
}

function hookBaseCommand(env: NodeJS.ProcessEnv): string {
  const override = env.BIBLE_CODER_HOOK_COMMAND?.trim();
  if (override) {
    return override;
  }
  const script = process.argv[1] || "bible-coder";
  if (script.endsWith("bible-coder") || script.endsWith("bible-coder-mcp")) {
    return shellQuote(script);
  }
  return `${shellQuote(process.execPath)} ${shellQuote(script)}`;
}

function buildRunCommand(baseCommand: string, client: HookClient, event: string, mode: HookMode, record: boolean): string {
  return `${baseCommand} hooks run --client ${client} --event ${event} --mode ${mode}${record ? " --record" : ""}`;
}

function readClients(parsed: ParsedArgs): HookClient[] {
  const value = firstFlag(parsed, "client") ?? firstFlag(parsed, "clients") ?? "all";
  const clients = value
    .split(",")
    .map((client) => client.trim().toLowerCase())
    .filter(Boolean);
  if (clients.length === 0 || clients.includes("all")) {
    return ["codex", "claude", "gemini"];
  }
  return clients.map((client) => {
    if (client === "codex" || client === "claude" || client === "gemini") {
      return client;
    }
    throw new Error(`Unsupported hook client: ${client}. Use codex, claude, gemini, or all.`);
  });
}

function readScope(parsed: ParsedArgs): HookScope {
  const value = (firstFlag(parsed, "scope") ?? "user").toLowerCase();
  if (value === "user" || value === "project") {
    return value;
  }
  throw new Error("Hook scope must be user or project.");
}

function readMode(parsed: ParsedArgs): HookMode {
  const value = (firstFlag(parsed, "mode") ?? "coda").toLowerCase();
  if (value === "coda" || value === "block") {
    return value;
  }
  throw new Error("Hook mode must be coda or block.");
}

function readTranslation(parsed: ParsedArgs): LocalTranslationId {
  const translation = firstFlag(parsed, "translation") ?? firstFlag(parsed, "bible") ?? "web";
  if (translation !== "web" && translation !== "kjv") {
    throw new Error("Hook coda translations are limited to web or kjv.");
  }
  return translation;
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

function firstFlag(parsed: ParsedArgs, key: string): string | undefined {
  return parsed.flags.get(key)?.[0];
}

function flagEnabled(parsed: ParsedArgs, key: string): boolean {
  const value = firstFlag(parsed, key);
  return value !== undefined && value.toLowerCase() !== "false" && value !== "0";
}

function asRecord(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : undefined;
}

function timestampForPath(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
