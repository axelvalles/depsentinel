import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AdapterReport } from "../types/contracts.js";

const execFileAsync = promisify(execFile);

export const DEFAULT_ADAPTER_TIMEOUT_MS = 5000;

export interface Adapter {
  tool: string;
  check(packageName: string, cwd: string): Promise<AdapterReport>;
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    })
  ]);
}

export async function spawnWithTimeout(
  command: string,
  args: string[],
  tool: string,
  timeoutMs: number
): Promise<AdapterReport> {
  try {
    const result = await withTimeout(
      execFileAsync(command, args, {
        timeout: timeoutMs,
        windowsHide: true
      }),
      timeoutMs
    );

    return {
      tool,
      status: "executed",
      output: result.stdout.trim() || result.stderr.trim() || "(no output)",
      exitCode: 0
    };
  } catch (error) {
    const err = error as Error & {
      killed?: boolean;
      code?: string;
      exitCode?: number;
      stdout?: string;
      stderr?: string;
    };
    const isTimeout =
      err.killed === true ||
      err.code === "ETIMEDOUT" ||
      (err.message && /timed out/i.test(err.message));

    return {
      tool,
      status: "failed",
      error: isTimeout ? `Adapter ${tool} timed out after ${timeoutMs}ms` : (err.message ?? String(error)),
      exitCode: err.code === "ENOENT" ? undefined : (err.exitCode ?? 1),
      output: err.stdout?.trim() || err.stderr?.trim() || undefined
    };
  }
}

function buildNpxAdapter(tool: string): Adapter {
  return {
    tool,
    check: async (packageName: string, _cwd: string): Promise<AdapterReport> => {
      try {
        // Try running npx <tool> --version to detect tool availability
        await execFileAsync("npx", [tool, "--version"], {
          timeout: DEFAULT_ADAPTER_TIMEOUT_MS,
          windowsHide: true
        });

        // Tool is available — execute the actual check
        return spawnWithTimeout("npx", [tool, packageName], tool, DEFAULT_ADAPTER_TIMEOUT_MS);
      } catch {
        // Tool not available — skip gracefully
        return { tool, status: "skipped" };
      }
    }
  };
}

export function createToolAdapters(): Adapter[] {
  return [
    buildNpxAdapter("npq"),
    buildNpxAdapter("sfw"),
    buildNpxAdapter("lockfile-lint")
  ];
}

export interface AdapterAggregation {
  executed: AdapterReport[];
  skipped: AdapterReport[];
  failed: AdapterReport[];
}

export async function runOptionalToolAdapters(
  adapters: Adapter[],
  packageName: string,
  cwd: string
): Promise<AdapterAggregation> {
  const results: AdapterReport[] = [];

  for (const adapter of adapters) {
    try {
      const report = await adapter.check(packageName, cwd);
      results.push(report);
    } catch (error) {
      results.push({
        tool: adapter.tool,
        status: "failed",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return {
    executed: results.filter((r) => r.status === "executed"),
    skipped: results.filter((r) => r.status === "skipped"),
    failed: results.filter((r) => r.status === "failed")
  };
}
