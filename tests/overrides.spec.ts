import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { isOverridden, overrideAdd, overrideList, overrideRemove } from "../src/core/overrides.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "depsentinel-overrides-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("override system", () => {
  it("starts with empty store", () => {
    const dir = makeTempDir();
    const store = overrideList(dir);
    expect(store.overrides).toEqual([]);
  });

  it("adds an override entry", () => {
    const dir = makeTempDir();
    const store = overrideAdd({
      cwd: dir,
      ruleId: "maintainer.env.plaintext",
      reason: "Legacy project, migration planned Q3",
      expires: "2027-01-01"
    });
    expect(store.overrides).toHaveLength(1);
    expect(store.overrides[0].ruleId).toBe("maintainer.env.plaintext");
    expect(store.overrides[0].reason).toBe("Legacy project, migration planned Q3");
  });

  it("isOverridden returns true for non-expired entry", () => {
    const dir = makeTempDir();
    overrideAdd({ cwd: dir, ruleId: "ci.sbom.missing", reason: "temporary", expires: "2099-01-01" });
    expect(isOverridden("ci.sbom.missing", dir)).toBe(true);
  });

  it("isOverridden returns false for expired entry", () => {
    const dir = makeTempDir();
    overrideAdd({ cwd: dir, ruleId: "old.rule", reason: "was temporary", expires: "2020-01-01" });
    expect(isOverridden("old.rule", dir)).toBe(false);
  });

  it("isOverridden returns false for unknown rule", () => {
    const dir = makeTempDir();
    expect(isOverridden("nonexistent", dir)).toBe(false);
  });

  it("removes an entry", () => {
    const dir = makeTempDir();
    overrideAdd({ cwd: dir, ruleId: "rule.to.remove", reason: "x", expires: "2099-01-01" });
    const after = overrideRemove("rule.to.remove", dir);
    expect(after.overrides).toHaveLength(0);
  });

  it("replacing add with same ruleId updates entry", () => {
    const dir = makeTempDir();
    overrideAdd({ cwd: dir, ruleId: "dup", reason: "first", expires: "2027-01-01" });
    const store = overrideAdd({ cwd: dir, ruleId: "dup", reason: "second", expires: "2027-06-01" });
    expect(store.overrides).toHaveLength(1);
    expect(store.overrides[0].reason).toBe("second");
  });

  it("persists to depsentinel.json", () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "depsentinel.json"), JSON.stringify({ schemaVersion: "1.0.0", preset: "base", overrides: [] }));
    overrideAdd({ cwd: dir, ruleId: "persist.test", reason: "persist check", expires: "2099-01-01" });
    const reloaded = overrideList(dir);
    expect(reloaded.overrides[0].ruleId).toBe("persist.test");
  });
});
