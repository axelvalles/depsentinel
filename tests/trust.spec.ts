import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runTrust } from "../src/commands/trust.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "depsentinel-trust-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("trust command", () => {
  it("adds package to pnpm allowBuilds", () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "x" }), "utf8");
    writeFileSync(path.join(dir, "pnpm-lock.yaml"), "", "utf8");
    writeFileSync(path.join(dir, "pnpm-workspace.yaml"), "packages:\n  - \".\"\n", "utf8");

    const result = runTrust({ action: "add", packageName: "sharp", mode: "allow-build", cwd: dir, dryRun: false });
    expect(result.exitCode).toBe(0);
    const content = readFileSync(path.join(dir, "pnpm-workspace.yaml"), "utf8");
    expect(content).toContain("allowBuilds:");
    expect(content).toContain("sharp: true");
  });

  it("adds package to pnpm ignoreBuiltDependencies", () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "x" }), "utf8");
    writeFileSync(path.join(dir, "pnpm-lock.yaml"), "", "utf8");
    writeFileSync(path.join(dir, "pnpm-workspace.yaml"), "packages:\n  - \".\"\n", "utf8");

    runTrust({ action: "add", packageName: "fsevents", mode: "ignore-build", cwd: dir, dryRun: false });
    const content = readFileSync(path.join(dir, "pnpm-workspace.yaml"), "utf8");
    expect(content).toContain("ignoreBuiltDependencies:");
    expect(content).toContain("- \"fsevents\"");
  });

  it("lists trust entries", () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "x" }), "utf8");
    writeFileSync(path.join(dir, "pnpm-lock.yaml"), "", "utf8");
    writeFileSync(
      path.join(dir, "pnpm-workspace.yaml"),
      ["packages:", "  - \".\"", "allowBuilds:", "  esbuild: true", "ignoreBuiltDependencies:", "  - \"fsevents\"", ""].join("\n"),
      "utf8"
    );

    const result = runTrust({ action: "list", cwd: dir, json: true });
    expect(result.exitCode).toBe(0);
    const parsed = JSON.parse(result.output) as {
      allowBuild: string[];
      ignoreBuild: string[];
      entries: {
        allowBuild: Array<{ packageName: string; source: string }>;
        ignoreBuild: Array<{ packageName: string; source: string }>;
      };
    };
    expect(parsed.allowBuild).toContain("esbuild");
    expect(parsed.ignoreBuild).toContain("fsevents");
    expect(parsed.entries.allowBuild).toContainEqual({ packageName: "esbuild", source: "native" });
    expect(parsed.entries.ignoreBuild).toContainEqual({ packageName: "fsevents", source: "native" });
  });

  it("stores npm trust in depsentinel config", () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "x" }), "utf8");
    writeFileSync(path.join(dir, "package-lock.json"), "{}", "utf8");

    const add = runTrust({ action: "add", packageName: "sharp", mode: "allow-build", cwd: dir, dryRun: false });
    expect(add.exitCode).toBe(0);

    const config = JSON.parse(readFileSync(path.join(dir, "depsentinel.json"), "utf8")) as {
      trust: { allowBuild: { npm: string[] } };
    };
    expect(config.trust.allowBuild.npm).toContain("sharp");
  });

  it("updates yarn dependenciesMeta built flags", () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "x" }), "utf8");
    writeFileSync(path.join(dir, "yarn.lock"), "", "utf8");

    runTrust({ action: "add", packageName: "sharp", mode: "allow-build", cwd: dir, dryRun: false });
    runTrust({ action: "add", packageName: "fsevents", mode: "ignore-build", cwd: dir, dryRun: false });

    const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as {
      dependenciesMeta: Record<string, { built?: boolean }>;
    };
    expect(pkg.dependenciesMeta.sharp.built).toBe(true);
    expect(pkg.dependenciesMeta.fsevents.built).toBe(false);
  });

  it("uses bun trustedDependencies for allow-build", () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "x" }), "utf8");
    writeFileSync(path.join(dir, "bun.lockb"), "", "utf8");

    runTrust({ action: "add", packageName: "sharp", mode: "allow-build", cwd: dir, dryRun: false });
    const pkg = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as { trustedDependencies?: string[] };
    expect(pkg.trustedDependencies).toContain("sharp");
  });

  it("creates pnpm-workspace.yaml if missing", () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "x" }), "utf8");
    writeFileSync(path.join(dir, "pnpm-lock.yaml"), "", "utf8");

    runTrust({ action: "add", packageName: "sharp", mode: "allow-build", cwd: dir, dryRun: false });
    expect(existsSync(path.join(dir, "pnpm-workspace.yaml"))).toBe(true);
  });
});
