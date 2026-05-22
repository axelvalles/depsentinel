import { describe, expect, it } from "vitest";
import { getManagerInstallCommand } from "../src/commands/install.js";
import type {
  AdapterReport,
  AdapterStatus,
  InstallDecision,
  InstallEnvelope,
  InstallOptions,
  InstallResult
} from "../src/types/contracts.js";

describe("Install contracts (M2)", () => {
  it("accepts a well-formed InstallEnvelope on allow decision", () => {
    const envelope: InstallEnvelope = {
      schemaVersion: "1.0.0",
      command: "install",
      facts: {
        rootDir: "/fake/project",
        packageManager: "npm",
        lockfile: "package-lock.json",
        isWorkspace: false,
        framework: "node",
        dependencies: { "some-lib": "^1.0.0" }
      },
      result: {
        decision: "allow",
        forced: false,
        score: 85,
        findings: [],
        remediationCommands: ["npm audit"],
        adapterReport: [],
        installed: true,
        managerCommand: "npm install some-lib",
        exitCode: 0
      }
    };

    expect(envelope.command).toBe("install");
    expect(envelope.result.decision).toBe("allow");
    expect(envelope.result.exitCode).toBe(0);
  });

  it("accepts a blocked envelope with findings and no install", () => {
    const envelope: InstallEnvelope = {
      schemaVersion: "1.0.0",
      command: "install",
      facts: {
        rootDir: "/fake/project",
        packageManager: "npm",
        lockfile: null,
        isWorkspace: false,
        framework: "node",
        dependencies: { "bad-lib": "git+https://evil" }
      },
      result: {
        decision: "block",
        forced: false,
        score: 55,
        findings: [
          {
            ruleId: "dependency.protocol.disallowed",
            severity: "critical",
            message: "Dependency bad-lib uses disallowed source git+https://evil.",
            meta: { dependency: "bad-lib", source: "git+https://evil" }
          }
        ],
        remediationCommands: ["npm ci", "npm audit --audit-level=critical"],
        adapterReport: [],
        installed: false,
        exitCode: 1
      }
    };

    expect(envelope.result.installed).toBe(false);
    expect(envelope.result.findings).toHaveLength(1);
    expect(envelope.result.findings[0].severity).toBe("critical");
  });

  it("accepts a forced block decision with override marker", () => {
    const result: InstallResult = {
      decision: "block",
      forced: true,
      score: 55,
      findings: [
        {
          ruleId: "lockfile.required",
          severity: "critical",
          message: "Missing lockfile."
        }
      ],
      remediationCommands: ["npm ci"],
      adapterReport: [],
      installed: true,
      managerCommand: "npm install risky-pkg",
      exitCode: 0
    };

    expect(result.forced).toBe(true);
    expect(result.installed).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it("Validates AdapterReport discriminates executed/skipped/failed", () => {
    const executed: AdapterReport = {
      tool: "npq",
      status: "executed" as AdapterStatus,
      output: "Package looks ok",
      exitCode: 0
    };

    const skipped: AdapterReport = {
      tool: "sfw",
      status: "skipped" as AdapterStatus
    };

    const failed: AdapterReport = {
      tool: "lockfile-lint",
      status: "failed" as AdapterStatus,
      error: "spawn lockfile-lint ENOENT",
      exitCode: 1
    };

    expect(executed.status).toBe("executed");
    expect(skipped.status).toBe("skipped");
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("spawn lockfile-lint ENOENT");
  });

  it("validates InstallOptions with various shapes", () => {
    const minimal: InstallOptions = { packageName: "left-pad" };
    const full: InstallOptions = {
      packageName: "react",
      cwd: "/some/project",
      force: true,
      json: false,
      manager: "pnpm"
    };

    expect(minimal.packageName).toBe("left-pad");
    expect(full.force).toBe(true);
    expect(full.manager).toBe("pnpm");
  });
});

describe("getManagerInstallCommand", () => {
  it("returns npm install for npm manager", () => {
    expect(getManagerInstallCommand("npm", "left-pad")).toBe("npm install left-pad");
  });

  it("returns pnpm add for pnpm manager", () => {
    expect(getManagerInstallCommand("pnpm", "react")).toBe("pnpm add react");
  });

  it("returns yarn add for yarn manager", () => {
    expect(getManagerInstallCommand("yarn", "lodash")).toBe("yarn add lodash");
  });

  it("returns bun add for bun manager", () => {
    expect(getManagerInstallCommand("bun", "zod")).toBe("bun add zod");
  });

  it("throws for unknown package manager", () => {
    expect(() => getManagerInstallCommand("unknown", "pkg")).toThrow(
      "Cannot install with unknown package manager"
    );
  });

  it("handles scoped npm package names", () => {
    expect(getManagerInstallCommand("npm", "@scope/my-lib")).toBe("npm install @scope/my-lib");
  });

  it("handles scoped packages with pnpm", () => {
    expect(getManagerInstallCommand("pnpm", "@org/pkg")).toBe("pnpm add @org/pkg");
  });
});
