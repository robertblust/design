// A module under cards/ that is missing from `exports` or from `files` is invisible to a site,
// and the error names the package rather than the file. Both lists are hand-maintained, so
// both get a test rather than a habit.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const dir = new URL("../cards/", import.meta.url);

test("every module under cards/ is published", () => {
  assert.ok(pkg.files.includes("cards"), "`files` must include cards/ or npm packs without it");
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".mjs")) continue;
    const specifier = "./cards/" + path.basename(f, ".mjs");
    assert.equal(pkg.exports[specifier], "./cards/" + f,
      `${f} has no \`exports\` entry, so no site can import it`);
  }
});

// Task 1 wires all four cards/* specifiers into `exports` at once (Step 5) — `exports` is an
// allowlist, so a specifier missing from it is unreachable regardless of when its file lands, and
// waiting to add each one per task would leave that hole open between tasks for no reason. Only
// cards/recipe.mjs exists yet; the other three are entries pointing ahead at modules Tasks 2-4
// create.
//
// PENDING exists to let those three be exempt from "does the file exist" — never from "is the
// path spelled right". `"./cards/check": "./cards/chekc.mjs"` is a real typo a PENDING skip must
// not hide just because its file doesn't exist yet: nothing would ever catch it, not even Task 4
// landing, since a typo?'d target is never the file that task creates. The convention test below
// closes that regardless of PENDING membership; the existence test stays PENDING-aware because a
// forward-looking entry's file genuinely isn't there yet.
const PENDING = new Set(["./cards/check", "./cards/export", "./cards/recipe-tests"]);

test("every cards/ exports entry is spelled ./cards/<name>.mjs, pending or not", () => {
  for (const [specifier, target] of Object.entries(pkg.exports)) {
    if (!specifier.startsWith("./cards/")) continue;
    const name = specifier.slice("./cards/".length);
    assert.equal(target, "./cards/" + name + ".mjs",
      `${specifier} must point at ./cards/${name}.mjs, not ${target}`);
  }
});

test("every non-pending cards/ exports entry names a file that exists", () => {
  for (const [specifier, target] of Object.entries(pkg.exports)) {
    if (!specifier.startsWith("./cards/") || PENDING.has(specifier)) continue;
    assert.ok(fs.existsSync(new URL("../" + target, import.meta.url)),
      `${specifier} points at ${target}, which does not exist`);
  }
});

// PENDING is a claim about the present ("this file isn't built yet"), not a permanent exemption.
// Once a task lands the file, PENDING is stale and nothing but a human remembering to edit this
// line would catch it — exactly the kind of drift `test/cards-packaging.test.mjs` exists to
// replace with an assertion. So the set has to shrink on its own schedule: the moment a listed
// file exists, this fails and says which name to delete.
test("every specifier still in PENDING names a file that does not exist yet", () => {
  for (const specifier of PENDING) {
    const target = pkg.exports[specifier];
    assert.ok(!fs.existsSync(new URL("../" + target, import.meta.url)),
      `${specifier}'s file now exists — delete it from PENDING`);
  }
});
