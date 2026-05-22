import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { detectProjectFacts } from "../core/detector.js";
import { applySafePlan, planSafeFile } from "../core/safe-write.js";
import type { PackageManager } from "../types/contracts.js";

type TrustMode = "allow-build" | "ignore-build";
type TrustAction = "add" | "remove" | "list";

type Manager = Exclude<PackageManager, "unknown">;

export interface TrustOptions {
  action: TrustAction;
  packageName?: string;
  mode?: TrustMode;
  manager?: PackageManager;
  cwd?: string;
  dryRun?: boolean;
  json?: boolean;
}

interface DepsentinelTrustStore {
  allowBuild: Record<Manager, string[]>;
  ignoreBuild: Record<Manager, string[]>;
}

interface DepsentinelConfigLike {
  schemaVersion?: string;
  preset?: string;
  policyCatalog?: string;
  failOn?: string[];
  overrides?: unknown[];
  trust?: DepsentinelTrustStore;
}

interface PackageJsonLike {
  trustedDependencies?: string[];
  dependenciesMeta?: Record<string, { built?: boolean }>;
  [key: string]: unknown;
}

interface TrustListResult {
  manager: Manager;
  allowBuild: string[];
  ignoreBuild: string[];
  source: {
    allowBuild: "native" | "depsentinel";
    ignoreBuild: "native" | "depsentinel";
  };
  entries: {
    allowBuild: Array<{ packageName: string; source: "native" | "depsentinel" }>;
    ignoreBuild: Array<{ packageName: string; source: "native" | "depsentinel" }>;
  };
}

const MANAGERS: Manager[] = ["pnpm", "npm", "yarn", "bun"];

function quoteYamlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/\"/g, '\\\"')}"`;
}

function emptyTrustStore(): DepsentinelTrustStore {
  return {
    allowBuild: { pnpm: [], npm: [], yarn: [], bun: [] },
    ignoreBuild: { pnpm: [], npm: [], yarn: [], bun: [] }
  };
}

function readJsonSafe<T>(filePath: string, fallback: T): T {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function readDepsentinelConfig(cwd: string): DepsentinelConfigLike {
  const configPath = path.join(cwd, "depsentinel.json");
  const fallback: DepsentinelConfigLike = {
    schemaVersion: "1.0.0",
    preset: "base",
    policyCatalog: "v1",
    failOn: ["critical"],
    overrides: [],
    trust: emptyTrustStore()
  };
  const raw = readJsonSafe<DepsentinelConfigLike>(configPath, fallback);
  const trust = raw.trust ?? emptyTrustStore();
  return {
    ...fallback,
    ...raw,
    trust: {
      allowBuild: {
        pnpm: uniqueSorted(trust.allowBuild?.pnpm ?? []),
        npm: uniqueSorted(trust.allowBuild?.npm ?? []),
        yarn: uniqueSorted(trust.allowBuild?.yarn ?? []),
        bun: uniqueSorted(trust.allowBuild?.bun ?? [])
      },
      ignoreBuild: {
        pnpm: uniqueSorted(trust.ignoreBuild?.pnpm ?? []),
        npm: uniqueSorted(trust.ignoreBuild?.npm ?? []),
        yarn: uniqueSorted(trust.ignoreBuild?.yarn ?? []),
        bun: uniqueSorted(trust.ignoreBuild?.bun ?? [])
      }
    }
  };
}

function parsePnpmWorkspace(content: string): {
  lines: string[];
  allowBuilds: Set<string>;
  ignoreBuiltDependencies: Set<string>;
} {
  const lines = content.split(/\r?\n/);
  const allowBuilds = new Set<string>();
  const ignoreBuiltDependencies = new Set<string>();

  let inAllowBuilds = false;
  let inIgnoreList = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^allowBuilds\s*:\s*$/.test(trimmed)) {
      inAllowBuilds = true;
      inIgnoreList = false;
      continue;
    }
    if (/^ignoreBuiltDependencies\s*:\s*$/.test(trimmed)) {
      inIgnoreList = true;
      inAllowBuilds = false;
      continue;
    }
    if (/^\S[^:]*\s*:/.test(line)) {
      inAllowBuilds = false;
      inIgnoreList = false;
    }

    if (inAllowBuilds) {
      const match = trimmed.match(/^([@a-zA-Z0-9._\/-]+)\s*:\s*(true|false)\s*$/);
      if (match && match[2] === "true") allowBuilds.add(match[1]);
    }

    if (inIgnoreList) {
      const match = trimmed.match(/^-\s+"?([@a-zA-Z0-9._\/-]+)"?\s*$/);
      if (match) ignoreBuiltDependencies.add(match[1]);
    }
  }

  return { lines, allowBuilds, ignoreBuiltDependencies };
}

function renderPnpmWorkspace(state: ReturnType<typeof parsePnpmWorkspace>): string {
  const out = [...state.lines];

  const hasAllow = out.some((line) => /^\s*allowBuilds\s*:\s*$/.test(line));
  if (!hasAllow) out.push("allowBuilds:");
  const allowIndex = out.findIndex((line) => /^\s*allowBuilds\s*:\s*$/.test(line));
  let allowEnd = allowIndex + 1;
  while (allowEnd < out.length) {
    const trimmed = out[allowEnd].trim();
    if (!trimmed || trimmed.startsWith("#")) {
      allowEnd += 1;
      continue;
    }
    if (/^[a-zA-Z]/.test(trimmed) && !trimmed.startsWith("- ")) break;
    allowEnd += 1;
  }
  out.splice(allowIndex + 1, allowEnd - (allowIndex + 1));
  out.splice(allowIndex + 1, 0, ...[...state.allowBuilds].sort().map((name) => `  ${name}: true`));

  const hasIgnore = out.some((line) => /^\s*ignoreBuiltDependencies\s*:\s*$/.test(line));
  if (!hasIgnore) {
    if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
    out.push("ignoreBuiltDependencies:");
  }
  const ignoreIndex = out.findIndex((line) => /^\s*ignoreBuiltDependencies\s*:\s*$/.test(line));
  let ignoreEnd = ignoreIndex + 1;
  while (ignoreEnd < out.length) {
    const trimmed = out[ignoreEnd].trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("- ")) {
      ignoreEnd += 1;
      continue;
    }
    if (/^[a-zA-Z]/.test(trimmed)) break;
    ignoreEnd += 1;
  }
  out.splice(ignoreIndex + 1, ignoreEnd - (ignoreIndex + 1));
  out.splice(
    ignoreIndex + 1,
    0,
    ...[...state.ignoreBuiltDependencies].sort().map((name) => `  - ${quoteYamlString(name)}`)
  );

  return `${out.join("\n").replace(/\n*$/, "\n")}`;
}

function ensurePnpmWorkspace(cwd: string): string {
  const filePath = path.join(cwd, "pnpm-workspace.yaml");
  if (existsSync(filePath)) return readFileSync(filePath, "utf8");
  return ["packages:", "  - \".\"", "", "allowBuilds:", "", "ignoreBuiltDependencies:", ""].join("\n");
}

function updateDepsentinelTrust(
  config: DepsentinelConfigLike,
  manager: Manager,
  mode: TrustMode,
  action: TrustAction,
  pkg: string
): DepsentinelConfigLike {
  const next = { ...config, trust: config.trust ?? emptyTrustStore() };
  const list = mode === "allow-build" ? next.trust!.allowBuild[manager] : next.trust!.ignoreBuild[manager];
  const other = mode === "allow-build" ? next.trust!.ignoreBuild[manager] : next.trust!.allowBuild[manager];

  if (action === "add") {
    if (!list.includes(pkg)) list.push(pkg);
    const otherIdx = other.indexOf(pkg);
    if (otherIdx >= 0) other.splice(otherIdx, 1);
  } else if (action === "remove") {
    const idx = list.indexOf(pkg);
    if (idx >= 0) list.splice(idx, 1);
  }

  next.trust!.allowBuild[manager] = uniqueSorted(next.trust!.allowBuild[manager]);
  next.trust!.ignoreBuild[manager] = uniqueSorted(next.trust!.ignoreBuild[manager]);
  return next;
}

function listForManager(cwd: string, manager: Manager): TrustListResult {
  if (manager === "pnpm") {
    const parsed = parsePnpmWorkspace(ensurePnpmWorkspace(cwd));
    return {
      manager,
      allowBuild: [...parsed.allowBuilds].sort(),
      ignoreBuild: [...parsed.ignoreBuiltDependencies].sort(),
      source: { allowBuild: "native", ignoreBuild: "native" },
      entries: {
        allowBuild: [...parsed.allowBuilds].sort().map((packageName) => ({ packageName, source: "native" })),
        ignoreBuild: [...parsed.ignoreBuiltDependencies].sort().map((packageName) => ({ packageName, source: "native" }))
      }
    };
  }

  if (manager === "bun") {
    const pkgPath = path.join(cwd, "package.json");
    const pkg = readJsonSafe<PackageJsonLike>(pkgPath, {});
    const config = readDepsentinelConfig(cwd);
    return {
      manager,
      allowBuild: uniqueSorted(pkg.trustedDependencies ?? []),
      ignoreBuild: config.trust?.ignoreBuild.bun ?? [],
      source: { allowBuild: "native", ignoreBuild: "depsentinel" },
      entries: {
        allowBuild: uniqueSorted(pkg.trustedDependencies ?? []).map((packageName) => ({ packageName, source: "native" })),
        ignoreBuild: (config.trust?.ignoreBuild.bun ?? []).map((packageName) => ({
          packageName,
          source: "depsentinel"
        }))
      }
    };
  }

  if (manager === "yarn") {
    const pkgPath = path.join(cwd, "package.json");
    const pkg = readJsonSafe<PackageJsonLike>(pkgPath, {});
    const meta = pkg.dependenciesMeta ?? {};
    const allowBuild = Object.entries(meta)
      .filter(([, v]) => v.built === true)
      .map(([name]) => name)
      .sort();
    const ignoreBuild = Object.entries(meta)
      .filter(([, v]) => v.built === false)
      .map(([name]) => name)
      .sort();
    return {
      manager,
      allowBuild,
      ignoreBuild,
      source: { allowBuild: "native", ignoreBuild: "native" },
      entries: {
        allowBuild: allowBuild.map((packageName) => ({ packageName, source: "native" })),
        ignoreBuild: ignoreBuild.map((packageName) => ({ packageName, source: "native" }))
      }
    };
  }

  const config = readDepsentinelConfig(cwd);
  return {
    manager,
    allowBuild: config.trust?.allowBuild.npm ?? [],
    ignoreBuild: config.trust?.ignoreBuild.npm ?? [],
    source: { allowBuild: "depsentinel", ignoreBuild: "depsentinel" },
    entries: {
      allowBuild: (config.trust?.allowBuild.npm ?? []).map((packageName) => ({ packageName, source: "depsentinel" })),
      ignoreBuild: (config.trust?.ignoreBuild.npm ?? []).map((packageName) => ({ packageName, source: "depsentinel" }))
    }
  };
}

function toManager(value: PackageManager): Manager | null {
  if (value === "unknown") return null;
  return value;
}

export function runTrust(options: TrustOptions): { output: string; exitCode: number } {
  const cwd = options.cwd ?? process.cwd();
  const dryRun = options.dryRun ?? true;
  const facts = detectProjectFacts(cwd);
  const resolvedManager = toManager(options.manager ?? facts.packageManager);

  if (!resolvedManager) {
    const output = options.json
      ? JSON.stringify({ command: "trust", error: "could not detect package manager; pass --pm" }, null, 2)
      : "Could not detect package manager. Pass --pm npm|pnpm|yarn|bun.";
    return { output, exitCode: 1 };
  }

  if (options.action === "list") {
    const list = listForManager(cwd, resolvedManager);
    const output = options.json
      ? JSON.stringify({ command: "trust", action: "list", ...list }, null, 2)
      : [
          `depsentinel trust list (${resolvedManager})`,
          `allow-build [${list.source.allowBuild}]: ${list.allowBuild.join(", ") || "none"}`,
          `ignore-build [${list.source.ignoreBuild}]: ${list.ignoreBuild.join(", ") || "none"}`,
          "allow-build entries:",
          ...(list.entries.allowBuild.length > 0
            ? list.entries.allowBuild.map((entry) => `- ${entry.packageName} (${entry.source})`)
            : ["- none"]),
          "ignore-build entries:",
          ...(list.entries.ignoreBuild.length > 0
            ? list.entries.ignoreBuild.map((entry) => `- ${entry.packageName} (${entry.source})`)
            : ["- none"])
        ].join("\n");
    return { output, exitCode: 0 };
  }

  if (!options.packageName || !options.mode) {
    const output = options.json
      ? JSON.stringify({ command: "trust", error: "packageName and --mode are required for add/remove" }, null, 2)
      : "packageName and --mode are required for add/remove";
    return { output, exitCode: 1 };
  }

  const plans: Array<ReturnType<typeof planSafeFile>> = [];

  if (resolvedManager === "pnpm") {
    const state = parsePnpmWorkspace(ensurePnpmWorkspace(cwd));
    if (options.mode === "allow-build") {
      if (options.action === "add") {
        state.allowBuilds.add(options.packageName);
        state.ignoreBuiltDependencies.delete(options.packageName);
      } else {
        state.allowBuilds.delete(options.packageName);
      }
    } else if (options.action === "add") {
      state.ignoreBuiltDependencies.add(options.packageName);
      state.allowBuilds.delete(options.packageName);
    } else {
      state.ignoreBuiltDependencies.delete(options.packageName);
    }
    plans.push(planSafeFile(path.join(cwd, "pnpm-workspace.yaml"), renderPnpmWorkspace(state)));
  }

  if (resolvedManager === "bun") {
    const pkgPath = path.join(cwd, "package.json");
    const pkg = readJsonSafe<PackageJsonLike>(pkgPath, {});
    const trusted = new Set(pkg.trustedDependencies ?? []);
    const config = readDepsentinelConfig(cwd);
    const nextConfig = updateDepsentinelTrust(config, "bun", options.mode, options.action, options.packageName);

    if (options.mode === "allow-build") {
      if (options.action === "add") trusted.add(options.packageName);
      if (options.action === "remove") trusted.delete(options.packageName);
      pkg.trustedDependencies = [...trusted].sort();
      plans.push(planSafeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n"));
    } else {
      plans.push(planSafeFile(path.join(cwd, "depsentinel.json"), JSON.stringify(nextConfig, null, 2) + "\n"));
    }
  }

  if (resolvedManager === "yarn") {
    const pkgPath = path.join(cwd, "package.json");
    const pkg = readJsonSafe<PackageJsonLike>(pkgPath, {});
    const meta = { ...(pkg.dependenciesMeta ?? {}) };
    if (options.action === "add") {
      meta[options.packageName] = { ...(meta[options.packageName] ?? {}), built: options.mode === "allow-build" };
    } else if (meta[options.packageName]) {
      const copy = { ...meta[options.packageName] };
      delete copy.built;
      if (Object.keys(copy).length === 0) {
        delete meta[options.packageName];
      } else {
        meta[options.packageName] = copy;
      }
    }
    pkg.dependenciesMeta = meta;
    plans.push(planSafeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n"));
  }

  if (resolvedManager === "npm") {
    const config = readDepsentinelConfig(cwd);
    const nextConfig = updateDepsentinelTrust(config, "npm", options.mode, options.action, options.packageName);
    plans.push(planSafeFile(path.join(cwd, "depsentinel.json"), JSON.stringify(nextConfig, null, 2) + "\n"));
  }

  const applied = applySafePlan(plans, { dryRun });
  const list = listForManager(cwd, resolvedManager);
  const output = options.json
    ? JSON.stringify(
        {
          command: "trust",
          action: options.action,
          manager: resolvedManager,
          mode: options.mode,
          packageName: options.packageName,
          dryRun,
          files: applied.map((p) => ({ path: path.basename(p.path), status: p.status })),
          trust: list
        },
        null,
        2
      )
    : [
        `depsentinel trust ${options.action} (${resolvedManager}, ${options.mode})`,
        `package: ${options.packageName}`,
        `mode: ${dryRun ? "dry-run" : "apply"}`,
        ...applied.map((p) => `- ${path.basename(p.path)}: ${p.status}`)
      ].join("\n");

  return { output, exitCode: 0 };
}
