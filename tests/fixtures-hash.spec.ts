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

describe("fixtures hash", () => {
  it("is deterministic for milestone 1 fixtures", () => {
    const root = path.resolve("tests/fixtures/m1");
    const files = collectFiles(root);
    const hash = createHash("sha256");

    for (const file of files) {
      hash.update(path.relative(root, file));
      hash.update("\n");
      hash.update(readFileSync(file));
      hash.update("\n");
    }

    expect(hash.digest("hex")).toMatchInlineSnapshot(
      `"85e5cf966696e4f8fed16f190cbe9ff3502a8d8fc699f48f16ba7e45a5670f6e"`
    );
  });
});
