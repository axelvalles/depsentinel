import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { DetectionFacts, DoctorDiagnosis } from "../types/contracts.js";

function pass(id: string, category: DoctorDiagnosis["category"], title: string): DoctorDiagnosis {
  return {
    id,
    category,
    severity: "low",
    status: "pass",
    title,
    detail: title,
    remediation: "",
    automated: true
  };
}

function fail(
  id: string,
  category: DoctorDiagnosis["category"],
  severity: DoctorDiagnosis["severity"],
  title: string,
  detail: string,
  remediation: string,
  automated = true
): DoctorDiagnosis {
  return { id, category, severity, status: "fail", title, detail, remediation, automated };
}

function skip(
  id: string,
  category: DoctorDiagnosis["category"],
  title: string,
  detail: string,
  remediation: string
): DoctorDiagnosis {
  return { id, category, severity: "low", status: "skipped", title, detail, remediation, automated: false };
}

export function collectDiagnoses(rootDir: string, facts: DetectionFacts): DoctorDiagnosis[] {
  return [
    checkNpmRc(rootDir),
    checkNpmIgnore(rootDir),
    checkPackageJsonFiles(rootDir),
    checkPnpmWorkspace(rootDir, facts),
    checkBunfig(rootDir, facts),
    checkYarnRc(rootDir, facts),
    checkLockfileCommitted(rootDir),
    checkCiProvenance(rootDir),
    checkLintLockfile(rootDir),
    checkSbomScript(rootDir),
    checkEnvPlaintext(rootDir),
    checkNpxHardening(),
    checkNpm2fa(),
    checkDevContainer(rootDir),
    checkNodeModulesGitignored(rootDir)
  ];
}

function checkNpmRc(rootDir: string): DoctorDiagnosis {
  const npmrc = path.join(rootDir, ".npmrc");
  if (!existsSync(npmrc)) return fail("config.npmrc.missing", "config", "high", "Missing .npmrc security baseline", "No .npmrc found in project root.", "Run `depsentinel init` to generate a secure .npmrc baseline.");
  const content = readFileSync(npmrc, "utf8");
  const missing: string[] = [];
  if (!content.includes("ignore-scripts=true")) missing.push("ignore-scripts=true");
  if (!content.includes("allow-git=none")) missing.push("allow-git=none");
  if (!content.includes("min-release-age")) missing.push("min-release-age");
  if (missing.length === 0) return pass("config.npmrc.secure", "config", ".npmrc has secure baseline");
  return fail("config.npmrc.incomplete", "config", "medium", `.npmrc missing: ${missing.join(", ")}`, "Your .npmrc lacks key security settings.", "Run `depsentinel init` to regenerate .npmrc.");
}

function checkNpmIgnore(rootDir: string): DoctorDiagnosis {
  if (existsSync(path.join(rootDir, ".npmignore"))) return pass("config.npmignore.present", "config", ".npmignore present");
  return fail("config.npmignore.missing", "config", "medium", "Missing .npmignore", "Without .npmignore, sensitive files may leak into published packages.", "Add a .npmignore file listing patterns to exclude from npm publish.");
}

function checkPackageJsonFiles(rootDir: string): DoctorDiagnosis {
  const pkg = path.join(rootDir, "package.json");
  if (!existsSync(pkg)) return skip("config.package-json.missing", "config", "No package.json found", "Cannot evaluate package.json settings.", "Ensure package.json exists.");
  const content = readFileSync(pkg, "utf8");
  const parsed = JSON.parse(content) as { files?: string[]; private?: boolean };
  if (parsed.private) return pass("config.package-json.files-private", "config", "Private package (no publish risk)");
  if (parsed.files && parsed.files.length > 0) return pass("config.package-json.files-present", "config", "package.json has `files` allowlist");
  return fail("config.package-json.files-missing", "config", "medium", "Missing `files` field in package.json", "Without `files`, npm publishes everything not excluded by .npmignore/.gitignore.", "Add a `files` array to package.json with only the dist/ entry point you want published.");
}

function checkPnpmWorkspace(rootDir: string, facts: DetectionFacts): DoctorDiagnosis {
  const wsPath = path.join(rootDir, "pnpm-workspace.yaml");
  if (!existsSync(wsPath)) {
    if (facts.packageManager === "pnpm") return fail("config.pnpm-workspace.missing", "config", "high", "pnpm workspace without security hardening", "pnpm is detected but pnpm-workspace.yaml is missing or lacks security settings.", "Run `depsentinel init --preset expo` or copy the security baseline into your pnpm-workspace.yaml.");
    return skip("config.pnpm-workspace.non-pnpm", "config", "Not a pnpm project", "pnpm-workspace.yaml only applies to pnpm projects.", "No action needed unless you switch to pnpm.");
  }
  const content = readFileSync(wsPath, "utf8");
  const missing: string[] = [];
  if (!content.includes("minimumReleaseAge")) missing.push("minimumReleaseAge");
  if (!content.includes("trustPolicy")) missing.push("trustPolicy: no-downgrade");
  if (!content.includes("blockExoticSubdeps: true")) missing.push("blockExoticSubdeps: true");
  if (!content.includes("strictDepBuilds: true")) missing.push("strictDepBuilds: true");
  if (missing.length === 0) return pass("config.pnpm-workspace.secure", "config", "pnpm-workspace.yaml has security baseline");
  return fail("config.pnpm-workspace.incomplete", "config", "high", `pnpm-workspace.yaml missing: ${missing.join(", ")}`, "Your pnpm workspace lacks key security settings.", "Add the missing settings. Run `depsentinel init --preset expo` to see the baseline.");
}

