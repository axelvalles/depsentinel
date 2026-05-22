import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { applySafePlan, planSafeFile } from "../core/safe-write.js";
import { detectProjectFacts } from "../core/detector.js";
import type { InitEnvelope, InitFilePlan, InitPreset } from "../types/contracts.js";

export interface InitOptions {
  cwd?: string;
  preset?: InitPreset;
  dryRun?: boolean;
  json?: boolean;
  context?: {
    publishesToNpm: boolean;
    publishFromCi: boolean;
    usesOidcTrustedPublisher: boolean;
  };
}

function buildDepsentinelConfig(
  preset: InitPreset,
  context: { publishesToNpm: boolean; publishFromCi: boolean; usesOidcTrustedPublisher: boolean }
): string {
  return JSON.stringify(
    {
      schemaVersion: "1.0.0",
      preset,
      policyCatalog: "v1",
      failOn: ["critical"],
      overrides: [],
      context
    },
    null,
    2
  );
}

function buildNpmRc(): string {
  return [
    "# depsentinel npm security baseline",
    "ignore-scripts=true",
    "allow-git=none",
    "min-release-age=3",
    ""
  ].join("\n");
}

function mergeNpmRc(existing: string): string {
  const lines = existing.split(/\r?\n/);
  const keys = new Map<string, number>();
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i]?.match(/^\s*([a-zA-Z0-9-]+)\s*=\s*(.*)\s*$/);
    if (m) keys.set(m[1], i);
  }

  const required: Array<[string, string]> = [
    ["ignore-scripts", "true"],
    ["allow-git", "none"],
    ["min-release-age", "3"]
  ];

  for (const [key, value] of required) {
    if (!keys.has(key)) {
      lines.push(`${key}=${value}`);
    }
  }

  return `${lines.join("\n").replace(/\n*$/, "\n")}`;
}

function buildPnpmWorkspace(): string {
  return [
    "packages:",
    "  - \".\"",
    "",
    "# depsentinel pnpm security baseline",
    "minimumReleaseAge: 43200",
    "trustPolicy: no-downgrade",
    "blockExoticSubdeps: true",
    "strictDepBuilds: true",
    "allowBuilds:",
    "  esbuild: true",
    "  rolldown: true",
    "  unrs-resolver: true",
    ""
  ].join("\n");
}

function mergePnpmWorkspace(existing: string): string {
  const lines = existing.split(/\r?\n/);
  const has = (k: string) => lines.some((line) => line.trim().startsWith(`${k}:`));

  if (!has("minimumReleaseAge")) lines.push("minimumReleaseAge: 43200");
  if (!has("trustPolicy")) lines.push("trustPolicy: no-downgrade");
  if (!has("blockExoticSubdeps")) lines.push("blockExoticSubdeps: true");
  if (!has("strictDepBuilds")) lines.push("strictDepBuilds: true");

  const allowIdx = lines.findIndex((line) => line.trim() === "allowBuilds:");
  if (allowIdx === -1) {
    lines.push("allowBuilds:");
    lines.push("  esbuild: true");
    lines.push("  rolldown: true");
    lines.push("  unrs-resolver: true");
  } else {
    const addAllow = (pkg: string) => {
      const exists = lines.some((line) => line.trim().startsWith(`${pkg}:`));
      if (!exists) lines.splice(allowIdx + 1, 0, `  ${pkg}: true`);
    };
    addAllow("esbuild");
    addAllow("rolldown");
    addAllow("unrs-resolver");
  }

  return `${lines.join("\n").replace(/\n*$/, "\n")}`;
}

function buildBunfig(): string {
  return [
    "[install]",
    "minimumReleaseAge = 259200",
    ""
  ].join("\n");
}

function buildYarnRc(): string {
  return [
    "npmMinimalAgeGate: \"3d\"",
    ""
  ].join("\n");
}

