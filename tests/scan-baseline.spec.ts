import path from "node:path";
import { describe, expect, it } from "vitest";
import { runScan } from "../src/commands/scan.js";
import { evaluatePolicies } from "../src/core/evaluate.js";
import { detectProjectFacts } from "../src/core/detector.js";
import { policyCatalogV1 } from "../src/policies/catalog.v1.js";
import { getSeverityWeights } from "../src/core/risk-score.js";

const fixture = (name: string): string => path.resolve(`tests/fixtures/m1/${name}`);

describe("scan baseline", () => {
  it("keeps policy catalog sorted by rule id", () => {
    const ids = policyCatalogV1.map((rule) => rule.id);
    expect(ids).toMatchInlineSnapshot(`
      [
        "advisory.critical.detected",
        "ci.sbom.missing",
        "config.files.allowlist",
        "dependency.protocol.disallowed",
        "expo.baseline.workspace-required",
        "lockfile.required",
        "maintainer.env.plaintext",
      ]
    `);
  });

  it("matches a critical advisory from fixture provider", () => {
    const { envelope } = runScan({ cwd: fixture("advisory-critical") });
    const advisoryFinding = envelope.result.findings.find((finding) => finding.ruleId === "advisory.critical.detected");

    expect(advisoryFinding).toBeDefined();
    expect(advisoryFinding?.severity).toBe("critical");
    expect(advisoryFinding?.meta).toMatchObject({
      advisoryId: "DSA-2026-0001",
      package: "vulnerable-lib",
      affectedVersion: "1.0.0"
    });
  });

  it("returns deterministic findings ordering", () => {
    const facts = detectProjectFacts(fixture("protocol-violation"));
    const runA = evaluatePolicies(facts, policyCatalogV1);
    const runB = evaluatePolicies(facts, policyCatalogV1);
    expect(runA).toEqual(runB);
    expect(runA[0]?.ruleId).toBe("dependency.protocol.disallowed");
  });

  it("uses explicit risk weights map", () => {
    expect(getSeverityWeights()).toEqual({
      critical: 30,
      high: 18,
      medium: 10,
      low: 4
    });
  });

  it("emits complete output envelope for missing lockfile", () => {
    const { envelope, output } = runScan({ cwd: fixture("npm-no-lock"), json: true });
    expect(output).toContain('"schemaVersion": "1.0.0"');
    expect(envelope.command).toBe("scan");
    expect(envelope.result.risk_score).toBeGreaterThanOrEqual(0);
    expect(envelope.result.risk_score).toBeLessThanOrEqual(100);
    expect(envelope.result.findings.length).toBeGreaterThan(0);
    expect(envelope.result.proposed_diff.length).toBe(envelope.result.findings.length);
    expect(envelope.result.remediation_commands.length).toBeGreaterThan(0);
  });

  it("includes expo baseline rule coverage", () => {
    const { envelope } = runScan({ cwd: fixture("pnpm-expo") });
    expect(envelope.result.findings.some((finding) => finding.ruleId.startsWith("expo."))).toBe(false);
  });
});
