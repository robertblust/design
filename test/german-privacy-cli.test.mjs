import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PRIVACY_FIXTURE } from "./fixtures/privacy.mjs";

const BIN = new URL("../bin/design.mjs", import.meta.url).pathname;
const run = (...args) => spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8" });

test("design german privacy prints every model string the privacy region translates", () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gp-")), "model.json");
  fs.writeFileSync(f, JSON.stringify(PRIVACY_FIXTURE));
  const r = run("german", "privacy", f);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.ok(out.includes("Answering in the chat"));
  assert.ok(out.includes("The conversation"));
});

test("design german privacy refuses a file that holds no model", () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gp-")), "de.json");
  fs.writeFileSync(f, "[]");
  const r = run("german", "privacy", f);
  assert.equal(r.status, 2);
  assert.match(r.stderr + r.stdout, /holds no model/);
});
