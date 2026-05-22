import { describe, expect, it } from "vitest";
import { createCli } from "../src/cli.js";

describe("CLI install command registration", () => {
  it("registers install command in cli", () => {
    const cli = createCli();
    const commands = cli.commands.map((cmd: { name: string }) => cmd.name);
    expect(commands).toContain("install");
  });

  it("install command is registered after existing commands", () => {
    const cli = createCli();
    const commandNames = cli.commands.map((cmd: { name: string }) => cmd.name);
    expect(commandNames).toEqual(["scan", "ci", "init", "install", "doctor", "fix", "override"]);
  });
});
