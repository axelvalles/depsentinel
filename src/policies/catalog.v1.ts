import type { DetectionFacts, Finding, PolicyRule } from "../types/contracts.js";
import { fixtureAdvisorySource } from "../advisories/fixture-source.js";

const DISALLOWED_PROTOCOLS = ["git+", "http:", "https:", "file:", "link:", "workspace:"];

function critical(ruleId: string, message: string, meta?: Finding["meta"]): Finding {
  return {
    ruleId,
    severity: "critical",
    message,
    meta
  };
}

export const policyCatalogV1: PolicyRule[] = [
  {
    id: "lockfile.required",
    description: "Project must include lockfile",
    severity: "critical",
    evaluate: (facts: DetectionFacts) => {
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
    evaluate: (facts: DetectionFacts) => {
      const violated = Object.entries(facts.dependencies).find(([, version]) =>
        DISALLOWED_PROTOCOLS.some((protocol) => version.startsWith(protocol))
      );
      if (!violated) {
        return null;
      }
      const [name, version] = violated;
      return critical(
        "dependency.protocol.disallowed",
        `Dependency ${name} uses disallowed source ${version}.`,
        { dependency: name, source: version }
      );
    }
  },
  {
    id: "advisory.critical.detected",
    description: "Critical advisory source check",
    severity: "critical",
    evaluate: (facts: DetectionFacts) => {
      const match = fixtureAdvisorySource.findCriticalMatch(facts);
      if (!match) {
        return null;
      }

      return critical(
        "advisory.critical.detected",
        `Critical advisory ${match.advisoryId} for ${match.packageName}@${match.affectedVersion}: ${match.title}`,
        {
          advisoryId: match.advisoryId,
          package: match.packageName,
          affectedVersion: match.affectedVersion
        }
      );
    }
  },
  {
    id: "expo.baseline.workspace-required",
    description: "Expo preset requires workspace baseline",
    severity: "critical",
    evaluate: (facts: DetectionFacts) => {
      if (facts.framework !== "expo") {
        return null;
      }
      if (facts.isWorkspace) {
        return null;
      }
      return critical(
        "expo.baseline.workspace-required",
        "Expo preset requires workspace baseline (`workspaces` or `pnpm-workspace.yaml`)."
      );
    }
  }
] satisfies PolicyRule[];

policyCatalogV1.sort((a, b) => a.id.localeCompare(b.id));
