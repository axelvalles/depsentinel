import type { Finding } from "../types/contracts.js";

const SEVERITY_WEIGHTS: Record<Finding["severity"], number> = {
  critical: 30,
  high: 18,
  medium: 10,
  low: 4
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeRiskScore(findings: Finding[]): number {
  const deduction = findings.reduce((acc, finding) => acc + SEVERITY_WEIGHTS[finding.severity], 0);
  return clamp(100 - deduction, 0, 100);
}

export function getSeverityWeights(): Record<Finding["severity"], number> {
  return { ...SEVERITY_WEIGHTS };
}
