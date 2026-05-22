import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { DetectionFacts, Framework, PackageManager } from "../types/contracts.js";

const LOCKFILES: Array<{ name: string; manager: PackageManager }> = [
  { name: "pnpm-lock.yaml", manager: "pnpm" },
  { name: "package-lock.json", manager: "npm" },
  { name: "yarn.lock", manager: "yarn" },
  { name: "bun.lockb", manager: "bun" }
];

export function detectProjectFacts(rootDir: string): DetectionFacts {
  const packageJsonPath = path.join(rootDir, "package.json");
  let pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    workspaces?: unknown;
  } = {};
  try {
    pkg = JSON.parse(existsSync(packageJsonPath) ? readFileSync(packageJsonPath, "utf8") : "{}") as typeof pkg;
  } catch {
    pkg = {};
  }

  const lock = LOCKFILES.find((entry) => existsSync(path.join(rootDir, entry.name))) ?? null;
  const dependencies = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {})
  };
  const framework = detectFrameworkHint(dependencies);
  const isWorkspace = Boolean(pkg.workspaces) || existsSync(path.join(rootDir, "pnpm-workspace.yaml"));

  return {
    rootDir,
    packageManager: lock?.manager ?? "unknown",
    lockfile: lock?.name ?? null,
    isWorkspace,
    framework,
    dependencies
  };
}

function detectFrameworkHint(dependencies: Record<string, string>): Framework {
  if (dependencies.expo) {
    return "expo";
  }
  if (dependencies.next) {
    return "nextjs";
  }
  if (dependencies.react) {
    return "react";
  }
  if (dependencies.vue) {
    return "vue";
  }
  if (dependencies["@angular/core"]) {
    return "angular";
  }
  if (dependencies.svelte) {
    return "svelte";
  }
  return Object.keys(dependencies).length > 0 ? "node" : "unknown";
}
