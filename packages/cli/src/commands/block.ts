import { execFileSync } from "node:child_process";
import {
  chmodSync,
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";

export const prayerGateAttestation = "I have prayed";
export const prayerGateDisclaimer =
  "Prayer Gate is a personal attestation. Bible Coder cannot verify private prayer and does not pray on your behalf.";
export const prayerGateInstruction = "To continue, type exactly: I have prayed";

export interface BlockCommandOptions {
  env: NodeJS.ProcessEnv;
  now: Date;
  cwd: string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
  readAttestation?: () => Promise<string> | string;
}

interface HookTarget {
  repoRoot: string;
  hookPath: string;
  hooksPathConfigured: boolean;
}

export async function runBlockCommand(args: string[], options: BlockCommandOptions): Promise<number> {
  const [subcommand = "status", ...rest] = args;
  if (subcommand === "enable") {
    return enablePrayerGate(options);
  }
  if (subcommand === "disable") {
    return disablePrayerGate(options);
  }
  if (subcommand === "status") {
    return statusPrayerGate(options);
  }
  if (subcommand === "test") {
    return runPrayerPrompt(options, { mode: "test" });
  }
  if (subcommand === "prompt") {
    return runPrayerPrompt(options, { mode: "prompt", args: rest });
  }
  if (subcommand === "doctor") {
    return doctorPromptBlocking(options);
  }
  options.stderr("Usage: bible-coder block enable|disable|status|test|prompt|doctor");
  return 1;
}

function enablePrayerGate(options: BlockCommandOptions): number {
  if (!hasPremiumEntitlement(options.env, options.now)) {
    options.stderr("Prayer Gate requires active Bible Coder premium entitlement. Run bible-coder checkout, then sync before enabling /block.");
    return 1;
  }

  const target = resolveHookTarget(options.cwd);
  mkdirSync(dirname(target.hookPath), { recursive: true, mode: 0o700 });
  const existing = existsSync(target.hookPath) ? readFileSync(target.hookPath, "utf8") : "";
  if (isBibleCoderHook(existing)) {
    options.stdout(`Prayer Gate already enabled at ${target.hookPath}`);
    return 0;
  }

  const backupPath = existing ? nextBackupPath(target.hookPath, timestampForPath(options.now)) : "";
  if (existing && backupPath) {
    renameSync(target.hookPath, backupPath);
  }
  writeFileSync(target.hookPath, renderHookScript(backupPath), { mode: 0o755 });
  chmodSync(target.hookPath, 0o755);
  options.stdout(`Prayer Gate enabled at ${target.hookPath}`);
  options.stdout(`hooksPath configured: ${target.hooksPathConfigured ? "true" : "false"}`);
  if (backupPath) {
    options.stdout(`Existing pre-push hook backed up to ${backupPath}`);
  }
  return 0;
}

function disablePrayerGate(options: BlockCommandOptions): number {
  const target = resolveHookTarget(options.cwd);
  if (!existsSync(target.hookPath)) {
    options.stdout("Prayer Gate is not enabled.");
    return 0;
  }
  const existing = readFileSync(target.hookPath, "utf8");
  if (!isBibleCoderHook(existing)) {
    options.stderr(`Refusing to modify non-Bible Coder hook at ${target.hookPath}.`);
    return 1;
  }
  const backupPath = readBackupPath(existing);
  if (backupPath && existsSync(backupPath)) {
    renameSync(backupPath, target.hookPath);
    chmodSync(target.hookPath, 0o755);
    options.stdout(`Prayer Gate disabled. Restored previous hook from ${backupPath}`);
    return 0;
  }
  rmSync(target.hookPath, { force: true });
  options.stdout("Prayer Gate disabled. No previous hook was present.");
  return 0;
}

function statusPrayerGate(options: BlockCommandOptions): number {
  const target = resolveHookTarget(options.cwd);
  const existing = existsSync(target.hookPath) ? readFileSync(target.hookPath, "utf8") : "";
  const enabled = isBibleCoderHook(existing);
  options.stdout("Prayer Gate status");
  options.stdout(`enabled: ${enabled ? "true" : "false"}`);
  options.stdout(`hook: ${target.hookPath}`);
  options.stdout(`hooksPath configured: ${target.hooksPathConfigured ? "true" : "false"}`);
  if (enabled) {
    options.stdout(`backup: ${readBackupPath(existing) || "none"}`);
  }
  return 0;
}

function doctorPromptBlocking(options: BlockCommandOptions): number {
  const home = options.env.HOME || process.env.HOME || "";
  const checks = [
    {
      name: "Codex",
      path: join(home, ".codex", "hooks.json"),
      event: "UserPromptSubmit"
    },
    {
      name: "Claude Code",
      path: join(home, ".claude", "settings.json"),
      event: "UserPromptSubmit"
    },
    {
      name: "Gemini CLI",
      path: join(home, ".gemini", "settings.json"),
      event: "BeforeAgent"
    }
  ];
  options.stdout("Prompt block doctor");
  options.stdout("Prayer Gate can check prompt-hook configuration, but it does not claim to verify prayer.");
  for (const check of checks) {
    const content = existsSync(check.path) ? readFileSync(check.path, "utf8") : "";
    const configured = content.includes(check.event) && content.includes("bible-coder block prompt");
    options.stdout(`${check.name}: ${configured ? "configured" : "not configured"} (${check.event}, ${check.path})`);
  }
  options.stdout("Startup should warn if prompt blocking is requested but the current client hook is not configured.");
  return 0;
}

async function runPrayerPrompt(options: BlockCommandOptions, input: { mode: "test" | "prompt"; args?: string[] }): Promise<number> {
  const parsed = parsePromptArgs(input.args ?? []);
  options.stdout("Psalm 23:1 (WEB)");
  options.stdout("Yahweh is my shepherd: I shall lack nothing.");
  if (parsed.remote || parsed.url) {
    options.stdout(`Remote: ${parsed.remote ?? "unknown"} ${parsed.url ?? ""}`.trim());
  }
  options.stdout(prayerGateDisclaimer);
  options.stdout(prayerGateInstruction);
  const response = options.readAttestation ? await options.readAttestation() : await readAttestationFromTty();
  if (response !== prayerGateAttestation) {
    options.stderr("Prayer Gate attestation did not match. Push aborted.");
    return 1;
  }
  options.stdout("Prayer Gate attestation accepted.");
  return 0;
}

function resolveHookTarget(cwd: string): HookTarget {
  const repoRoot = git(["rev-parse", "--show-toplevel"], cwd);
  const gitDirRaw = git(["rev-parse", "--git-dir"], cwd);
  const gitDir = isAbsolute(gitDirRaw) ? gitDirRaw : resolve(cwd, gitDirRaw);
  const configuredHooksPath = gitOptional(["config", "--get", "core.hooksPath"], cwd);
  if (configuredHooksPath) {
    return {
      repoRoot,
      hookPath: join(isAbsolute(configuredHooksPath) ? configuredHooksPath : resolve(repoRoot, configuredHooksPath), "pre-push"),
      hooksPathConfigured: true
    };
  }
  return { repoRoot, hookPath: join(gitDir, "hooks", "pre-push"), hooksPathConfigured: false };
}

function hasPremiumEntitlement(env: NodeJS.ProcessEnv, now: Date): boolean {
  const value = (env.BIBLE_CODER_PREMIUM ?? env.BIBLE_CODER_ENTITLEMENT ?? "").toLowerCase();
  if (value === "true" || value === "1" || value === "active" || value === "trialing") {
    return true;
  }
  const graceUntil = env.BIBLE_CODER_PREMIUM_GRACE_UNTIL;
  if (graceUntil) {
    const graceDate = new Date(graceUntil);
    return Number.isFinite(graceDate.getTime()) && graceDate >= now;
  }
  return false;
}

function renderHookScript(backupPath: string): string {
  return `#!/usr/bin/env bash
set -euo pipefail
# BEGIN Bible Coder Prayer Gate
BIBLE_CODER_BACKUP_HOOK=${shellQuote(backupPath)}
BIBLE_CODER_REFS_FILE="$(mktemp -t bible-coder-pre-push.XXXXXX)"
cleanup() {
  rm -f "$BIBLE_CODER_REFS_FILE"
}
trap cleanup EXIT
cat > "$BIBLE_CODER_REFS_FILE"
remote_name="\${1:-unknown}"
remote_url="\${2:-unknown}"
pending_ref_count="$(wc -l < "$BIBLE_CODER_REFS_FILE" | tr -d ' ')"
branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || echo unknown)"
commit_sha="$(git rev-parse HEAD 2>/dev/null || echo unknown)"
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
repo_hash="$(printf "%s" "$repo_root" | shasum -a 256 | awk '{print $1}')"

echo "Psalm 23:1 (WEB)" > /dev/tty
echo "Yahweh is my shepherd: I shall lack nothing." > /dev/tty
echo "Remote: $remote_name $remote_url" > /dev/tty
echo "Branch: $branch; pending refs: $pending_ref_count" > /dev/tty
echo "${prayerGateDisclaimer}" > /dev/tty
echo "${prayerGateInstruction}" > /dev/tty
printf "> " > /dev/tty
IFS= read -r response < /dev/tty

if [[ "$response" != "${prayerGateAttestation}" ]]; then
  echo "Prayer Gate attestation did not match. Push aborted." > /dev/tty
  exit 1
fi

log_dir="\${XDG_CONFIG_HOME:-$HOME/.config}/bible-coder"
mkdir -p "$log_dir" 2>/dev/null || true
chmod 700 "$log_dir" 2>/dev/null || true
printf "%s\\t%s\\t%s\\t%s\\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$repo_hash" "$branch" "$commit_sha" >> "$log_dir/block-attestations.tsv" 2>/dev/null || true

if [[ -n "$BIBLE_CODER_BACKUP_HOOK" && -x "$BIBLE_CODER_BACKUP_HOOK" ]]; then
  "$BIBLE_CODER_BACKUP_HOOK" "$@" < "$BIBLE_CODER_REFS_FILE"
fi
exit 0
# END Bible Coder Prayer Gate
`;
}

function isBibleCoderHook(content: string): boolean {
  return content.includes("BEGIN Bible Coder Prayer Gate") && content.includes("END Bible Coder Prayer Gate");
}

function readBackupPath(content: string): string {
  const match = /^BIBLE_CODER_BACKUP_HOOK='([^']*)'$/m.exec(content);
  return match?.[1] ?? "";
}

function nextBackupPath(hookPath: string, timestamp: string): string {
  let candidate = `${hookPath}.bible-coder-backup.${timestamp}`;
  let counter = 1;
  while (existsSync(candidate)) {
    candidate = `${hookPath}.bible-coder-backup.${timestamp}.${counter}`;
    counter += 1;
  }
  return candidate;
}

function timestampForPath(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function parsePromptArgs(args: string[]): { remote?: string; url?: string } {
  const parsed: { remote?: string; url?: string } = {};
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    const next = args[index + 1];
    if (value === "--remote" && next) {
      parsed.remote = next;
      index += 1;
    } else if (value === "--url" && next) {
      parsed.url = next;
      index += 1;
    }
  }
  return parsed;
}

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function gitOptional(args: string[], cwd: string): string {
  try {
    return git(args, cwd);
  } catch {
    return "";
  }
}

async function readAttestationFromTty(): Promise<string> {
  const input = createReadStream("/dev/tty", { encoding: "utf8" });
  const output = createWriteStream("/dev/tty");
  const readline = createInterface({ input, output });
  try {
    return await readline.question("> ");
  } finally {
    readline.close();
  }
}
