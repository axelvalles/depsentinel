import path from "node:path";
import { applySafePlan, planSafeFile } from "../core/safe-write.js";
import { detectProjectFacts } from "../core/detector.js";
import type { InitEnvelope, InitFilePlan, InitPreset } from "../types/contracts.js";

export interface InitOptions {
  cwd?: string;
  preset?: InitPreset;
  dryRun?: boolean;
  json?: boolean;
}

function buildDepsentinelConfig(preset: InitPreset): string {
  return JSON.stringify(
    {
      schemaVersion: "1.0.0",
      preset,
      policyCatalog: "v1",
      failOn: ["critical"],
      overrides: []
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

  const planned = [
    planSafeFile(path.join(cwd, "depsentinel.json"), `${buildDepsentinelConfig(preset)}\n`),
    planSafeFile(path.join(cwd, ".npmrc"), buildNpmRc()),
    planSafeFile(path.join(cwd, ".npmignore"), buildNpmIgnore()),
    planSafeFile(path.join(cwd, ".github", "workflows", "depsentinel-ci.yml"), `${buildCiWorkflow()}\n`)
  ];

  if (facts.packageManager === "pnpm" || facts.packageManager === "unknown") {
    planned.push(planSafeFile(path.join(cwd, "pnpm-workspace.yaml"), buildPnpmWorkspace()));
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
