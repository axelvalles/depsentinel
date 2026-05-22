import { detectProjectFacts } from "../core/detector.js";
import { collectDiagnoses } from "../core/doctor-checks.js";
import { computeRiskScore } from "../core/risk-score.js";
import type { DoctorDiagnosis, DoctorEnvelope } from "../types/contracts.js";

export interface DoctorOptions {
  cwd?: string;
  json?: boolean;
}

function buildRemediationCommands(facts: ReturnType<typeof detectProjectFacts>): string[] {
  const install =
    facts.packageManager === "pnpm"
      ? "pnpm install --frozen-lockfile"
      : facts.packageManager === "yarn"
        ? "yarn install --immutable"
        : facts.packageManager === "bun"
          ? "bun install --frozen-lockfile"
        : facts.packageManager === "npm"
          ? "npm ci"
          : "corepack enable && pnpm install --frozen-lockfile";

  return [install, "depsentinel init --write", "depsentinel ci --json"];
}

function formatDoctorHuman(facts: ReturnType<typeof detectProjectFacts>, diagnoses: DoctorDiagnosis[]): string {
  const byCategory = new Map<string, DoctorDiagnosis[]>();
  for (const d of diagnoses) {
    const list = byCategory.get(d.category) ?? [];
    list.push(d);
    byCategory.set(d.category, list);
  }

  const statusIcon = (s: string) => (s === "pass" ? "PASS" : s === "fail" ? "FAIL" : "SKIP");
  const severityFlag = (sv: string) => (sv === "critical" ? "!! " : sv === "high" ? "! " : "");

  const lines: string[] = ["depsentinel doctor", `package manager: ${facts.packageManager}`, `framework hint: ${facts.framework}`, ""];

  const order: DoctorDiagnosis["category"][] = ["config", "dependencies", "ci", "maintainer"];
  for (const cat of order) {
    const items = byCategory.get(cat) ?? [];
    if (items.length === 0) continue;
    const fails = items.filter((d) => d.status === "fail").length;
    const passes = items.filter((d) => d.status === "pass").length;
    const skips = items.filter((d) => d.status === "skipped").length;
    lines.push(`--- ${cat.toUpperCase()} (${passes} pass, ${fails} fail, ${skips} skip) ---`);
    for (const d of items) {
      lines.push(`  [${statusIcon(d.status)}] ${severityFlag(d.severity)}${d.title}`);
      if (d.status === "fail") {
        lines.push(`    Why: ${d.detail}`);
        lines.push(`    Fix: ${d.remediation}`);
      }
      if (d.status === "skipped") {
        lines.push(`    Note: ${d.detail}`);
        lines.push(`    Action: ${d.remediation}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function runDoctor(options: DoctorOptions = {}): { envelope: DoctorEnvelope; output: string } {
  const cwd = options.cwd ?? process.cwd();
  const facts = detectProjectFacts(cwd);
  const diagnoses = collectDiagnoses(cwd, facts);

  const passed = diagnoses.filter((d) => d.status === "pass").length;
  const failed = diagnoses.filter((d) => d.status === "fail").length;
  const skipped = diagnoses.filter((d) => d.status === "skipped").length;

  const riskFindings = diagnoses.filter((d) => d.status === "fail").map((d) => ({
    ruleId: d.id,
    severity: d.severity,
    message: d.title
  }));
  const score = computeRiskScore(riskFindings);

  const envelope: DoctorEnvelope = {
    schemaVersion: "1.0.0",
    command: "doctor",
    facts,
    result: {
      risk_score: score,
      diagnoses,
      passed,
      failed,
      skipped
    }
  };

  return {
    envelope,
    output: options.json ? JSON.stringify(envelope, null, 2) : formatDoctorHuman(facts, diagnoses)
  };
}
