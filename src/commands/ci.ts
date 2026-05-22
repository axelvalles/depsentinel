import { formatScanJson } from "../formatters/json.js";
import type { CiEnvelope } from "../types/contracts.js";
import { runScan } from "./scan.js";

export interface CiOptions {
  cwd?: string;
  json?: boolean;
}

function buildDiagnostics(envelope: CiEnvelope): string[] {
  const diagnostics: string[] = [];

  if (envelope.facts.packageManager === "unknown") {
    diagnostics.push("No lockfile detected. Add one of: package-lock.json, pnpm-lock.yaml, yarn.lock, bun.lockb.");
  }

  if (envelope.facts.framework === "unknown") {
    diagnostics.push("Framework not detected. Running universal JS/TS baseline checks only.");
  }

  return diagnostics;
}

function formatCiHuman(envelope: CiEnvelope): string {
  const findingLines = envelope.result.findings.length
    ? envelope.result.findings.map((finding) => `- [${finding.severity}] ${finding.ruleId}: ${finding.message}`).join("\n")
    : "- none";

  const remediationLines = envelope.result.remediation_commands.length
    ? envelope.result.remediation_commands.map((command) => `- ${command}`).join("\n")
    : "- none";

  const diagnosticLines = envelope.result.diagnostics.length
    ? envelope.result.diagnostics.map((message) => `- ${message}`).join("\n")
    : "- none";

  return [
    "depsentinel ci",
    `risk score: ${envelope.result.risk_score}`,
    `gate: ${envelope.result.failed_critical_policy ? "fail" : "pass"}`,
    `package manager: ${envelope.facts.packageManager}`,
    `framework hint: ${envelope.facts.framework}`,
    "findings:",
    findingLines,
    "remediation:",
    remediationLines,
    "diagnostics:",
    diagnosticLines
  ].join("\n");
}

export function runCi(options: CiOptions = {}): { envelope: CiEnvelope; output: string; shouldFail: boolean } {
  const scan = runScan({ cwd: options.cwd, json: true });
  const failedCriticalPolicy = scan.envelope.result.findings.some((finding) => finding.severity === "critical");

  const envelope: CiEnvelope = {
    schemaVersion: "1.0.0",
    command: "ci",
    facts: scan.envelope.facts,
    result: {
      risk_score: scan.envelope.result.risk_score,
      proposed_diff: scan.envelope.result.proposed_diff,
      remediation_commands: scan.envelope.result.remediation_commands,
      findings: scan.envelope.result.findings,
      failed_critical_policy: failedCriticalPolicy,
      diagnostics: []
    }
  };

  envelope.result.diagnostics = buildDiagnostics(envelope);

  return {
    envelope,
    output: options.json ? formatScanJson(envelope) : formatCiHuman(envelope),
    shouldFail: failedCriticalPolicy
  };
}
