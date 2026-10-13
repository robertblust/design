// A module under decks/ that is missing from `exports` or from `files` is invisible to a site,
// and the error names the package rather than the file. Both lists are kept by hand, so both
// get a test, as test/cards-packaging.test.mjs gives the cards.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("every module under decks/ is published", () => {
  assert.ok(pkg.files.includes("decks"), "`files` must include decks/ or npm packs without it");
  for (const f of fs.readdirSync(new URL("../decks/", import.meta.url))) {
    if (!f.endsWith(".mjs")) continue;
    assert.equal(pkg.exports["./decks/" + path.basename(f, ".mjs")], "./decks/" + f,
      `${f} has no \`exports\` entry, so no site can import it`);
  }
});
