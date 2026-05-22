import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
const LOCKFILES = [
    { name: "pnpm-lock.yaml", manager: "pnpm" },
    { name: "package-lock.json", manager: "npm" },
    { name: "yarn.lock", manager: "yarn" },
    { name: "bun.lockb", manager: "bun" }
];
export function detectProjectFacts(rootDir) {
    const packageJsonPath = path.join(rootDir, "package.json");
    let pkg = {};
    try {
        pkg = JSON.parse(existsSync(packageJsonPath) ? readFileSync(packageJsonPath, "utf8") : "{}");
    }
    catch {
        pkg = {};
    }
    const lock = LOCKFILES.find((entry) => existsSync(path.join(rootDir, entry.name))) ?? null;
    const dependencies = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {})
    };
    const framework = detectFrameworkHint(dependencies);
    const isWorkspace = Boolean(pkg.workspaces) || existsSync(path.join(rootDir, "pnpm-workspace.yaml"));
    return {
        rootDir,
        packageManager: lock?.manager ?? "unknown",
        lockfile: lock?.name ?? null,
        isWorkspace,
        framework,
        dependencies
    };
}
function detectFrameworkHint(dependencies) {
    if (dependencies.expo) {
        return "expo";
    }
    if (dependencies.next) {
        return "nextjs";
    }
    if (dependencies.react) {
        return "react";
    }
    if (dependencies.vue) {
        return "vue";
    }
    if (dependencies["@angular/core"]) {
        return "angular";
    }
    if (dependencies.svelte) {
        return "svelte";
    }
    return Object.keys(dependencies).length > 0 ? "node" : "unknown";
}
