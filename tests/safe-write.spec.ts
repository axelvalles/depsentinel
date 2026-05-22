import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { applySafePlan, planSafeFile } from "../src/core/safe-write.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "depsentinel-safe-write-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("safe writer", () => {
  it("does not write files in dry-run mode", () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, "depsentinel.policy.json");
    const plan = [planSafeFile(filePath, "{\n  \"ok\": true\n}\n")];

    applySafePlan(plan, { dryRun: true });

    expect(plan[0]?.status).toBe("create");
  });

  it("creates backup when updating existing content", () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, "depsentinel.policy.json");
    writeFileSync(filePath, "old\n", "utf8");

    const plan = [planSafeFile(filePath, "new\n")];
    applySafePlan(plan, { dryRun: false });

    expect(plan[0]?.status).toBe("update");
    expect(plan[0]?.backupPath).toBeTruthy();
    expect(readFileSync(filePath, "utf8")).toBe("new\n");
    expect(readFileSync(plan[0]!.backupPath!, "utf8")).toBe("old\n");
  });

  it("is idempotent when target content already matches", () => {
    const dir = makeTempDir();
    const filePath = path.join(dir, "depsentinel.overrides.json");
    writeFileSync(filePath, "same\n", "utf8");

    const plan = [planSafeFile(filePath, "same\n")];
    applySafePlan(plan, { dryRun: false });

    expect(plan[0]?.status).toBe("noop");
    expect(plan[0]?.backupPath).toBeUndefined();
  });
});
