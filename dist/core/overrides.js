import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
function defaults() {
    return { schemaVersion: "1.0.0", overrides: [] };
}
function readStore(cwd) {
    const storePath = path.join(cwd, "depsentinel.overrides.json");
    if (!existsSync(storePath))
        return defaults();
    try {
        const raw = JSON.parse(readFileSync(storePath, "utf8"));
        return { schemaVersion: raw.schemaVersion ?? "1.0.0", overrides: raw.overrides ?? [] };
    }
    catch {
        return defaults();
    }
}
function writeStore(cwd, store) {
    writeFileSync(path.join(cwd, "depsentinel.overrides.json"), JSON.stringify(store, null, 2) + "\n", "utf8");
}
export function overrideAdd(options) {
    const cwd = options.cwd ?? process.cwd();
    const store = readStore(cwd);
    store.overrides = store.overrides.filter((e) => e.ruleId !== options.ruleId);
    store.overrides.push({
        ruleId: options.ruleId,
        reason: options.reason,
        expires: options.expires,
        createdAt: new Date().toISOString().split("T")[0]
    });
    writeStore(cwd, store);
    return store;
}
export function overrideRemove(ruleId, cwd) {
    const dir = cwd ?? process.cwd();
    const store = readStore(dir);
    store.overrides = store.overrides.filter((e) => e.ruleId !== ruleId);
    writeStore(dir, store);
    return store;
}
export function overrideList(cwd) {
    return readStore(cwd ?? process.cwd());
}
export function isOverridden(ruleId, cwd) {
    const store = readStore(cwd ?? process.cwd());
    const entry = store.overrides.find((e) => e.ruleId === ruleId);
    if (!entry)
        return false;
    const expires = new Date(entry.expires);
    if (expires < new Date())
        return false;
    return true;
}
