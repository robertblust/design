// The sync engine, against throwaway trees rather than against a real site — so these tests
// still mean something after the sites change.
//
// The three states are the whole contract. "missing" is a site that never had the file;
// "differs" is the drift this package exists to end; "same" is the steady state, and it must
// be the state a second run reaches, or `design:check` would fail every time it ran.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { readConfig, planSync, applySync } from "../lib/sync.mjs";
import { GROUPS } from "../lib/groups.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// A throwaway site root, optionally seeded with files.
function site(files = {}, config) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "design-site-"));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  if (config !== undefined)
    fs.writeFileSync(path.join(root, "design.config.json"), JSON.stringify(config, null, 2));
  return root;
}

const read = (root, rel) => fs.readFileSync(path.join(root, rel));
const pkgBody = (from) => fs.readFileSync(path.join(PKG, from));

test("readConfig returns the declared groups", () => {
  const root = site({}, { groups: ["fonts"] });
  assert.deepEqual(readConfig(root), { groups: ["fonts"] });
});

test("readConfig explains a missing config rather than throwing ENOENT", () => {
  const root = site({});
  assert.throws(() => readConfig(root), /design\.config\.json/);
});

test("readConfig rejects a group this package does not ship", () => {
  const root = site({}, { groups: ["fonts", "confetti"] });
  assert.throws(() => readConfig(root), /confetti/);
});

// An empty groups array would make `design sync --check` print "✓ 0 file(s) match" and exit
// 0 — the CI check passing while checking nothing. A truncated or half-edited config should
// not be softer than a deleted one, which already exits 2.
test("readConfig rejects an empty groups array", () => {
  const root = site({}, { groups: [] });
  assert.throws(() => readConfig(root), /design\.config\.json/);
});

test("a site with nothing yet reports every file missing", () => {
  const root = site({}, { groups: ["fonts"] });
  const entries = planSync(root, { groups: ["fonts"] });
  assert.equal(entries.length, GROUPS.fonts.length);
  assert.ok(entries.every((e) => e.state === "missing"), JSON.stringify(entries));
});

test("planSync only plans the groups the site declared", () => {
  const root = site({}, { groups: ["fonts"] });
  const dests = planSync(root, { groups: ["fonts"] }).map((e) => e.to);
  assert.ok(!dests.includes("stage.js"), "took the stage group without asking for it");
});

test("a file whose bytes already match reports same", () => {
  const [from, to] = GROUPS.stage[0];
  const root = site({ [to]: pkgBody(from) }, { groups: ["stage"] });
  const entry = planSync(root, { groups: ["stage"] }).find((e) => e.to === to);
  assert.equal(entry.state, "same");
});

test("a file edited in the site reports differs", () => {
  const [, to] = GROUPS.stage[0];
  const root = site({ [to]: "/* someone edited this locally */" }, { groups: ["stage"] });
  const entry = planSync(root, { groups: ["stage"] }).find((e) => e.to === to);
  assert.equal(entry.state, "differs");
});

test("applySync writes the package's bytes exactly, creating directories", () => {
  const root = site({}, { groups: ["fonts"] });
  const written = applySync(root, planSync(root, { groups: ["fonts"] }));
  assert.equal(written.length, GROUPS.fonts.length);
  for (const [from, to] of GROUPS.fonts)
    assert.deepEqual(read(root, to), pkgBody(from), `${to} does not match the package`);
});

test("applySync overwrites a locally edited file", () => {
  const [from, to] = GROUPS.stage[1];
  const root = site({ [to]: "// local edit" }, { groups: ["stage"] });
  applySync(root, planSync(root, { groups: ["stage"] }));
  assert.deepEqual(read(root, to), pkgBody(from));
});

test("a second run writes nothing and reports every file same", () => {
  const root = site({}, { groups: ["fonts", "stage"] });
  const config = { groups: ["fonts", "stage"] };
  applySync(root, planSync(root, config));
  const second = planSync(root, config);
  assert.ok(second.every((e) => e.state === "same"), JSON.stringify(second));
  assert.deepEqual(applySync(root, second), []);
});

test("planSync sorts by destination, so output order is stable", () => {
  const root = site({}, { groups: ["fonts", "stage"] });
  const dests = planSync(root, { groups: ["fonts", "stage"] }).map((e) => e.to);
  assert.deepEqual(dests, [...dests].sort());
});
