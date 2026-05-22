import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runDoctor } from "../src/commands/doctor.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "depsentinel-doctor-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function writePkg(dir: string, overrides: Record<string, unknown> = {}) {
  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "test-project", ...overrides }, null, 2)
  );
}

function writeLockfile(dir: string) {
  writeFileSync(path.join(dir, "package-lock.json"), JSON.stringify({ name: "test-project", lockfileVersion: 2 }));
}

describe("doctor command", () => {
  it("returns envelope with command doctor", () => {
    const dir = makeTempDir();
    writePkg(dir);
    writeLockfile(dir);
    const { envelope } = runDoctor({ cwd: dir });
    expect(envelope.command).toBe("doctor");
    expect(envelope.schemaVersion).toBe("1.0.0");
  });

  it("detects missing .npmrc baseline", () => {
    const dir = makeTempDir();
    writePkg(dir);
    writeLockfile(dir);
    const { envelope } = runDoctor({ cwd: dir });
    const npmrc = envelope.result.diagnoses.find((d) => d.id === "config.npmrc.missing");
    expect(npmrc?.status).toBe("fail");
  });

  it("detects secure .npmrc as pass", () => {
    const dir = makeTempDir();
    writePkg(dir);
    writeLockfile(dir);
    writeFileSync(path.join(dir, ".npmrc"), "ignore-scripts=true\nallow-git=none\nmin-release-age=3\n");
    const { envelope } = runDoctor({ cwd: dir });
    const npmrc = envelope.result.diagnoses.find((d) => d.id === "config.npmrc.secure");
    expect(npmrc?.status).toBe("pass");
  });

  it("detects missing .npmignore", () => {
    const dir = makeTempDir();
    writePkg(dir);
    writeLockfile(dir);
    const { envelope } = runDoctor({ cwd: dir });
    const ign = envelope.result.diagnoses.find((d) => d.id === "config.npmignore.missing");
    expect(ign?.status).toBe("fail");
  });

  it("detects private packages skip files check", () => {
    const dir = makeTempDir();
    writePkg(dir, { private: true });
    writeLockfile(dir);
    const { envelope } = runDoctor({ cwd: dir });
    const files = envelope.result.diagnoses.find((d) => d.id === "config.package-json.files-private");
    expect(files?.status).toBe("pass");
  });

  it("detects plaintext secrets in .env", () => {
    const dir = makeTempDir();
    writePkg(dir);
    writeLockfile(dir);
    writeFileSync(path.join(dir, ".env"), "DB_PASS=secret123\nAPI_KEY=sk-abc\n");
    const { envelope } = runDoctor({ cwd: dir });
    const env = envelope.result.diagnoses.find((d) => d.id === "maintainer.env.plaintext");
    expect(env?.status).toBe("fail");
    expect(env?.severity).toBe("critical");
  });

  it("detects .env with secret references as pass", () => {
    const dir = makeTempDir();
    writePkg(dir);
    writeLockfile(dir);
    writeFileSync(path.join(dir, ".env"), "DB_PASS=op://vault/db/pass\nAPI_KEY=infisical://project/env/key\n");
    const { envelope } = runDoctor({ cwd: dir });
    const env = envelope.result.diagnoses.find((d) => d.id === "maintainer.env.secure");
    expect(env?.status).toBe("pass");
  });

  it("provides human-readable output", () => {
    const dir = makeTempDir();
    writePkg(dir);
    writeLockfile(dir);
    const { output } = runDoctor({ cwd: dir });
    expect(output).toContain("depsentinel doctor");
    expect(output).toContain("CONFIG");
    expect(output).toContain("MAINTAINER");
  });

  it("json output includes counts", () => {
    const dir = makeTempDir();
    writePkg(dir);
    writeLockfile(dir);
    const { envelope } = runDoctor({ cwd: dir, json: true });
    expect(envelope.result.passed).toBeGreaterThanOrEqual(0);
    expect(envelope.result.failed).toBeGreaterThanOrEqual(0);
  });

  it("non-zero failed count produces non-zero diagnostics count", () => {
    const dir = makeTempDir();
    writePkg(dir);
    writeLockfile(dir);
    writeFileSync(path.join(dir, ".env"), "SECRET=plain\n");
    const { envelope } = runDoctor({ cwd: dir });
    expect(envelope.result.failed).toBeGreaterThan(0);
  });

  it("has at least 15 diagnostic checks", () => {
    const dir = makeTempDir();
    writePkg(dir);
    writeLockfile(dir);
    const { envelope } = runDoctor({ cwd: dir });
    expect(envelope.result.diagnoses.length).toBeGreaterThanOrEqual(15);
  });
});
