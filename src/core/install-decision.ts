import type { Finding, InstallDecision } from "../types/contracts.js";

export function deriveInstallDecision(
  findings: Finding[],
  _score: number
): InstallDecision {
  const hasCritical = findings.some((finding) => finding.severity === "critical");
  if (hasCritical) {
    return "block";
  }

  const hasHigh = findings.some((finding) => finding.severity === "high");
  if (hasHigh) {
    return "warn";
  }

  return "allow";
}
