import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  return result.status ?? 1;
}

if (existsSync("package-lock.json")) {
  process.exit(run("lockfile-lint", ["--path", "package-lock.json", "--type", "npm", "--allowed-hosts", "npm", "--validate-https"]));
}

if (existsSync("yarn.lock")) {
  process.exit(run("lockfile-lint", ["--path", "yarn.lock", "--type", "yarn", "--allowed-hosts", "npm", "--validate-https"]));
}

console.log("lockfile-lint skipped: only npm/yarn lockfiles are supported by lockfile-lint.");
process.exit(0);
