import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { browserBoundaryViolations } from "../../scripts/lib/browser-boundary";

test("browser imports cannot reach private prompt assembly or server-only modules", () => {
  const violations = browserBoundaryViolations(fileURLToPath(new URL("../", import.meta.url)));
  assert.deepEqual(violations, [], violations.map((chain) => chain.join(" -> ")).join("\n"));
});

test("boundary checks catch lazy imports and barrel exports while preserving types and server actions", () => {
  const root = mkdtempSync(path.join(tmpdir(), "cara-browser-boundary-"));
  try {
    mkdirSync(path.join(root, "lib"));
    writeFileSync(path.join(root, "lib/private.ts"), 'import "server-only"; export type Input = string; export const secret = "fixture";');
    writeFileSync(path.join(root, "lib/barrel.ts"), 'export { secret } from "./private";');
    writeFileSync(path.join(root, "lib/action.ts"), '"use server"; import { secret } from "./private"; export async function save() { return secret; }');
    writeFileSync(path.join(root, "client.ts"), '"use client"; import type { Input } from "@/lib/private"; import { save } from "./lib/action"; export { type Input as Other } from "./lib/private"; export const load = () => import("./lib/barrel");');
    assert.deepEqual(browserBoundaryViolations(root), [["client.ts", "lib/barrel.ts", "lib/private.ts"]]);
    writeFileSync(path.join(root, "client.ts"), '"use client"; import { type Input } from "./lib/private"; import { save } from "./lib/action";');
    assert.deepEqual(browserBoundaryViolations(root), []);
    writeFileSync(path.join(root, "client.ts"), '"use client"; const dependency = require("./lib/private");');
    assert.deepEqual(browserBoundaryViolations(root), [["client.ts", "lib/private.ts"]]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
