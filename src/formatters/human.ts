import type { ScanEnvelope } from "../types/contracts.js";

export function formatScanHuman(envelope: ScanEnvelope): string {
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