function checkBunfig(rootDir: string, facts: DetectionFacts): DoctorDiagnosis {
  if (facts.packageManager !== "bun") return skip("config.bunfig.non-bun", "config", "Not a Bun project", "bunfig.toml only applies to Bun projects.", "No action needed unless you switch to Bun.");
  const bunfigPath = path.join(rootDir, "bunfig.toml");
  if (!existsSync(bunfigPath)) return fail("config.bunfig.missing", "config", "medium", "Bun project without bunfig.toml hardening", "Add a bunfig.toml with minimumReleaseAge and trustedDependencies.", "Create bunfig.toml with [install] section containing minimumReleaseAge and trustedDependencies.");
  const content = readFileSync(bunfigPath, "utf8");
  if (!content.includes("minimumReleaseAge")) return fail("config.bunfig.no-cooldown", "config", "medium", "bunfig.toml missing minimumReleaseAge", "Bun has no cooldown configured for fresh packages.", "Add `minimumReleaseAge = 259200` to [install] section.");
  return pass("config.bunfig.secure", "config", "bunfig.toml has security baseline");
}

function checkYarnRc(rootDir: string, facts: DetectionFacts): DoctorDiagnosis {
  if (facts.packageManager !== "yarn") return skip("config.yarnrc.non-yarn", "config", "Not a Yarn project", ".yarnrc.yml only applies to Yarn projects.", "No action needed.");
  const yarnrcPath = path.join(rootDir, ".yarnrc.yml");
  if (!existsSync(yarnrcPath)) return fail("config.yarnrc.missing", "config", "medium", "Yarn project without .yarnrc.yml hardening", "Yarn detected but no .yarnrc.yml or npmMinimalAgeGate.", "Create .yarnrc.yml with `npmMinimalAgeGate: \"3d\"`.");
  const content = readFileSync(yarnrcPath, "utf8");
  if (!content.includes("npmMinimalAgeGate")) return fail("config.yarnrc.no-cooldown", "config", "medium", ".yarnrc.yml missing npmMinimalAgeGate", "Yarn has no cooldown for fresh packages.", "Add `npmMinimalAgeGate: \"3d\"` to .yarnrc.yml.");
  return pass("config.yarnrc.secure", "config", ".yarnrc.yml has security baseline");
}

function checkLockfileCommitted(rootDir: string): DoctorDiagnosis {
  const gitDir = path.join(rootDir, ".git");
  if (!existsSync(gitDir)) return skip("ci.lockfile-committed.no-git", "ci", "Not a git repository", "Cannot check lockfile commit status without git.", "Initialize a git repository and commit your lockfile.");
  const lockfile = path.join(rootDir, "package-lock.json");
  if (!existsSync(lockfile)) return skip("ci.lockfile-committed.no-lockfile", "ci", "No lockfile to check", "No lockfile found to verify commit status.", "Generate a lockfile with `npm install` and commit it.");
  return skip("ci.lockfile-committed.manual", "ci", "Verify lockfile committed", "Use `git ls-files package-lock.json` to confirm your lockfile is committed.", "Run `git add package-lock.json && git commit -m \"chore: add lockfile\"`.");
}

function checkCiProvenance(rootDir: string): DoctorDiagnosis {
  const workflowsDir = path.join(rootDir, ".github", "workflows");
  if (!existsSync(workflowsDir)) return fail("ci.provenance.no-workflows", "ci", "medium", "No GitHub Actions workflows found", "Cannot verify provenance/id-token configuration without CI workflows.", "Add `permissions: id-token: write` to your publish workflow for npm provenance.");
  const files = require("node:fs").readdirSync(workflowsDir).filter((f: string) => f.endsWith(".yml") || f.endsWith(".yaml"));
  let hasIdToken = false;
  for (const file of files) {
    const content = readFileSync(path.join(workflowsDir, file), "utf8");
    if (content.includes("id-token: write")) { hasIdToken = true; break; }
  }
  if (hasIdToken) return pass("ci.provenance.id-token", "ci", "CI workflow has id-token: write");
  return fail("ci.provenance.missing", "ci", "medium", "CI workflows missing id-token: write for provenance", "Publishing with provenance requires `id-token: write` permission.", "Add `permissions:\\n  id-token: write` to your publish workflow.");
}

