#!/usr/bin/env node
import { cac } from "cac";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { runCi } from "./commands/ci.js";
import { runDoctor } from "./commands/doctor.js";
import { runFix }    from "./commands/fix.js";
import { runInit }   from "./commands/init.js";
import { runInstall } from "./commands/install.js";
import { runScan } from "./commands/scan.js";
import { runTrust } from "./commands/trust.js";
import { overrideAdd, overrideList, overrideRemove } from "./core/overrides.js";

export function createCli(): ReturnType<typeof cac> {
  const cli = cac("depsentinel");

  async function askYesNo(question: string, defaultYes: boolean): Promise<boolean> {
    if (!process.stdin.isTTY || !process.stdout.isTTY) return defaultYes;
    const rl = createInterface({ input, output });
    const suffix = defaultYes ? "[Y/n]" : "[y/N]";
    const answer = (await rl.question(`${question} ${suffix} `)).trim().toLowerCase();
    rl.close();
    if (answer === "") return defaultYes;
    return answer === "y" || answer === "yes" || answer === "s" || answer === "si";
  }

  cli
    .command("scan", "Run dependency risk scan")
    .option("--json", "Emit machine-readable JSON")
    .action((options: { json?: boolean }) => {
      const result = runScan({ json: Boolean(options.json) });
      process.stdout.write(`${result.output}\n`);
      const hasCritical = result.envelope.result.findings.some((finding) => finding.severity === "critical");
      if (hasCritical) {
        process.exitCode = 1;
      }
    });

  cli
    .command("ci", "Run CI policy gate")
    .option("--json", "Emit machine-readable JSON")
    .action((options: { json?: boolean }) => {
      const result = runCi({ json: Boolean(options.json) });
      process.stdout.write(`${result.output}\n`);
      if (result.shouldFail) {
        process.exitCode = 1;
      }
    });

  cli
    .command("init", "Initialize depsentinel policy artifacts")
    .option("--preset <preset>", "Preset to initialize (base|expo)")
    .option("--write", "Apply changes (default is dry-run)")
    .option("--json", "Emit machine-readable JSON")
    .action(async (options: { preset?: "base" | "expo"; write?: boolean; json?: boolean }) => {
      const context = options.json
        ? {
            publishesToNpm: true,
            publishFromCi: true,
            usesOidcTrustedPublisher: false
          }
        : {
            publishesToNpm: await askYesNo("Does this project publish packages to npm?", false),
            publishFromCi: await askYesNo("Does this project publish from CI?", true),
            usesOidcTrustedPublisher: await askYesNo("Does npm publish use OIDC Trusted Publisher?", false)
          };
      const result = runInit({
        preset: options.preset,
        dryRun: !Boolean(options.write),
        json: Boolean(options.json),
        context
      });
      process.stdout.write(`${result.output}\n`);
    });

  cli
    .command("install <package>", "Evaluate and execute safe dependency install")
    .option("--force", "Override block/warn decision")
    .option("--json", "Emit machine-readable JSON")
    .action((pkg: string, options: { force?: boolean; json?: boolean }) => {
      const result = runInstall({
        packageName: pkg,
        force: Boolean(options.force),
        json: Boolean(options.json)
      });
      process.stdout.write(`${result.output}\n`);
      process.exitCode = result.exitCode;
    });

  cli
    .command("doctor", "Diagnose project against 26 security best practices")
    .option("--json", "Emit machine-readable JSON")
    .action((options: { json?: boolean }) => {
      const result = runDoctor({ json: Boolean(options.json) });
      process.stdout.write(`${result.output}\n`);
      if (result.envelope.result.failed > 0) {
        process.exitCode = 1;
      }
    });

  cli
    .command("fix", "Apply known remediations for detected gaps (dry-run by default)")
    .option("--write", "Apply changes")
    .option("--json", "Emit machine-readable JSON")
    .action((options: { write?: boolean; json?: boolean }) => {
      const result = runFix({ dryRun: !options.write, json: Boolean(options.json) });
      process.stdout.write(`${result.output}\n`);
    });

  cli
    .command("trust <action> [package]", "Manage package-manager trust lists")
    .option("--mode <mode>", "Mode: allow-build | ignore-build")
    .option("--pm <pm>", "Package manager override")
    .option("--write", "Apply changes (default is dry-run)")
    .option("--json", "Emit machine-readable JSON")
    .action((
      action: "add" | "remove" | "list",
      packageName: string | undefined,
      options: {
        mode?: "allow-build" | "ignore-build";
        pm?: "npm" | "pnpm" | "yarn" | "bun" | "unknown";
        write?: boolean;
        json?: boolean;
      }
    ) => {
      const result = runTrust({
        action,
        packageName,
        mode: options.mode,
        manager: options.pm,
        dryRun: !Boolean(options.write),
        json: Boolean(options.json)
      });
      process.stdout.write(`${result.output}\n`);
      process.exitCode = result.exitCode;
    });

  cli
    .command("override <action> [ruleId]", "Manage policy overrides (add | remove | list)")
    .option("--reason <reason>", "Reason for the override")
    .option("--expires <date>", "Expiration date (YYYY-MM-DD)")
    .action((action: string, ruleId: string | undefined, options: { reason?: string; expires?: string }) => {
      if (action === "list") {
        const store = overrideList();
        process.stdout.write(JSON.stringify(store, null, 2) + "\n");
        return;
      }
      if (!ruleId) {
        process.stderr.write("ruleId is required for add/remove\n");
        process.exitCode = 1;
        return;
      }
      if (action === "remove") {
        const store = overrideRemove(ruleId);
        process.stdout.write(JSON.stringify(store, null, 2) + "\n");
        return;
      }
      if (action === "add") {
        if (!options.reason || !options.expires) {
          process.stderr.write("--reason and --expires are required for add\n");
          process.exitCode = 1;
          return;
        }
        const store = overrideAdd({ ruleId, reason: options.reason, expires: options.expires });
        process.stdout.write(JSON.stringify(store, null, 2) + "\n");
        return;
      }
      process.stderr.write(`Unknown action: ${action}\n`);
      process.exitCode = 1;
    });

  return cli;
}

const cli = createCli();
cli.help();
cli.parse();
