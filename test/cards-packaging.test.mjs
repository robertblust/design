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
// create. Naming them here, rather than skipping whatever the filesystem doesn't have, keeps this
// a real assertion for every entry that is NOT supposed to be forward-looking: an `existsSync`
// skip is the negation of the assertion it guards and can never fail, for a typo or for anything
// else. Delete a name from this set when its task lands; the loop then holds it to the same
// standard as recipe.mjs. Empty set = every cards/ entry is checked, unconditionally.
const PENDING = new Set(["./cards/check", "./cards/export", "./cards/recipe-tests"]);

test("every cards/ exports entry names a file that exists", () => {
  for (const [specifier, target] of Object.entries(pkg.exports)) {
    if (!specifier.startsWith("./cards/") || PENDING.has(specifier)) continue;
    assert.ok(fs.existsSync(new URL("../" + target, import.meta.url)),
      `${specifier} points at ${target}, which does not exist`);
  }
});
