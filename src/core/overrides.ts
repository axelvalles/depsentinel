import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface OverrideEntry {
  ruleId: string;
  reason: string;
  expires: string;
  createdAt: string;
}

export interface OverrideStore {
  schemaVersion: string;
  overrides: OverrideEntry[];
}

function defaults(): OverrideStore {
  return { schemaVersion: "1.0.0", overrides: [] };
}

function readStore(cwd: string): OverrideStore {
  const storePath = path.join(cwd, "depsentinel.overrides.json");
  if (!existsSync(storePath)) return defaults();
  try {
    const raw = JSON.parse(readFileSync(storePath, "utf8")) as OverrideStore;
    return { schemaVersion: raw.schemaVersion ?? "1.0.0", overrides: raw.overrides ?? [] };
  } catch {
    return defaults();
  }
}

function writeStore(cwd: string, store: OverrideStore): void {
  writeFileSync(path.join(cwd, "depsentinel.overrides.json"), JSON.stringify(store, null, 2) + "\n", "utf8");
}

export interface OverrideAddOptions {
  cwd?: string;
  ruleId: string;
  reason: string;
  expires: string;
}

export function overrideAdd(options: OverrideAddOptions): OverrideStore {
  const cwd = options.cwd ?? process.cwd();
  const store = readStore(cwd);
  store.overrides = store.overrides.filter((e) => e.ruleId !== options.ruleId);
  store.overrides.push({
    ruleId: options.ruleId,
    reason: options.reason,
    expires: options.expires,
    createdAt: new Date().toISOString().split("T")[0]
  });
  writeStore(cwd, store);
  return store;
}

export function overrideRemove(ruleId: string, cwd?: string): OverrideStore {
  const dir = cwd ?? process.cwd();
  const store = readStore(dir);
  store.overrides = store.overrides.filter((e) => e.ruleId !== ruleId);
  writeStore(dir, store);
  return store;
}

export function overrideList(cwd?: string): OverrideStore {
  return readStore(cwd ?? process.cwd());
}

export function isOverridden(ruleId: string, cwd?: string): boolean {
  const store = readStore(cwd ?? process.cwd());
  const entry = store.overrides.find((e) => e.ruleId === ruleId);
  if (!entry) return false;
  const expires = new Date(entry.expires);
  if (expires < new Date()) return false;
  return true;
}
