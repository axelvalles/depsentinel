import { describe, expect, it } from "vitest";
import { createLiveAdvisorySource } from "../src/advisories/live-source.js";
import type { AdvisorySource, CriticalAdvisoryMatch } from "../src/advisories/source.js";
import type { DetectionFacts } from "../src/types/contracts.js";

const emptyFacts: DetectionFacts = {
  rootDir: "/tmp",
  packageManager: "npm",
  lockfile: "package-lock.json",
  isWorkspace: false,
  framework: "node",
  dependencies: { lodash: "4.17.21" }
};

const fallbackMatch: CriticalAdvisoryMatch = {
  packageName: "lodash",
  affectedVersion: "4.17.21",
  advisoryId: "GHSA-fallback",
  title: "Fallback advisory match"
};

const fallbackSource: AdvisorySource = {
  findCriticalMatch: () => fallbackMatch
};

const emptyFallback: AdvisorySource = {
  findCriticalMatch: () => null
};

describe("live advisory source", () => {
  it("returns null when no cache and no fallback", () => {
    const source = createLiveAdvisorySource({ endpoint: "https://example.com/advisories", fallbackSource: emptyFallback });
    const match = source.findCriticalMatch(emptyFacts);
    expect(match).toBeNull();
  });

  it("falls back when cache is cold and fallback is configured", () => {
    const source = createLiveAdvisorySource({ endpoint: "https://example.com/advisories", fallbackSource });
    const match = source.findCriticalMatch(emptyFacts);
    expect(match).not.toBeNull();
    expect(match?.advisoryId).toBe("GHSA-fallback");
  });

  it("getStatus reports initial state", () => {
    const source = createLiveAdvisorySource({ endpoint: "https://example.com/advisories" });
    const status = source.getStatus();
    expect(status.source).toBe("https://example.com/advisories");
    expect(status.cachedCount).toBe(0);
    expect(status.lastFetched).toBeNull();
    expect(status.ttlMs).toBe(3600000);
  });

  it("respects custom ttlMs", () => {
    const source = createLiveAdvisorySource({ endpoint: "https://x.com/a", ttlMs: 300000 });
    expect(source.getStatus().ttlMs).toBe(300000);
  });
});
