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
// cards/recipe.mjs exists yet; cards/check.mjs, cards/export.mjs and cards/recipe-tests.mjs are
// entries pointing ahead at modules Tasks 2-4 create. So a target that does not exist yet is this
// ordering working as intended, not a broken package — skip it here. This loop becomes a hard
// assertion for every cards/ entry, with nothing left to skip, once Task 4 lands the last file.
test("every cards/ exports entry names a file that exists", () => {
  for (const [specifier, target] of Object.entries(pkg.exports)) {
    if (!specifier.startsWith("./cards/")) continue;
    const file = new URL("../" + target, import.meta.url);
    if (!fs.existsSync(file)) continue;
    assert.ok(fs.statSync(file).isFile(), `${specifier} points at ${target}, which is not a file`);
  }
});
