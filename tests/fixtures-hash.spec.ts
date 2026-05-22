import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function collectFiles(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((entry) => {
      const absolute = path.join(dir, entry);
      const info = statSync(absolute);
      return info.isDirectory() ? collectFiles(absolute) : [absolute];
    })
    .sort();
}

function normalizeForStableHash(root: string, file: string): { relativePath: string; content: string } {
  const relativePath = path.relative(root, file).replace(/\\/g, "/");
  const content = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  return { relativePath, content };
}

describe("fixtures hash", () => {
  it("is deterministic for milestone 1 fixtures", () => {
    const root = path.resolve("tests/fixtures/m1");
    const files = collectFiles(root);
    const hash = createHash("sha256");

    for (const file of files) {
      const normalized = normalizeForStableHash(root, file);
      hash.update(normalized.relativePath);
      hash.update("\n");
      hash.update(normalized.content);
      hash.update("\n");
    }

    expect(hash.digest("hex")).toMatchInlineSnapshot(
      `"a760d2106ea283e20c790e7d6d366ed1bf399ec4e78d25358b28539a0604b0ea"`
    );
  });
});
