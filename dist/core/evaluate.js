const SEVERITY_ORDER = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
};
export function sortFindings(findings) {
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
export function evaluatePolicies(facts, rules) {
    const findings = rules
        .map((rule) => rule.evaluate(facts))
        .filter((finding) => finding !== null);
    return sortFindings(findings);
}
