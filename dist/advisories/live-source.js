const DEFAULT_TTL_MS = 60 * 60 * 1000;
const GRACE_MS = 15 * 60 * 1000;
export function createLiveAdvisorySource(options) {
    const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
    const fallback = options.fallbackSource ?? null;
    let cache = null;
    let refreshInFlight = null;
    function isFresh() {
        if (!cache)
            return false;
        return Date.now() - cache.fetchedAt < ttl;
    }
    function isGraceStale() {
        if (!cache)
            return false;
        return Date.now() - cache.fetchedAt < ttl + GRACE_MS;
    }
    async function refresh() {
        if (refreshInFlight)
            return refreshInFlight;
        refreshInFlight = (async () => {
            try {
                const controller = new AbortController();
                const to = setTimeout(() => controller.abort(), 10000);
                const res = await fetch(options.endpoint, { signal: controller.signal });
                clearTimeout(to);
                if (!res.ok)
                    return false;
                const data = (await res.json());
                cache = { advisories: data.advisories ?? [], fetchedAt: Date.now() };
                return true;
            }
            catch {
                return false;
            }
            finally {
                refreshInFlight = null;
            }
        })();
        return refreshInFlight;
    }
    function findCriticalMatch(facts) {
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
function matchAdvisories(facts, advisories) {
    for (const adv of advisories) {
        if (adv.severity !== "critical")
            continue;
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
