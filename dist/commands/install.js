import { detectProjectFacts } from "../core/detector.js";
import { evaluatePolicies } from "../core/evaluate.js";
import { computeRiskScore } from "../core/risk-score.js";
import { deriveInstallDecision } from "../core/install-decision.js";
import { formatInstallHuman } from "../formatters/human.js";
import { formatInstallJson } from "../formatters/json.js";
import { policyCatalogV1 } from "../policies/catalog.v1.js";
const INSTALL_COMMANDS = {
    npm: "npm install",
    pnpm: "pnpm add",
    yarn: "yarn add",
    bun: "bun add"
};
export function getManagerInstallCommand(manager, packageName) {
    const template = INSTALL_COMMANDS[manager];
    if (!template) {
        throw new Error("Cannot install with unknown package manager");
    }
    return `${template} ${packageName}`;
}
function buildRemediationCommands(packageManager) {
    const install = packageManager === "pnpm"
        ? "pnpm install --frozen-lockfile"
        : packageManager === "yarn"
            ? "yarn install --immutable"
            : packageManager === "bun"
                ? "bun install --frozen-lockfile"
                : "npm ci";
    return [install, "npm audit --audit-level=critical"];
}
const PACKAGE_NAME_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
function isValidPackageName(name) {
    return PACKAGE_NAME_RE.test(name) && name.length <= 214 && !name.startsWith(".") && !name.startsWith("_");
}
export function runInstall(options) {
    const cwd = options.cwd ?? process.cwd();
    const packageName = options.packageName;
    const force = options.force ?? false;
    if (!isValidPackageName(packageName)) {
        throw new Error(`Invalid package name: "${packageName}". Must be a valid npm package name (e.g. "lodash" or "@scope/pkg").`);
    }
    const facts = detectProjectFacts(cwd);
    const findings = evaluatePolicies(facts, policyCatalogV1);
    const score = computeRiskScore(findings);
    const decision = deriveInstallDecision(findings, score);
    // Compute manager command for reporting
    const managerCommand = facts.packageManager !== "unknown"
        ? getManagerInstallCommand(facts.packageManager, packageName)
        : undefined;
    const remediationCommands = buildRemediationCommands(facts.packageManager);
    // Adapter report — adapters are async and not run in sync command flow.
    // Real CLI should use async adapter runner; sync path provides empty array.
    const adapterReport = [];
    // Decision gate
    const shouldBlock = decision === "block" && !force;
    const shouldWarn = decision === "warn" && !force;
    const installProceeded = !shouldBlock && !shouldWarn;
    const result = {
        decision,
        forced: force && decision !== "allow",
        score,
        findings,
        remediationCommands,
        adapterReport,
        installed: installProceeded,
        managerCommand,
        exitCode: installProceeded ? 0 : 1
    };
    const envelope = {
        schemaVersion: "1.0.0",
        command: "install",
        facts,
        result
    };
    const output = options.json
        ? formatInstallJson(envelope)
        : formatInstallHuman(envelope);
    return {
        envelope,
        output,
        exitCode: result.exitCode
    };
}
