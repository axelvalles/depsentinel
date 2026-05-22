import { describe, expect, it, vi } from "vitest";
import {
  createToolAdapters,
  runOptionalToolAdapters,
  spawnWithTimeout,
  withTimeout
} from "../src/core/tool-adapters.js";
import type { AdapterReport } from "../src/types/contracts.js";

describe("createToolAdapters", () => {
  it("returns three adapters: npq, sfw, lockfile-lint", () => {
    const adapters = createToolAdapters();
    expect(adapters).toHaveLength(3);
    const toolNames = adapters.map((a) => a.tool);
    expect(toolNames).toContain("npq");
    expect(toolNames).toContain("sfw");
    expect(toolNames).toContain("lockfile-lint");
  });

  it("each adapter has tool name and check function", () => {
    const adapters = createToolAdapters();
    for (const adapter of adapters) {
      expect(adapter.tool).toBeTruthy();
      expect(typeof adapter.check).toBe("function");
    }
  });
});

describe("withTimeout", () => {
  it("resolves when promise completes before timeout", async () => {
    const result = withTimeout(Promise.resolve("ok"), 1000);
    await expect(result).resolves.toBe("ok");
  });

  it("rejects with timeout message when promise exceeds timeout", async () => {
    const slow = new Promise<string>((resolve) => {
      setTimeout(() => resolve("too late"), 500);
    });
    await expect(withTimeout(slow, 10)).rejects.toThrow("Timed out after 10ms");
  });
});

describe("spawnWithTimeout", () => {
  it("returns executed report on successful spawn", async () => {
    // Use a command that always exists on all platforms
    const report = await spawnWithTimeout("node", ["--version"], "test-tool", 5000);
    expect(report.tool).toBe("test-tool");
    expect(report.status).toBe("executed");
    expect(report.output).toBeTruthy();
    expect(report.exitCode).toBe(0);
  });

  it("returns failed report when command does not exist", async () => {
    const report = await spawnWithTimeout("nonexistent-tool-xyz", [], "missing", 2000);
    expect(report.tool).toBe("missing");
    expect(report.status).toBe("failed");
  });

  it("times out when command hangs", async () => {
    // node -e "setTimeout(()=>{},10000)" will hang for 10s — timeout at 100ms
    const report = await spawnWithTimeout("node", ["-e", "setTimeout(()=>{},10000)"], "hanger", 100);
    expect(report.tool).toBe("hanger");
    expect(report.status).toBe("failed");
    expect(report.error).toContain("timed out");
  }, 15000);
});

describe("runOptionalToolAdapters", () => {
  it("aggregates adapter reports into executed/skipped/failed buckets", async () => {
    const executedReport: AdapterReport = {
      tool: "npq",
      status: "executed",
      output: "clean",
      exitCode: 0
    };

    const skippedReport: AdapterReport = {
      tool: "sfw",
      status: "skipped"
    };

    const failedReport: AdapterReport = {
      tool: "lockfile-lint",
      status: "failed",
      error: "spawn error",
      exitCode: 1
    };

    const adapters = [
      { tool: "npq", check: () => Promise.resolve(executedReport) },
      { tool: "sfw", check: () => Promise.resolve(skippedReport) },
      { tool: "lockfile-lint", check: () => Promise.resolve(failedReport) }
    ];

    const result = await runOptionalToolAdapters(adapters, "test-pkg", "/fake/cwd");

    expect(result.executed).toHaveLength(1);
    expect(result.executed[0].tool).toBe("npq");
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].tool).toBe("sfw");
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].tool).toBe("lockfile-lint");
  });

  it("handles empty adapter list gracefully", async () => {
    const result = await runOptionalToolAdapters([], "pkg", "/cwd");
    expect(result.executed).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(result.failed).toEqual([]);
  });

  it("marks adapter as failed when check throws", async () => {
    const crashingAdapter = {
      tool: "crashy",
      check: () => Promise.reject(new Error("boom"))
    };

    const result = await runOptionalToolAdapters([crashingAdapter], "pkg", "/cwd");
    expect(result.executed).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].tool).toBe("crashy");
    expect(result.failed[0].error).toBe("boom");
  });
});
