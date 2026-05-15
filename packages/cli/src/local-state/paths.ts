import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface LocalPaths {
  configDir: string;
  authPath: string;
  statePath: string;
  preferencesPath: string;
}

export interface LocalAuth {
  deviceId: string;
  createdAt: string;
  syncToken: string | null;
}

export interface LocalSetupPreferences {
  installedAt: string;
  mode: "local" | "cloud";
  biblePath: string | null;
  bibleId: string;
  goal: string;
  blockPreference: "pray" | "read" | "both" | "neither";
}

export function resolveLocalPaths(env: NodeJS.ProcessEnv = process.env): LocalPaths {
  const configDir = env.BIBLE_CODER_CONFIG_DIR || join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "bible-coder");
  return {
    configDir,
    authPath: join(configDir, "auth.json"),
    statePath: join(configDir, "state.sqlite"),
    preferencesPath: join(configDir, "preferences.json")
  };
}

export function ensureLocalPaths(paths: LocalPaths): void {
  mkdirSync(paths.configDir, { recursive: true, mode: 0o700 });
  chmodIfExists(paths.configDir, 0o700);
}

export function readOrCreateAuth(paths: LocalPaths, now: string, randomId: () => string): LocalAuth {
  ensureLocalPaths(paths);
  if (!existsSync(paths.authPath)) {
    const auth: LocalAuth = { deviceId: `bc_device_${randomId()}`, createdAt: now, syncToken: null };
    writePrivateJson(paths.authPath, auth);
    return auth;
  }

  chmodIfExists(paths.authPath, 0o600);
  const auth = JSON.parse(readFileSync(paths.authPath, "utf8")) as LocalAuth;
  if (!auth.deviceId || !auth.createdAt) {
    throw new Error(`Invalid auth file at ${paths.authPath}.`);
  }
  return { deviceId: auth.deviceId, createdAt: auth.createdAt, syncToken: auth.syncToken ?? null };
}

export function writeAuth(paths: LocalPaths, auth: LocalAuth): void {
  ensureLocalPaths(paths);
  writePrivateJson(paths.authPath, auth);
}

export function writeSetupPreferences(paths: LocalPaths, preferences: LocalSetupPreferences): void {
  ensureLocalPaths(paths);
  writePrivateJson(paths.preferencesPath, preferences);
}

export function chmodIfExists(path: string, mode: number): void {
  if (existsSync(path)) {
    const currentMode = statSync(path).mode & 0o777;
    if (currentMode !== mode) {
      chmodSync(path, mode);
    }
  }
}

function writePrivateJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodIfExists(path, 0o600);
}
