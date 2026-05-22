import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { detectProjectFacts } from "../core/detector.js";
import { planSafeFile, applySafePlan } from "../core/safe-write.js";

export interface FixOptions {
  cwd?: string;
  dryRun?: boolean;
  json?: boolean;
}

export interface FixEntry {
  path: string;
  status: "applied" | "skipped" | "noop" | "created";
  backupPath?: string;
  reason: string;
}

interface PkgJson {
  name?: string;
  scripts?: Record<string, string>;
  files?: string[];
  private?: boolean;
  [key: string]: unknown;
}

function readJsonSafe(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function collectFixPlans(cwd: string) {
  const facts = detectProjectFacts(cwd);
  const plans: Array<ReturnType<typeof planSafeFile>> = [];

  // .npmrc
  const npmrcPath = path.join(cwd, ".npmrc");
  const npmrcContent = [
    "# depsentinel npm security baseline",
    "ignore-scripts=true",
    "allow-git=none",
    "min-release-age=3",
    ""
  ].join("\n");
  plans.push(planSafeFile(npmrcPath, npmrcContent));

  // .npmignore
  const npmignorePath = path.join(cwd, ".npmignore");
  const npmignoreContent = "# depsentinel secure npmignore\n.env\n*.log\ncoverage/\nnode_modules/\n";
  plans.push(planSafeFile(npmignorePath, npmignoreContent));

  // .gitignore
  const gitignorePath = path.join(cwd, ".gitignore");
  if (!existsSync(gitignorePath)) {
    plans.push(planSafeFile(gitignorePath, "# depsentinel\ndist/\nnode_modules/\n.env\n*.log\n"));
  }

  // Accumulate package.json changes in memory
  const pkgPath = path.join(cwd, "package.json");
  const pkg = readJsonSafe(pkgPath) as PkgJson;
  let pkgDirty = false;

  // files allowlist
  if (pkg.name && !pkg.private && !pkg.files) {
    pkg.files = ["dist"];
    pkgDirty = true;
  }

  // lint:lockfile script
  if (!pkg.scripts) pkg.scripts = {};
  if (!pkg.scripts["lint:lockfile"]) {
    pkg.scripts["lint:lockfile"] = "lockfile-lint --path package-lock.json --type npm --allowed-hosts npm --validate-https";
    pkgDirty = true;
  }

  // sbom script
  if (!pkg.scripts["sbom"] && !pkg.scripts["generate:sbom"]) {
    pkg.scripts["sbom"] = "npx @cyclonedx/cyclonedx-npm --validate > sbom.json";
    pkgDirty = true;
  }

  if (pkgDirty) {
    plans.push(planSafeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n"));
  }

  // Bunfig
  if (facts.packageManager === "bun") {
    const bunfigPath = path.join(cwd, "bunfig.toml");
    const bunfigContent = "[install]\nminimumReleaseAge = 259200\n";
    plans.push(planSafeFile(bunfigPath, bunfigContent));
  }

  // Yarnrc
  if (facts.packageManager === "yarn") {
    const yarnrcPath = path.join(cwd, ".yarnrc.yml");
    const yarnrcContent = "npmMinimalAgeGate: \"3d\"\n";
    plans.push(planSafeFile(yarnrcPath, yarnrcContent));
  }

  return { plans, facts };
}

function buildEntries(plans: Array<ReturnType<typeof planSafeFile>>): FixEntry[] {
  return plans.map((p) => ({
    path: path.basename(p.path),
    status: (p.status === "noop" ? "noop" : p.status === "create" ? "created" : "applied") as FixEntry["status"],
    backupPath: p.backupPath ? path.basename(p.backupPath) : undefined,
    reason: p.status === "update" ? "content updated" : p.status === "create" ? "new file" : "already current"
  }));
}

export function runFix(options: FixOptions = {}) {
  const cwd = options.cwd ?? process.cwd();
  const dryRun = options.dryRun ?? true;
  const { plans } = collectFixPlans(cwd);
  const applied = applySafePlan(plans, { dryRun });
  const entries = buildEntries(plans);

  const outputLines = [
    "depsentinel fix",
    `Mode: ${dryRun ? "dry-run" : "apply"}`,
    ...entries.map((e) => {
      const backup = e.backupPath ? ` (backup: ${e.backupPath})` : "";
      return `- ${e.path}: ${e.status} — ${e.reason}${backup}`;
    })
  ];

  const output = options.json
    ? JSON.stringify({ command: "fix", dryRun, entries }, null, 2)
    : outputLines.join("\n");

  return { entries, dryRun, output };
}
