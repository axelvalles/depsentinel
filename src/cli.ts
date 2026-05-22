#!/usr/bin/env node
import { cac } from "cac";
import { runCi } from "./commands/ci.js";
import { runInit } from "./commands/init.js";
import { runScan } from "./commands/scan.js";
import { runDoctor } from "./commands/doctor.js";
import { runInstall } from "./commands/install.js";

export function createCli(): ReturnType<typeof cac> {
  const cli = cac("depsentinel");

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
    .action((options: { preset?: "base" | "expo"; write?: boolean; json?: boolean }) => {
      const result = runInit({
        preset: options.preset,
        dryRun: !Boolean(options.write),
        json: Boolean(options.json)
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

  return cli;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cli = createCli();
  cli.help();
  cli.parse();
}
