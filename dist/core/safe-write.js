import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
function nextBackupPath(filePath) {
    let candidate = `${filePath}.bak`;
    let counter = 1;
    while (existsSync(candidate)) {
        candidate = `${filePath}.bak.${counter}`;
        counter += 1;
    }
    return candidate;
}
export function planSafeFile(filePath, content) {
    if (!existsSync(filePath)) {
        return { path: filePath, content, status: "create" };
    }
    const current = readFileSync(filePath, "utf8");
    if (current === content) {
        return { path: filePath, content, status: "noop" };
    }
    return {
        path: filePath,
        content,
        status: "update",
        backupPath: nextBackupPath(filePath)
    };
}
export function applySafePlan(plan, options = {}) {
    const dryRun = options.dryRun ?? false;
    if (dryRun) {
        return plan;
    }
    for (const file of plan) {
        if (file.status === "noop") {
            continue;
        }
        mkdirSync(path.dirname(file.path), { recursive: true });
        if (file.status === "update" && file.backupPath) {
            copyFileSync(file.path, file.backupPath);
        }
        writeFileSync(file.path, file.content, "utf8");
    }
    return plan;
}
