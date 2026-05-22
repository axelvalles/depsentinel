import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCi } from "../src/commands/ci.js";

const fixture = (name: string): string => path.resolve(`tests/fixtures/m1/${name}`);

describe("ci command", () => {
  it("fails gate when critical policy findings exist", () => {
    const result = runCi({ cwd: fixture("protocol-violation") });

    expect(result.shouldFail).toBe(true);
    expect(result.envelope.result.failed_critical_policy).toBe(true);
    expect(result.envelope.result.risk_score).toBeGreaterThan(0);
  });

  it("fails gate when a critical advisory match is detected", () => {
    const result = runCi({ cwd: fixture("advisory-critical") });

    expect(result.shouldFail).toBe(true);
    expect(result.envelope.result.failed_critical_policy).toBe(true);
    expect(result.envelope.result.findings.some((finding) => finding.ruleId === "advisory.critical.detected")).toBe(true);
  });

  it("passes gate for healthy baseline and keeps M1 output contract", () => {
    const result = runCi({ cwd: fixture("pnpm-expo"), json: true });

    expect(result.shouldFail).toBe(false);
    expect(result.envelope.result.failed_critical_policy).toBe(false);
    expect(result.envelope.result.proposed_diff).toEqual([]);
    expect(result.envelope.result.remediation_commands.length).toBeGreaterThan(0);
    expect(result.output).toContain('"risk_score"');
    expect(result.output).toContain('"proposed_diff"');
    expect(result.output).toContain('"remediation_commands"');
  });

  it("degrades gracefully to universal JS/TS baseline for unknown framework", () => {
    const result = runCi({ cwd: fixture("unknown-framework") });

    expect(result.shouldFail).toBe(false);
    expect(result.envelope.facts.packageManager).toBe("npm");
    expect(result.envelope.facts.framework).toBe("unknown");
    expect(result.envelope.result.diagnostics).toContain(
      "Framework not detected. Running universal JS/TS baseline checks only."
    );
  });
});
