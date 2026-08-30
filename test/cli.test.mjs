// The CLI is what a person actually meets, and it meets them at the moment they are confused
// — a red Dependabot pull request in a repository they were not thinking about. So the exit
// codes and the wording are the contract, and they are tested like one.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

import { GROUPS } from "../lib/groups.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLI = path.join(PKG, "bin", "design.mjs");

function site(files = {}, config) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "design-cli-"));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  if (config !== undefined)
    fs.writeFileSync(path.join(root, "design.config.json"), JSON.stringify(config));
  return root;
}

// Every file under `root`, by relative path, with its size and a hash of its bytes — a
// fingerprint of the whole tree that a mere mtime comparison would miss (a "repair" that
// rewrites a file with the same size and different bytes, or restores an mtime, is invisible
// to statSync alone).
function walkTree(root) {
  const out = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const rel = path.relative(root, full);
        const buf = fs.readFileSync(full);
        out.push({ path: rel, size: buf.length, hash: crypto.createHash("sha256").update(buf).digest("hex") });
      }
    }
  })(root);
  return out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

// execFileSync throws on a non-zero exit; normalise both outcomes into one shape.
function run(args, cwd) {
  try {
    const stdout = execFileSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8" });
    return { code: 0, out: stdout };
  } catch (e) {
    return { code: e.status, out: (e.stdout || "") + (e.stderr || "") };
  }
}

test("sync writes the files and exits 0", () => {
  const root = site({}, { groups: ["fonts"] });
  const r = run(["sync"], root);
  assert.equal(r.code, 0, r.out);
  for (const [, to] of GROUPS.fonts) assert.ok(fs.existsSync(path.join(root, to)), to);
});

test("sync --check on a synced site exits 0 and writes nothing", () => {
  const root = site({}, { groups: ["fonts"] });
  run(["sync"], root);
  const before = GROUPS.fonts.map(([, to]) => fs.statSync(path.join(root, to)).mtimeMs);
  const r = run(["sync", "--check"], root);
  assert.equal(r.code, 0, r.out);
  const after = GROUPS.fonts.map(([, to]) => fs.statSync(path.join(root, to)).mtimeMs);
  assert.deepEqual(after, before);
});

// The previous test only proves --check writes nothing when every file is already "same" —
// there was nothing to write anyway. The states where a buggy implementation would be
// tempted to self-repair are "differs" and "missing", so this tampers into both at once and
// checks the whole tree is untouched, byte for byte. A CI check that can repair itself always
// passes, so it stops being a check — this is the property that keeps `--check` honest.
test("sync --check on differs and missing files exits 1 and repairs nothing", () => {
  const root = site({}, { groups: ["fonts", "stage"] });
  run(["sync"], root);
  const deletedFont = path.join(root, GROUPS.fonts[3][1]);
  fs.writeFileSync(path.join(root, "stage.js"), "// tampered — --check must never overwrite this");
  fs.rmSync(deletedFont);
  const before = walkTree(root);
  const r = run(["sync", "--check"], root);
  assert.equal(r.code, 1, r.out);
  const after = walkTree(root);
  assert.deepEqual(after, before);
  assert.equal(
    fs.readFileSync(path.join(root, "stage.js"), "utf8"),
    "// tampered — --check must never overwrite this");
  assert.ok(!fs.existsSync(deletedFont));
});

test("sync --check exits 1 on a stale file and names it and the remedy", () => {
  const root = site({}, { groups: ["stage"] });
  run(["sync"], root);
  fs.writeFileSync(path.join(root, "stage.js"), "// edited by hand");
  const r = run(["sync", "--check"], root);
  assert.equal(r.code, 1);
  assert.match(r.out, /stage\.js/);
  assert.match(r.out, /npm run design/);
});

test("sync --check exits 1 when a declared file was never synced", () => {
  const root = site({}, { groups: ["fonts"] });
  const r = run(["sync", "--check"], root);
  assert.equal(r.code, 1);
  assert.match(r.out, /missing/i);
});

test("a missing config exits 2 and says which file to create", () => {
  const root = site({});
  const r = run(["sync"], root);
  assert.equal(r.code, 2);
  assert.match(r.out, /design\.config\.json/);
});

test("an unknown subcommand exits 2 and shows usage", () => {
  const root = site({}, { groups: ["fonts"] });
  const r = run(["frobnicate"], root);
  assert.equal(r.code, 2);
  assert.match(r.out, /usage/i);
});

test("--site targets another directory", () => {
  const root = site({}, { groups: ["fonts"] });
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), "design-cwd-"));
  const r = run(["sync", "--site", root], elsewhere);
  assert.equal(r.code, 0, r.out);
  assert.ok(fs.existsSync(path.join(root, GROUPS.fonts[0][1])));
});
