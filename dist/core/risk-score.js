const SEVERITY_WEIGHTS = {
    critical: 30,
    high: 18,
    medium: 10,
    low: 4
};
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
export function computeRiskScore(findings) {
    const deduction = findings.reduce((acc, finding) => acc + SEVERITY_WEIGHTS[finding.severity], 0);
    return clamp(100 - deduction, 0, 100);
}
export function getSeverityWeights() {
    return { ...SEVERITY_WEIGHTS };
}
