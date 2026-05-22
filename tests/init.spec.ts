import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runInit } from "../src/commands/init.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "depsentinel-init-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("init command", () => {
  it("plans artifacts in dry-run mode by default", () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "test" }));
    writeFileSync(path.join(dir, "package-lock.json"), "{}");
    const { envelope } = runInit({ cwd: dir });

    expect(envelope.command).toBe("init");
    expect(envelope.result.dryRun).toBe(true);
    const paths = envelope.result.files.map((file) => file.path);
    expect(paths).toContain("depsentinel.json");
    expect(paths).toContain(".npmrc");
    expect(paths).toContain(".npmignore");
  });

  it("writes default publishing context to depsentinel config", () => {
    const dir = makeTempDir();
    runInit({ cwd: dir, dryRun: false });
    const configPath = path.join(dir, "depsentinel.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as {
      context: { publishesToNpm: boolean; publishFromCi: boolean; usesOidcTrustedPublisher: boolean };
    };
    expect(config.context.publishesToNpm).toBe(true);
    expect(config.context.publishFromCi).toBe(true);
  });

  it("writes artifacts and is idempotent on rerun", () => {
    const dir = makeTempDir();
    const first = runInit({ cwd: dir, dryRun: false });
    const second = runInit({ cwd: dir, dryRun: false });

    expect(first.envelope.result.files.every((file) => file.status === "create")).toBe(true);
    expect(second.envelope.result.files.every((file) => file.status === "noop")).toBe(true);

    expect(existsSync(path.join(dir, "depsentinel.json"))).toBe(true);
    expect(existsSync(path.join(dir, ".npmrc"))).toBe(true);
    expect(existsSync(path.join(dir, ".github", "workflows", "depsentinel-ci.yml"))).toBe(true);
  });

  it("generates pnpm-workspace.yaml when pnpm lockfile detected", () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "pnpm-proj" }));
    writeFileSync(path.join(dir, "pnpm-lock.yaml"), "");
    const result = runInit({ cwd: dir, dryRun: false });

    expect(result.envelope.result.files.some((file) => file.path === "pnpm-workspace.yaml")).toBe(true);
    expect(existsSync(path.join(dir, "pnpm-workspace.yaml"))).toBe(true);
    const content = readFileSync(path.join(dir, "pnpm-workspace.yaml"), "utf8");
    expect(content).toContain("minimumReleaseAge: 43200");
    expect(content).toContain("trustPolicy: no-downgrade");
    expect(content).toContain("blockExoticSubdeps: true");
  });

  it("generates pnpm-workspace.yaml when no PM detected (pnpm default)", () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "unknown-pm" }));
    const result = runInit({ cwd: dir, dryRun: false });

    expect(result.envelope.result.files.some((file) => file.path === "pnpm-workspace.yaml")).toBe(true);
    const content = readFileSync(path.join(dir, "pnpm-workspace.yaml"), "utf8");
    expect(content).toContain("minimumReleaseAge");
  });

  it("creates .npmrc secure baseline", () => {
    const dir = makeTempDir();
    runInit({ cwd: dir, dryRun: false });

    const npmrc = readFileSync(path.join(dir, ".npmrc"), "utf8");
    expect(npmrc).toContain("ignore-scripts=true");
    expect(npmrc).toContain("allow-git=none");
    expect(npmrc).toContain("min-release-age=3");
  });

  it("creates backup when managed file already exists with different content", () => {
    const dir = makeTempDir();
    runInit({ cwd: dir, dryRun: false });

    const configPath = path.join(dir, "depsentinel.json");
    const modified = "{\n  \"schemaVersion\": \"broken\"\n}\n";
    writeFileSync(configPath, modified, "utf8");

    const updated = runInit({ cwd: dir, dryRun: false });
    const record = updated.envelope.result.files.find((file) => file.path === "depsentinel.json");
    expect(record?.status).toBe("update");
    expect(record?.backupPath).toContain("depsentinel.json.bak");
  });

  it("generates bunfig.toml when bun lockfile detected", () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "bun-proj" }));
    writeFileSync(path.join(dir, "bun.lockb"), "");
    const result = runInit({ cwd: dir, dryRun: false });
    expect(result.envelope.result.files.some((file) => file.path === "bunfig.toml")).toBe(true);
    const content = readFileSync(path.join(dir, "bunfig.toml"), "utf8");
    expect(content).toContain("minimumReleaseAge");
  });

  it("generates .yarnrc.yml when yarn lockfile detected", () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "yarn-proj" }));
    writeFileSync(path.join(dir, "yarn.lock"), "");
    const result = runInit({ cwd: dir, dryRun: false });
    expect(result.envelope.result.files.some((file) => file.path === ".yarnrc.yml")).toBe(true);
    const content = readFileSync(path.join(dir, ".yarnrc.yml"), "utf8");
    expect(content).toContain("npmMinimalAgeGate");
  });

  it("creates .npmignore secure baseline", () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "test" }));
    writeFileSync(path.join(dir, "package-lock.json"), "{}");
    runInit({ cwd: dir, dryRun: false });
    const content = readFileSync(path.join(dir, ".npmignore"), "utf8");
    expect(content).toContain(".env");
    expect(content).toContain("node_modules/");
  });

  it("generates CI workflow using local built CLI", () => {
    const dir = makeTempDir();
    runInit({ cwd: dir, dryRun: false });
    const workflow = readFileSync(path.join(dir, ".github", "workflows", "depsentinel-ci.yml"), "utf8");
    expect(workflow).toContain("pnpm build");
    expect(workflow).toContain("node dist/cli.js ci --json");
    expect(workflow).not.toContain("npx depsentinel ci --json");
  });
});
