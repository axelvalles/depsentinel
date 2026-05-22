const FIXTURE_CRITICAL_ADVISORIES = [
    {
        packageName: "vulnerable-lib",
        affectedVersion: "1.0.0",
        advisoryId: "DSA-2026-0001",
        title: "Remote code execution in vulnerable-lib"
    }
];
function matchFixture(facts, fixtures) {
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
export const fixtureAdvisorySource = {
    findCriticalMatch: (facts) => matchFixture(facts, FIXTURE_CRITICAL_ADVISORIES)
};
