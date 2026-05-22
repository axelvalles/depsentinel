import { detectProjectFacts } from "../core/detector.js";
import { evaluatePolicies } from "../core/evaluate.js";
import { computeRiskScore } from "../core/risk-score.js";
import { formatScanHuman } from "../formatters/human.js";
import { formatScanJson } from "../formatters/json.js";
import { policyCatalogV1 } from "../policies/catalog.v1.js";
function buildRemediationCommands(packageManager) {
    const install = packageManager === "pnpm"
        ? "pnpm install --frozen-lockfile"
        : packageManager === "yarn"
            ? "yarn install --immutable"
            : packageManager === "bun"
                ? "bun install --frozen-lockfile"
                : packageManager === "npm"
                    ? "npm ci"
                    : "corepack enable && pnpm install --frozen-lockfile";
    return [install, "npm audit --audit-level=critical"];
}
export function runScan(options = {}) {
    const cwd = options.cwd ?? process.cwd();
    const facts = detectProjectFacts(cwd);
    const findings = evaluatePolicies(facts, policyCatalogV1);
    const score = computeRiskScore(findings);
    const envelope = {
        schemaVersion: "1.0.0",
        command: "scan",
        facts,
        result: {
            risk_score: score,
            findings,
            proposed_diff: findings.map((finding) => `policy:${finding.ruleId}`),
            remediation_commands: buildRemediationCommands(facts.packageManager)
        }
    };
    return {
        envelope,
        output: options.json ? formatScanJson(envelope) : formatScanHuman(envelope)
    };
}
