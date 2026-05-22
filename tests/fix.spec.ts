import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runFix } from "../src/commands/fix.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "depsentinel-fix-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writePkg(dir: string, overrides: Record<string, unknown> = {}) {
  writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "fix-test", ...overrides }, null, 2));
}

function writeLockfile(dir: string) {
  writeFileSync(path.join(dir, "package-lock.json"), JSON.stringify({ name: "fix-test", lockfileVersion: 2 }));
}

describe("fix command", () => {
  it("defaults to dry-run mode", () => {
    const dir = makeTempDir();
    writePkg(dir, { scripts: { test: "vitest" } });
    writeLockfile(dir);
    const result = runFix({ cwd: dir });
    expect(result.dryRun).toBe(true);
  });

  it("creates .npmrc when missing", () => {
    const dir = makeTempDir();
    writePkg(dir, { scripts: { test: "vitest" } });
    writeLockfile(dir);
    const result = runFix({ cwd: dir, dryRun: false });
    expect(result.entries.some((e) => e.path === ".npmrc")).toBe(true);
    const npmrc = require("node:fs").readFileSync(path.join(dir, ".npmrc"), "utf8");
    expect(npmrc).toContain("ignore-scripts=true");
  });

  it("creates .npmignore", () => {
    const dir = makeTempDir();
    writePkg(dir);
    writeLockfile(dir);
    const result = runFix({ cwd: dir, dryRun: false });
    expect(result.entries.some((e) => e.path === ".npmignore")).toBe(true);
  });

  it("adds lint:lockfile script to package.json", () => {
    const dir = makeTempDir();
    writePkg(dir, { scripts: { test: "vitest" } });
    writeLockfile(dir);
    runFix({ cwd: dir, dryRun: false });
    const pkg = JSON.parse(require("node:fs").readFileSync(path.join(dir, "package.json"), "utf8"));
    expect(pkg.scripts["lint:lockfile"]).toBeDefined();
  });

  it("adds sbom script to package.json", () => {
    const dir = makeTempDir();
    writePkg(dir, { scripts: { test: "vitest" } });
    writeLockfile(dir);
    runFix({ cwd: dir, dryRun: false });
    const pkg = JSON.parse(require("node:fs").readFileSync(path.join(dir, "package.json"), "utf8"));
    expect(pkg.scripts["sbom"]).toBeDefined();
  });

  it("dry-run does not write files", () => {
    const dir = makeTempDir();
    writePkg(dir, { scripts: { test: "vitest" } });
    writeLockfile(dir);
    runFix({ cwd: dir, dryRun: true });
    expect(existsSync(path.join(dir, ".npmrc"))).toBe(false);
  });

  it("human output shows mode and per-file status", () => {
    const dir = makeTempDir();
    writePkg(dir, { scripts: { test: "vitest" } });
    writeLockfile(dir);
    const { output } = runFix({ cwd: dir, dryRun: true });
    expect(output).toContain("depsentinel fix");
    expect(output).toContain("Mode: dry-run");
    expect(output).toContain(".npmrc");
  });

  it("json output includes entries array", () => {
    const dir = makeTempDir();
    writePkg(dir, { scripts: { test: "vitest" } });
    writeLockfile(dir);
    const { output } = runFix({ cwd: dir, dryRun: true, json: true });
    const parsed = JSON.parse(output) as { entries: unknown[] };
    expect(Array.isArray(parsed.entries)).toBe(true);
  });
});
