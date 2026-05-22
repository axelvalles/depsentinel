export function formatScanHuman(envelope) {
    const findingLines = envelope.result.findings.length
        ? envelope.result.findings.map((finding) => `- [${finding.severity}] ${finding.ruleId}: ${finding.message}`).join("\n")
        : "- none";
    const commandLines = envelope.result.remediation_commands.length
        ? envelope.result.remediation_commands.map((cmd) => `- ${cmd}`).join("\n")
        : "- none";
    return [
        "depsentinel scan",
        `risk score: ${envelope.result.risk_score}`,
        `package manager: ${envelope.facts.packageManager}`,
        "findings:",
        findingLines,
        "remediation:",
        commandLines
    ].join("\n");
}
export function formatInstallHuman(envelope) {
    const findingLines = envelope.result.findings.length
        ? envelope.result.findings
            .map((f) => `- [${f.severity}] ${f.ruleId}: ${f.message}`)
            .join("\n")
        : "- none";
    const remediationLines = envelope.result.remediationCommands.length
        ? envelope.result.remediationCommands.map((cmd) => `- ${cmd}`).join("\n")
        : "- none";
    const overrideNote = envelope.result.forced ? " (forced override)" : "";
    return [
        "depsentinel install",
        `decision: ${envelope.result.decision}${overrideNote}`,
        `risk score: ${envelope.result.score}`,
        `package manager: ${envelope.facts.packageManager}`,
        "findings:",
        findingLines,
        "remediation:",
        remediationLines,
        `override: depsentinel install --force <package>`
    ].join("\n");
}
