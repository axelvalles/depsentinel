import { describe, expect, it } from "vitest";
import { deriveInstallDecision } from "../src/core/install-decision.js";
import type { Finding } from "../src/types/contracts.js";

function makeFinding(
  ruleId: string,
  severity: Finding["severity"],
  message = `Test finding ${ruleId}`
): Finding {
  return { ruleId, severity, message };
}

describe("deriveInstallDecision", () => {
  it("returns allow when no findings exist", () => {
    const decision = deriveInstallDecision([], 100);
    expect(decision).toBe("allow");
  });

  it("returns allow with high score and low-severity findings", () => {
    const findings = [
      makeFinding("rule.a", "low", "minor note"),
      makeFinding("rule.b", "medium", "something to check")
    ];
    const decision = deriveInstallDecision(findings, 86);
    expect(decision).toBe("allow");
  });

  it("returns warn when a high-severity finding exists (no critical)", () => {
    const findings = [
      makeFinding("rule.a", "high", "risky dep pattern"),
      makeFinding("rule.b", "medium", "minor issue")
    ];
    const decision = deriveInstallDecision(findings, 68);
    expect(decision).toBe("warn");
  });

  it("returns block when any critical finding exists", () => {
    const findings = [
      makeFinding("lockfile.required", "critical", "Missing lockfile"),
      makeFinding("rule.b", "low", "cosmetic")
    ];
    const decision = deriveInstallDecision(findings, 60);
    expect(decision).toBe("block");
  });

  it("returns block for critical-only findings", () => {
    const findings = [makeFinding("advisory", "critical", "Known CVE")];
    const decision = deriveInstallDecision(findings, 70);
    expect(decision).toBe("block");
  });

  it("returns warn when highest severity is high (no critical)", () => {
    const findings = [makeFinding("rule.x", "high", "pattern violation")];
    const decision = deriveInstallDecision(findings, 82);
    expect(decision).toBe("warn");
  });

  it("empty findings with low score still returns allow", () => {
    // Decision is severity-driven, not score-driven per design
    const decision = deriveInstallDecision([], 0);
    expect(decision).toBe("allow");
  });
});
