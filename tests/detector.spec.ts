import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectProjectFacts } from "../src/core/detector.js";

const fixture = (name: string): string => path.resolve(`tests/fixtures/m1/${name}`);

describe("detectProjectFacts", () => {
  it("detects missing lockfile from npm fixture", () => {
    const facts = detectProjectFacts(fixture("npm-no-lock"));
    expect(facts.packageManager).toBe("unknown");
    expect(facts.lockfile).toBeNull();
    expect(facts.framework).toBe("node");
  });

  it("detects expo + pnpm workspace fixture", () => {
    const facts = detectProjectFacts(fixture("pnpm-expo"));
    expect(facts.packageManager).toBe("pnpm");
    expect(facts.lockfile).toBe("pnpm-lock.yaml");
    expect(facts.framework).toBe("expo");
    expect(facts.isWorkspace).toBe(true);
  });

  it("detects lockfile and dependencies for protocol violation fixture", () => {
    const facts = detectProjectFacts(fixture("protocol-violation"));
    expect(facts.packageManager).toBe("npm");
    expect(facts.lockfile).toBe("package-lock.json");
    expect(facts.framework).toBe("node");
    expect(facts.dependencies["bad-lib"]).toContain("git+");
  });

  it("detects yarn lockfile with generic React framework hint", () => {
    const facts = detectProjectFacts(fixture("yarn-react"));
    expect(facts.packageManager).toBe("yarn");
    expect(facts.lockfile).toBe("yarn.lock");
    expect(facts.framework).toBe("react");
  });
});
