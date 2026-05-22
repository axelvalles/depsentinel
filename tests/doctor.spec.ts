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

  it("fails when packageManager is missing in package.json", () => {
    const dir = makeTempDir();
    writePkg(dir);
    writeLockfile(dir);
    const { envelope } = runDoctor({ cwd: dir });
    const pm = envelope.result.diagnoses.find((d) => d.id === "config.package-manager.missing");
    expect(pm?.status).toBe("fail");
  });

  it("passes when packageManager is present and aligned", () => {
    const dir = makeTempDir();
    writePkg(dir, { packageManager: "npm@10.9.8" });
    writeLockfile(dir);
    const { envelope } = runDoctor({ cwd: dir });
    const pm = envelope.result.diagnoses.find((d) => d.id === "config.package-manager.present");
    expect(pm?.status).toBe("pass");
  });

  it("fails when packageManager conflicts with detected lockfile", () => {
    const dir = makeTempDir();
    writePkg(dir, { packageManager: "pnpm@11.2.2" });
    writeLockfile(dir);
    const { envelope } = runDoctor({ cwd: dir });
    const pm = envelope.result.diagnoses.find((d) => d.id === "config.package-manager.mismatch");
    expect(pm?.status).toBe("fail");
    expect(pm?.severity).toBe("high");
  });

  it("skips publish-specific checks when context disables publishing", () => {
    const dir = makeTempDir();
    writePkg(dir, { private: true });
    writeLockfile(dir);
    writeFileSync(
      path.join(dir, "depsentinel.json"),
      JSON.stringify({ context: { publishesToNpm: false, publishFromCi: false, usesOidcTrustedPublisher: false } }, null, 2)
    );
    const { envelope } = runDoctor({ cwd: dir });
    const provenance = envelope.result.diagnoses.find((d) => d.id === "ci.provenance.not-applicable");
    const twoFa = envelope.result.diagnoses.find((d) => d.id === "maintainer.2fa.not-applicable");
    expect(provenance?.status).toBe("skipped");
    expect(twoFa?.status).toBe("skipped");
  });

  it("fails when multiple lockfiles are present", () => {
    const dir = makeTempDir();
    writePkg(dir);
    writeFileSync(path.join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    writeFileSync(path.join(dir, "package-lock.json"), JSON.stringify({ lockfileVersion: 3 }));

    const { envelope } = runDoctor({ cwd: dir });
    const mixed = envelope.result.diagnoses.find((d) => d.id === "dependencies.lockfile.mixed");
    expect(mixed?.status).toBe("fail");
    expect(mixed?.severity).toBe("high");
  });
});