function buildNpmIgnore(): string {
  return [
    "# depsentinel secure npmignore",
    ".env",
    "*.log",
    "coverage/",
    "node_modules/",
    ""
  ].join("\n");
}

function buildCiWorkflow(): string {
  return [
    "name: depsentinel-ci",
    "",
    "on:",
    "  pull_request:",
    "  push:",
    "    branches: [main]",
    "",
    "jobs:",
    "  policy-gate:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: pnpm/action-setup@v4",
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 22",
    "          cache: pnpm",
    "      - name: Install dependencies",
    "        run: |",
    "          if [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile;",
    "          elif [ -f yarn.lock ]; then corepack enable && yarn install --immutable;",
    "          elif [ -f bun.lockb ]; then bun install --frozen-lockfile;",
    "          elif [ -f package-lock.json ]; then npm ci;",
    "          else corepack enable && pnpm install; fi",
    "      - name: Build depsentinel CLI",
    "        run: pnpm build",
    "      - name: Run depsentinel CI gate",
    "        run: node dist/cli.js ci --json"
  ].join("\n");
}

function toFilePlan(result: ReturnType<typeof planSafeFile>): InitFilePlan {
  return {
    path: path.basename(result.path),
    status: result.status,
    backupPath: result.backupPath ? path.basename(result.backupPath) : undefined
  };
}

export function runInit(options: InitOptions = {}): { envelope: InitEnvelope; output: string } {
  const cwd = options.cwd ?? process.cwd();
  const preset = options.preset ?? "base";
  const dryRun = options.dryRun ?? true;
  const facts = detectProjectFacts(cwd);
  const context = options.context ?? {
    publishesToNpm: true,
    publishFromCi: true,
    usesOidcTrustedPublisher: false
  };

  const planned = [
    planSafeFile(path.join(cwd, "depsentinel.json"), `${buildDepsentinelConfig(preset, context)}\n`),
    planSafeFile(
      path.join(cwd, ".npmrc"),
      existsSync(path.join(cwd, ".npmrc")) ? mergeNpmRc(readFileSync(path.join(cwd, ".npmrc"), "utf8")) : buildNpmRc(),
      { backupOnUpdate: false }
    ),
    planSafeFile(path.join(cwd, ".npmignore"), buildNpmIgnore()),
    planSafeFile(path.join(cwd, ".github", "workflows", "depsentinel-ci.yml"), `${buildCiWorkflow()}\n`)
  ];

  if (facts.packageManager === "pnpm" || facts.packageManager === "unknown") {
    planned.push(
      planSafeFile(
        path.join(cwd, "pnpm-workspace.yaml"),
        existsSync(path.join(cwd, "pnpm-workspace.yaml"))
          ? mergePnpmWorkspace(readFileSync(path.join(cwd, "pnpm-workspace.yaml"), "utf8"))
          : buildPnpmWorkspace(),
        { backupOnUpdate: false }
      )
    );
  }

  if (facts.packageManager === "bun") {
    planned.push(planSafeFile(path.join(cwd, "bunfig.toml"), buildBunfig()));
  }

  if (facts.packageManager === "yarn") {
    planned.push(planSafeFile(path.join(cwd, ".yarnrc.yml"), buildYarnRc()));
  }

  const applied = applySafePlan(planned, { dryRun });
  const files = applied.map(toFilePlan);

  const envelope: InitEnvelope = {
    schemaVersion: "1.0.0",
    command: "init",
    result: {
      preset,
      dryRun,
      files
    }
  };

  const output = options.json
    ? JSON.stringify(envelope, null, 2)
    : [
        `Init preset: ${preset}`,
        `Mode: ${dryRun ? "dry-run" : "apply"}`,
        ...files.map((file) => {
          const backup = file.backupPath ? ` (backup: ${file.backupPath})` : "";
          return `- ${file.path}: ${file.status}${backup}`;
        })
      ].join("\n");

  return { envelope, output };
}
