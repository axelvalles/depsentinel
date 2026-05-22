import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fixtureAdvisorySource } from "../advisories/fixture-source.js";
function readJsonSafe(filePath, fallback) {
    try {
        return JSON.parse(readFileSync(filePath, "utf8"));
    }
    catch {
        return fallback;
    }
}
const DISALLOWED_PROTOCOLS = ["git+", "http:", "https:", "file:", "link:", "workspace:"];
function critical(ruleId, message, meta) {
    return {
        ruleId,
        severity: "critical",
        message,
        meta
    };
}
export const policyCatalogV1 = [
    {
        id: "lockfile.required",
        description: "Project must include lockfile",
        severity: "critical",
        evaluate: (facts) => {
            if (facts.lockfile) {
                return null;
            }
            return critical("lockfile.required", "Missing lockfile. Commit a lockfile to ensure reproducible installs.");
        }
    },
    {
        id: "dependency.protocol.disallowed",
        description: "Dependencies cannot use disallowed protocols",
        severity: "critical",
        evaluate: (facts) => {
            const violated = Object.entries(facts.dependencies).find(([, version]) => DISALLOWED_PROTOCOLS.some((protocol) => version.startsWith(protocol)));
            if (!violated) {
                return null;
            }
            const [name, version] = violated;
            return critical("dependency.protocol.disallowed", `Dependency ${name} uses disallowed source ${version}.`, { dependency: name, source: version });
        }
    },
    {
        id: "advisory.critical.detected",
        description: "Critical advisory source check",
        severity: "critical",
        evaluate: (facts) => {
            const match = fixtureAdvisorySource.findCriticalMatch(facts);
            if (!match) {
                return null;
            }
            return critical("advisory.critical.detected", `Critical advisory ${match.advisoryId} for ${match.packageName}@${match.affectedVersion}: ${match.title}`, {
                advisoryId: match.advisoryId,
                package: match.packageName,
                affectedVersion: match.affectedVersion
            });
        }
    },
    {
        id: "maintainer.env.plaintext",
        description: "Flag plaintext secrets in .env files",
        severity: "critical",
        evaluate: (facts) => {
            const envPath = path.join(facts.rootDir, ".env");
            if (!existsSync(envPath))
                return null;
            const content = readFileSync(envPath, "utf8");
            const secretLines = content.split("\n").filter((l) => {
                const trimmed = l.trim();
                if (!trimmed || trimmed.startsWith("#"))
                    return false;
                const val = trimmed.split("=").slice(1).join("=").trim();
                return val.length > 0 && !val.startsWith("op://") && !val.startsWith("infisical://") && !val.includes("${");
            });
            if (secretLines.length === 0)
                return null;
            return critical("maintainer.env.plaintext", `${secretLines.length} plaintext secrets found in .env. Replace with op:// or infisical:// references.`, { count: secretLines.length });
        }
    },
    {
        id: "ci.sbom.missing",
        description: "Project should have an SBOM generation script",
        severity: "low",
        evaluate: (facts) => {
            const pkgPath = path.join(facts.rootDir, "package.json");
            if (!existsSync(pkgPath))
                return null;
            const pkg = readJsonSafe(pkgPath, {});
            const hasSbom = pkg.scripts?.["sbom"] ?? pkg.scripts?.["generate:sbom"];
            if (hasSbom)
                return null;
            return {
                ruleId: "ci.sbom.missing",
                severity: "low",
                message: "No SBOM generation script. Add `sbom` script using @cyclonedx/cyclonedx-npm for supply chain transparency."
            };
        }
    },
    {
        id: "config.files.allowlist",
        description: "Non-private packages should define `files` allowlist",
        severity: "medium",
        evaluate: (facts) => {
            const pkgPath = path.join(facts.rootDir, "package.json");
            if (!existsSync(pkgPath))
                return null;
            const pkg = readJsonSafe(pkgPath, {});
            if (pkg.private)
                return null;
            if (pkg.files && pkg.files.length > 0)
                return null;
            return {
                ruleId: "config.files.allowlist",
                severity: "medium",
                message: "Public package missing `files` field in package.json. Without it, everything publishes."
            };
        }
    }
];
policyCatalogV1.sort((a, b) => a.id.localeCompare(b.id));
