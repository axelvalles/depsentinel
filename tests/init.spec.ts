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
    expect(envelope.result.files.map((file) => file.path)).toEqual([
      "depsentinel.policy.json",
      "depsentinel.overrides.json",
      "depsentinel.config.json",
      ".npmrc",
      ".npmignore",
      "depsentinel-ci.yml"
    ]);
  });

  it("writes artifacts and is idempotent on rerun", () => {
    const dir = makeTempDir();
    const first = runInit({ cwd: dir, dryRun: false });
    const second = runInit({ cwd: dir, dryRun: false });

    expect(first.envelope.result.files.every((file) => file.status === "create")).toBe(true);
    expect(second.envelope.result.files.every((file) => file.status === "noop")).toBe(true);

    const configPath = path.join(dir, "depsentinel.config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8")) as { preset: string };
    expect(config.preset).toBe("base");
    expect(existsSync(path.join(dir, ".github", "workflows", "depsentinel-ci.yml"))).toBe(true);
  });

  it("creates pnpm workspace baseline for expo preset", () => {
    const dir = makeTempDir();
    const result = runInit({ cwd: dir, preset: "expo", dryRun: false });

    expect(result.envelope.result.files.some((file) => file.path === "pnpm-workspace.yaml")).toBe(true);
    expect(existsSync(path.join(dir, "pnpm-workspace.yaml"))).toBe(true);
    const content = readFileSync(path.join(dir, "pnpm-workspace.yaml"), "utf8");
    expect(content).toContain("minimumReleaseAge: 43200");
    expect(content).toContain("trustPolicy: no-downgrade");
    expect(content).toContain("blockExoticSubdeps: true");
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

    const policyPath = path.join(dir, "depsentinel.policy.json");
    const modified = "{\n  \"schemaVersion\": \"broken\"\n}\n";
    writeFileSync(policyPath, modified, "utf8");

    const updated = runInit({ cwd: dir, dryRun: false });
    const policyRecord = updated.envelope.result.files.find((file) => file.path === "depsentinel.policy.json");
    expect(policyRecord?.status).toBe("update");
    expect(policyRecord?.backupPath).toContain("depsentinel.policy.json.bak");
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
});
