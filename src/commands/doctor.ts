import { detectProjectFacts } from "../core/detector.js";
import { collectDiagnoses } from "../core/doctor-checks.js";
import { computeRiskScore } from "../core/risk-score.js";
import { runFix } from "./fix.js";
import type { DoctorDiagnosis, DoctorEnvelope } from "../types/contracts.js";

export interface DoctorOptions {
  cwd?: string;
  json?: boolean;
  fix?: boolean;
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

  return [install, "depsentinel init", "depsentinel ci --json"];
}

function formatDoctorHuman(
  facts: ReturnType<typeof detectProjectFacts>,
  diagnoses: DoctorDiagnosis[],
  fixOutput?: string
): string {
  const useColor = Boolean(process.stdout.isTTY);
  const colors = {
    reset: "\u001b[0m",
    green: "\u001b[32m",
    red: "\u001b[31m",
    yellow: "\u001b[33m",
    cyan: "\u001b[36m",
    dim: "\u001b[2m"
  } as const;
  const paint = (text: string, color: keyof typeof colors): string =>
    useColor ? `${colors[color]}${text}${colors.reset}` : text;

  const byCategory = new Map<string, DoctorDiagnosis[]>();
  for (const d of diagnoses) {
    const list = byCategory.get(d.category) ?? [];
    list.push(d);
    byCategory.set(d.category, list);
  }

  const statusIcon = (s: string) => {
    if (s === "pass") return paint("✔ PASS", "green");
    if (s === "fail") return paint("✖ FAIL", "red");
    return paint("● SKIP", "yellow");
  };
  const severityFlag = (sv: string) => {
    if (sv === "critical") return paint("[CRITICAL] ", "red");
    if (sv === "high") return paint("[HIGH] ", "yellow");
    return "";
  };

  const lines: string[] = [
    paint("depsentinel doctor", "cyan"),
    `${paint("package manager", "dim")}: ${facts.packageManager}`,
    `${paint("framework hint", "dim")}: ${facts.framework}`,
    ""
  ];

  const order: DoctorDiagnosis["category"][] = ["config", "dependencies", "ci", "maintainer"];
  for (const cat of order) {
    const items = byCategory.get(cat) ?? [];
    if (items.length === 0) continue;
    const fails = items.filter((d) => d.status === "fail").length;
    const passes = items.filter((d) => d.status === "pass").length;
    const skips = items.filter((d) => d.status === "skipped").length;
    lines.push(
      `${paint("---", "dim")} ${paint(cat.toUpperCase(), "cyan")} ${paint(
        `(${passes} pass, ${fails} fail, ${skips} skip)`,
        "dim"
      )} ${paint("---", "dim")}`
    );
    for (const d of items) {
      lines.push(`  ${statusIcon(d.status)} ${severityFlag(d.severity)}${d.title}`);
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

  if (fixOutput) {
    lines.push(paint("Auto-fix", "cyan"));
    lines.push(...fixOutput.split("\n"));
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

  const fixOutput = options.fix
    ? runFix({ cwd, dryRun: false, json: false }).output
    : undefined;

  return {
    envelope,
    output: options.json
      ? JSON.stringify(
          {
            ...envelope,
            fix: options.fix ? { applied: true } : { applied: false }
          },
          null,
          2
        )
      : formatDoctorHuman(facts, diagnoses, fixOutput)
  };
}