function checkLintLockfile(rootDir: string): DoctorDiagnosis {
  const pkgPath = path.join(rootDir, "package.json");
  if (!existsSync(pkgPath)) return skip("ci.lint-lockfile.no-pkg", "ci", "No package.json", "Cannot check lockfile lint scripts.", "Ensure package.json exists.");
  const content = readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(content) as { scripts?: Record<string, string>; devDependencies?: Record<string, string> };
  const hasScript = pkg.scripts?.["lint:lockfile"] ?? false;
  const hasDep = pkg.devDependencies?.["lockfile-lint"] ?? false;
  if (hasScript && hasDep) return pass("ci.lint-lockfile.configured", "ci", "lockfile-lint configured in package.json");
  if (hasScript && !hasDep) return fail("ci.lint-lockfile.no-dep", "ci", "medium", "lint:lockfile script exists but lockfile-lint not in devDependencies", "The lockfile lint script references a tool that is not installed.", "Run `npm install --save-dev lockfile-lint`.");
  return fail("ci.lint-lockfile.missing", "ci", "medium", "Missing lockfile linting gate", "Without lockfile-lint, lockfile injection attacks go undetected.", "Install lockfile-lint and add `\"lint:lockfile\": \"lockfile-lint --path package-lock.json --type npm --allowed-hosts npm --validate-https\"` to scripts.");
}

function checkSbomScript(rootDir: string): DoctorDiagnosis {
  const pkgPath = path.join(rootDir, "package.json");
  if (!existsSync(pkgPath)) return skip("ci.sbom.no-pkg", "ci", "No package.json", "Cannot check SBOM scripts.", "Ensure package.json exists.");
  const content = readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(content) as { scripts?: Record<string, string> };
  const hasSbom = pkg.scripts?.["sbom"] ?? pkg.scripts?.["generate:sbom"] ?? false;
  if (hasSbom) return pass("ci.sbom.present", "ci", "SBOM generation script configured");
  return fail("ci.sbom.missing", "ci", "low", "No SBOM generation script", "SBOM helps track what was built and where inputs originated (supply chain transparency).", "Add a script: `\"sbom\": \"npx @cyclonedx/cyclonedx-npm --validate > sbom.json\"`.");
}

function checkEnvPlaintext(rootDir: string): DoctorDiagnosis {
  const envPath = path.join(rootDir, ".env");
  if (!existsSync(envPath)) return pass("maintainer.env.no-file", "maintainer", "No .env file in project root");
  const content = readFileSync(envPath, "utf8");
  const lines = content.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
  const secretLines = lines.filter((l) => {
    const val = l.split("=").slice(1).join("=").trim();
    return val.length > 0 && !val.startsWith("op://") && !val.startsWith("infisical://") && !val.includes("${");
  });
  if (secretLines.length === 0) return pass("maintainer.env.secure", "maintainer", ".env uses secret references (not plaintext)");
  return fail("maintainer.env.plaintext", "maintainer", "critical", `${secretLines.length} plaintext secrets in .env`, "Plaintext secrets in .env are exfiltratable by any compromised dependency.", "Replace plaintext values with references (op:// or infisical://) and use a secrets manager CLI at runtime.");
}

function checkNpxHardening(): DoctorDiagnosis {
  return skip("maintainer.npx-hardening.manual", "maintainer", "Verify npx hardening", "npx can silently pull fresh malicious packages without lockfile verification.", "Create a dedicated workspace with pre-installed npx packages, and use `npx --offline --workspace <path>` to block network fetches. See docs/security-best-practices.md for step-by-step instructions.");
}

function checkNpm2fa(): DoctorDiagnosis {
  return skip("maintainer.2fa.manual", "maintainer", "Verify npm account 2FA", "Accounts without 2FA are vulnerable to credential theft and package takeover.", "Run `npm profile enable-2fa auth-and-writes` to enable 2FA for your npm account.");
}

function checkDevContainer(rootDir: string): DoctorDiagnosis {
  const devContainerPath = path.join(rootDir, ".devcontainer", "devcontainer.json");
  if (existsSync(devContainerPath)) return pass("maintainer.devcontainer.present", "maintainer", "Dev Container configured");
  return fail("maintainer.devcontainer.missing", "maintainer", "low", "No Dev Container configured", "Dev Containers isolate npm execution from host system, limiting malware blast radius.", "Create `.devcontainer/devcontainer.json` with a Node.js image and `postCreateCommand: npm ci`.");
}

function checkNodeModulesGitignored(rootDir: string): DoctorDiagnosis {
  const gitignorePath = path.join(rootDir, ".gitignore");
  if (!existsSync(gitignorePath)) return fail("config.gitignore.missing", "config", "medium", "Missing .gitignore", "Without .gitignore, node_modules/ and secrets could be committed accidentally.", "Add a .gitignore file with `node_modules/` and `.env` patterns.");
  const content = readFileSync(gitignorePath, "utf8");
  if (content.includes("node_modules")) return pass("config.gitignore.node-modules", "config", ".gitignore blocks node_modules");
  return fail("config.gitignore.no-node-modules", "config", "medium", ".gitignore missing node_modules", "node_modules is not gitignored, risking accidental commits of thousands of files.", "Add `node_modules/` to .gitignore.");
}
