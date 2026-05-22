import type { DetectionFacts } from "../types/contracts.js";
import type { AdvisorySource, CriticalAdvisoryMatch } from "./source.js";

interface FixtureAdvisory {
  packageName: string;
  affectedVersion: string;
  advisoryId: string;
  title: string;
}

const FIXTURE_CRITICAL_ADVISORIES: FixtureAdvisory[] = [
  {
    packageName: "vulnerable-lib",
    affectedVersion: "1.0.0",
    advisoryId: "DSA-2026-0001",
    title: "Remote code execution in vulnerable-lib"
  }
];

function matchFixture(
  facts: DetectionFacts,
  fixtures: readonly FixtureAdvisory[]
): CriticalAdvisoryMatch | null {
  for (const fixture of fixtures) {
    const dependencyVersion = facts.dependencies[fixture.packageName];
    if (dependencyVersion === fixture.affectedVersion) {
      return {
        packageName: fixture.packageName,
        affectedVersion: fixture.affectedVersion,
        advisoryId: fixture.advisoryId,
        title: fixture.title
      };
    }
  }

  return null;
}

export const fixtureAdvisorySource: AdvisorySource = {
  findCriticalMatch: (facts: DetectionFacts) => matchFixture(facts, FIXTURE_CRITICAL_ADVISORIES)
};
