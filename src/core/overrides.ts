import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface OverrideEntry {
  ruleId: string;
  reason: string;
  expires: string;
  createdAt: string;
}

export interface DepsentinelConfig {
  schemaVersion: string;
  preset: string;
  policyCatalog: string;
  failOn: string[];
  overrides: OverrideEntry[];
}

const CONFIG_FILE = "depsentinel.json";

function defaults(): DepsentinelConfig {
  return { schemaVersion: "1.0.0", preset: "base", policyCatalog: "v1", failOn: ["critical"], overrides: [] };
}

function readConfig(cwd: string): DepsentinelConfig {
  const filePath = path.join(cwd, CONFIG_FILE);
  if (!existsSync(filePath)) return defaults();
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8")) as Partial<DepsentinelConfig>;
    return {
      schemaVersion: raw.schemaVersion ?? "1.0.0",
      preset: raw.preset ?? "base",
      policyCatalog: raw.policyCatalog ?? "v1",
      failOn: raw.failOn ?? ["critical"],
      overrides: raw.overrides ?? []
    };
  } catch {
    return defaults();
  }
}

function writeConfig(cwd: string, config: DepsentinelConfig): void {
  writeFileSync(path.join(cwd, CONFIG_FILE), JSON.stringify(config, null, 2) + "\n", "utf8");
}

export interface OverrideAddOptions {
  cwd?: string;
  ruleId: string;
  reason: string;
  expires: string;
}

export function overrideAdd(options: OverrideAddOptions): DepsentinelConfig {
  const cwd = options.cwd ?? process.cwd();
  const config = readConfig(cwd);
  config.overrides = config.overrides.filter((e) => e.ruleId !== options.ruleId);
  config.overrides.push({
    ruleId: options.ruleId,
    reason: options.reason,
    expires: options.expires,
    createdAt: new Date().toISOString().split("T")[0]
  });
  writeConfig(cwd, config);
  return config;
}

export function overrideRemove(ruleId: string, cwd?: string): DepsentinelConfig {
  const cwd_ = cwd ?? process.cwd();
  const config = readConfig(cwd_);
  config.overrides = config.overrides.filter((e) => e.ruleId !== ruleId);
  writeConfig(cwd_, config);
  return config;
}

export function overrideList(cwd?: string): DepsentinelConfig {
  return readConfig(cwd ?? process.cwd());
}

export function isOverridden(ruleId: string, cwd?: string): boolean {
  const config = readConfig(cwd ?? process.cwd());
  const entry = config.overrides.find((e) => e.ruleId === ruleId);
  if (!entry) return false;
  return new Date(entry.expires) >= new Date();
}
