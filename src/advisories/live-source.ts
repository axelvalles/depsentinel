import type { DetectionFacts } from "../types/contracts.js";
import type { AdvisorySource, CriticalAdvisoryMatch } from "./source.js";

interface FetchedAdvisory {
  packageName: string;
  affectedVersion: string;
  advisoryId: string;
  title: string;
  severity: string;
}

interface CacheEntry {
  advisories: FetchedAdvisory[];
  fetchedAt: number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000;
const GRACE_MS = 15 * 60 * 1000;

export interface LiveAdvisorySource extends AdvisorySource {
  refresh(): Promise<boolean>;
  getStatus(): { source: string; lastFetched: number | null; cachedCount: number; ttlMs: number };
}

export function createLiveAdvisorySource(options: {
  endpoint: string;
  ttlMs?: number;
  fallbackSource?: AdvisorySource;
}): LiveAdvisorySource {
  const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
  const fallback = options.fallbackSource ?? null;
  let cache: CacheEntry | null = null;
  let refreshInFlight: Promise<boolean> | null = null;

  function isFresh(): boolean {
    if (!cache) return false;
    return Date.now() - cache.fetchedAt < ttl;
  }

  function isGraceStale(): boolean {
    if (!cache) return false;
    return Date.now() - cache.fetchedAt < ttl + GRACE_MS;
  }

  async function refresh(): Promise<boolean> {
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = (async () => {
      try {
        const controller = new AbortController();
        const to = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(options.endpoint, { signal: controller.signal });
        clearTimeout(to);
        if (!res.ok) return false;
        const data = (await res.json()) as { advisories?: FetchedAdvisory[] };
        cache = { advisories: data.advisories ?? [], fetchedAt: Date.now() };
        return true;
      } catch {
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
    return refreshInFlight;
  }

  function findCriticalMatch(facts: DetectionFacts): CriticalAdvisoryMatch | null {
    if (cache && isFresh()) {
      return matchAdvisories(facts, cache.advisories);
    }

    if (cache && isGraceStale()) {
      void refresh();
      return matchAdvisories(facts, cache.advisories);
    }

    if (fallback) {
      const match = fallback.findCriticalMatch(facts);
      void refresh();
      return match;
    }

    void refresh();
    return null;
  }

  function getStatus() {
    return {
      source: options.endpoint,
      lastFetched: cache?.fetchedAt ?? null,
      cachedCount: cache?.advisories.length ?? 0,
      ttlMs: ttl
    };
  }

  return { findCriticalMatch, refresh, getStatus };
}

function matchAdvisories(facts: DetectionFacts, advisories: FetchedAdvisory[]): CriticalAdvisoryMatch | null {
  for (const adv of advisories) {
    if (adv.severity !== "critical") continue;
    const version = facts.dependencies[adv.packageName];
    if (version && version === adv.affectedVersion) {
      return {
        packageName: adv.packageName,
        affectedVersion: adv.affectedVersion,
        advisoryId: adv.advisoryId,
        title: adv.title
      };
    }
  }
  return null;
}
