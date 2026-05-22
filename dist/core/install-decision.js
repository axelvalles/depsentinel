export function deriveInstallDecision(findings, _score) {
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
