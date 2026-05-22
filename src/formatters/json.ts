export function formatScanJson(envelope: unknown): string {
  return JSON.stringify(envelope, null, 2);
}
