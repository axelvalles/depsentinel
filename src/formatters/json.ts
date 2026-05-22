import type { InstallEnvelope } from "../types/contracts.js";

export function formatScanJson(envelope: unknown): string {
  return JSON.stringify(envelope, null, 2);
}

export function formatInstallJson(envelope: InstallEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}
