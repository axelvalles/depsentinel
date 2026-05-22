import { describe, expect, it } from "vitest";
import { formatInstallHuman } from "../src/formatters/human.js";
import { formatInstallJson } from "../src/formatters/json.js";
import type { InstallEnvelope } from "../src/types/contracts.js";

const baseEnvelope: InstallEnvelope = {
  schemaVersion: "1.0.0",
  command: "install",
  facts: {
    rootDir: "/test",
    packageManager: "npm",
    lockfile: "package-lock.json",
    isWorkspace: false,
    framework: "node",
    dependencies: { "react": "^19.0.0" }
  },
  result: {
    decision: "allow",
    forced: false,
    score: 100,
    findings: [],
    remediationCommands: ["npm ci", "npm audit --audit-level=critical"],
    adapterReport: [],
    installed: true,
    managerCommand: "npm install react",
    exitCode: 0
  }
};

describe("formatInstallHuman", () => {
  it("includes decision, score, manager, and force hint", () => {
    const output = formatInstallHuman(baseEnvelope);
    expect(output).toContain("depsentinel install");
    expect(output).toContain("decision: allow");
    expect(output).toContain("risk score: 100");
    expect(output).toContain("package manager: npm");
    expect(output).toContain("--force");
  });

  it("shows findings when present", () => {
    const envelope: InstallEnvelope = {
      ...baseEnvelope,
      result: {
        ...baseEnvelope.result,
        decision: "block",
        forced: false,
        score: 70,
        installed: false,
        exitCode: 1,
        findings: [
          {
            ruleId: "lockfile.required",
            severity: "critical",
            message: "Missing lockfile."
          }
        ]
      }
    };

    const output = formatInstallHuman(envelope);
    expect(output).toContain("[critical] lockfile.required:");
    expect(output).toContain("decision: block");
  });

  it("shows forced override note when forced", () => {
    const envelope: InstallEnvelope = {
      ...baseEnvelope,
      result: {
        ...baseEnvelope.result,
        decision: "block",
        forced: true,
        score: 55,
        findings: [
          {
            ruleId: "advisory.critical.detected",
            severity: "critical",
            message: "CVE found"
          }
        ]
      }
    };

    const output = formatInstallHuman(envelope);
    expect(output).toContain("forced override");
  });

  it("shows 'none' for empty findings and remediation", () => {
    const envelope: InstallEnvelope = {
      ...baseEnvelope,
      result: {
        ...baseEnvelope.result,
        remediationCommands: [],
        findings: []
      }
    };

    const output = formatInstallHuman(envelope);
    expect(output).toContain("- none");
    expect(output).toMatch(/- none\n/);
  });
});

describe("formatInstallJson", () => {
  it("produces valid JSON with all envelope fields", () => {
    const json = formatInstallJson(baseEnvelope);
    const parsed = JSON.parse(json) as InstallEnvelope;

    expect(parsed.schemaVersion).toBe("1.0.0");
    expect(parsed.command).toBe("install");
    expect(parsed.facts.packageManager).toBe("npm");
    expect(parsed.result.decision).toBe("allow");
    expect(parsed.result.score).toBe(100);
    expect(parsed.result.findings).toEqual([]);
    expect(parsed.result.adapterReport).toEqual([]);
    expect(parsed.result.installed).toBe(true);
    expect(parsed.result.exitCode).toBe(0);
  });

  it("pretty-prints with 2-space indentation", () => {
    const json = formatInstallJson(baseEnvelope);
    const lines = json.split("\n");
    expect(lines.length).toBeGreaterThan(1);
    // Check that indented lines use 2 spaces
    const indentLine = lines.find((line) => line.startsWith("  "));
    expect(indentLine).toBeDefined();
  });

  it("includes findings in JSON output", () => {
    const envelope: InstallEnvelope = {
      ...baseEnvelope,
      result: {
        ...baseEnvelope.result,
        decision: "block",
        score: 60,
        installed: false,
        exitCode: 1,
        findings: [
          {
            ruleId: "dependency.protocol.disallowed",
            severity: "critical",
            message: "Bad protocol",
            meta: { dependency: "evil", source: "git+https://..." }
          }
        ]
      }
    };

    const json = formatInstallJson(envelope);
    const parsed = JSON.parse(json) as InstallEnvelope;
    expect(parsed.result.findings).toHaveLength(1);
    expect(parsed.result.findings[0].ruleId).toBe("dependency.protocol.disallowed");
  });
});
