import path from "node:path";
import { describe, expect, it } from "vitest";
import { runScan } from "../src/commands/scan.js";
import { runDoctor } from "../src/commands/doctor.js";
import { runCi } from "../src/commands/ci.js";
import { runInit } from "../src/commands/init.js";

const fixture = (name: string): string => path.resolve(`tests/fixtures/m3/${name}`);

describe("M3 fixtures — known expectations per scenario", () => {
  it("env-plaintext: scan detects critical plaintext secrets in .env", () => {
    const { envelope } = runScan({ cwd: fixture("env-plaintext") });
    const env = envelope.result.findings.find((f) => f.ruleId === "maintainer.env.plaintext");
    expect(env).toBeDefined();
    expect(env?.severity).toBe("critical");
  });

  it("env-plaintext: ci fails gate", () => {
    const result = runCi({ cwd: fixture("env-plaintext") });
    expect(result.shouldFail).toBe(true);
  });

  it("env-plaintext: doctor flags .env with plaintext secrets", () => {
    const { envelope } = runDoctor({ cwd: fixture("env-plaintext") });
    const d = envelope.result.diagnoses.find((dx) => dx.id === "maintainer.env.plaintext");
    expect(d?.status).toBe("fail");
    expect(d?.severity).toBe("critical");
  });

  it("env-secure: scan has no env findings", () => {
    const { envelope } = runScan({ cwd: fixture("env-secure") });
    expect(envelope.result.findings.some((f) => f.ruleId === "maintainer.env.plaintext")).toBe(false);
  });

  it("env-secure: ci passes gate", () => {
    const result = runCi({ cwd: fixture("env-secure") });
    expect(result.shouldFail).toBe(false);
  });

  it("public-no-files: scan detects missing files allowlist", () => {
    const { envelope } = runScan({ cwd: fixture("public-no-files") });
    const files = envelope.result.findings.find((f) => f.ruleId === "config.files.allowlist");
    expect(files).toBeDefined();
    expect(files?.severity).toBe("medium");
  });

  it("public-no-files: doctor flags it", () => {
    const { envelope } = runDoctor({ cwd: fixture("public-no-files") });
    const d = envelope.result.diagnoses.find((dx) => dx.id === "config.package-json.files-missing");
    expect(d?.status).toBe("fail");
  });

  it("no-sbom: scan detects missing sbom script", () => {
    const { envelope } = runScan({ cwd: fixture("no-sbom") });
    const sbom = envelope.result.findings.find((f) => f.ruleId === "ci.sbom.missing");
    expect(sbom).toBeDefined();
    expect(sbom?.severity).toBe("low");
  });

  it("no-sbom: doctor flags it", () => {
    const { envelope } = runDoctor({ cwd: fixture("no-sbom") });
    const d = envelope.result.diagnoses.find((dx) => dx.id === "ci.sbom.missing");
    expect(d?.status).toBe("fail");
  });

  it("no-npmrc: doctor flags missing .npmrc", () => {
    const { envelope } = runDoctor({ cwd: fixture("no-npmrc") });
    const d = envelope.result.diagnoses.find((dx) => dx.id === "config.npmrc.missing");
    expect(d?.status).toBe("fail");
    expect(d?.severity).toBe("high");
  });

  it("bun-project: init generates bunfig.toml", () => {
    const { envelope } = runInit({ cwd: fixture("bun-project"), dryRun: true });
    const bunfig = envelope.result.files.find((f) => f.path === "bunfig.toml");
    expect(bunfig).toBeDefined();
  });

  it("bun-project: doctor skips non-bun configs", () => {
    const { envelope } = runDoctor({ cwd: fixture("bun-project") });
    const yarnrc = envelope.result.diagnoses.find((dx) => dx.id === "config.yarnrc.non-yarn");
    expect(yarnrc?.status).toBe("skipped");
  });

  it("pnpm-weak: doctor flags incomplete pnpm workspace", () => {
    const { envelope } = runDoctor({ cwd: fixture("pnpm-weak") });
    const d = envelope.result.diagnoses.find((dx) => dx.id === "config.pnpm-workspace.incomplete");
    expect(d?.status).toBe("fail");
  });

  it("no-lint-lockfile: doctor flags missing lockfile linting", () => {
    const { envelope } = runDoctor({ cwd: fixture("no-lint-lockfile") });
    const d = envelope.result.diagnoses.find((dx) => dx.id === "ci.lint-lockfile.missing");
    expect(d?.status).toBe("fail");
  });

  it("all M3 fixtures produce deterministic scan results", () => {
    const fixtures = ["env-plaintext", "env-secure", "public-no-files", "no-sbom", "no-npmrc", "bun-project", "pnpm-weak", "no-lint-lockfile"];
    const results = fixtures.map((name) => {
      const { envelope } = runScan({ cwd: fixture(name) });
      return { fixture: name, risk_score: envelope.result.risk_score, findingCount: envelope.result.findings.length };
    });
    expect(results).toMatchInlineSnapshot(`
      [
        {
          "findingCount": 2,
          "fixture": "env-plaintext",
          "risk_score": 66,
        },
        {
          "findingCount": 1,
          "fixture": "env-secure",
          "risk_score": 96,
        },
        {
          "findingCount": 2,
          "fixture": "public-no-files",
          "risk_score": 86,
        },
        {
          "findingCount": 1,
          "fixture": "no-sbom",
          "risk_score": 96,
        },
        {
          "findingCount": 1,
          "fixture": "no-npmrc",
          "risk_score": 96,
        },
        {
          "findingCount": 1,
          "fixture": "bun-project",
          "risk_score": 96,
        },
        {
          "findingCount": 1,
          "fixture": "pnpm-weak",
          "risk_score": 96,
        },
        {
          "findingCount": 1,
          "fixture": "no-lint-lockfile",
          "risk_score": 96,
        },
      ]
    `);
  });
});
