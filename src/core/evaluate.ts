import type { DetectionFacts, Finding, PolicyRule } from "../types/contracts.js";

const SEVERITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
} as const;

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) {
      return bySeverity;
    }
    const byRuleId = a.ruleId.localeCompare(b.ruleId);
    if (byRuleId !== 0) {
      return byRuleId;
    }
    return a.message.localeCompare(b.message);
  });
}

export function evaluatePolicies(facts: DetectionFacts, rules: PolicyRule[]): Finding[] {
  const findings = rules
    .map((rule) => rule.evaluate(facts))
    .filter((finding): finding is Finding => finding !== null);

  return sortFindings(findings);
}
