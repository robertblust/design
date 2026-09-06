// The storage keys are the family's. `lang` and `theme` are what every page on the three
// origins reads and writes, the words the address already carries; the blocks carry them as
// literals, no fence takes a value from the site, and the config names groups and nothing else.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { FENCES, FENCE_NAMES, blockFor } from "../lib/fences.mjs";
import { planFences, applyFences } from "../lib/sync.mjs";
import { FAMILY } from "../lib/family.mjs";
import { findFence } from "../lib/rewrite.mjs";

function site(config, pages = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "design-keys-"));
  fs.writeFileSync(path.join(root, "design.config.json"), JSON.stringify(config));
  for (const [rel, body] of Object.entries(pages)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
}
const wrap = (b) => ["<script>", "  // before", b, "  // after", "</script>"].join("\n");

test("no fence declares a parameter", () => {
  for (const n of FENCE_NAMES) assert.equal(FENCES[n].params, undefined, n);
});

test("the language block carries the family's key and no slot", () => {
  const out = blockFor("language", "page");
  assert.match(out, /var LANG_KEY = "lang";/);
  assert.ok(!out.includes("{{"), "a slot was left unfilled");
});

test("both theme blocks carry the family's key and no slot", () => {
  for (const f of ["theme boot", "theme"]) {
    const out = blockFor(f, "page");
    assert.match(out, /"theme"/, `${f} does not name the key`);
    assert.doesNotMatch(out, /rb-theme|cg-theme|gg-theme|\{\{/, `${f} carries a site's key or a slot`);
  }
});

test("a page carrying the shipped language block reports same with a groups-only config", () => {
  const root = site({ groups: ["fonts"] }, { "index.html": wrap(blockFor("language", "page")) });
  const e = planFences(root).find(x => x.fence === "language");
  assert.equal(e.state, "same");
});

test("a stale block naming a site's old key is rewritten to the family's", () => {
  const stale = blockFor("language", "page").replace(/· v\d+ ·/, "· v0 ·").replace('LANG_KEY = "lang"', 'LANG_KEY = "gg-lang"');
  const root = site({ groups: ["fonts"] }, { "index.html": wrap(stale) });
  applyFences(root, planFences(root));
  const out = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(out, /var LANG_KEY = "lang";/);
  assert.ok(!out.includes("gg-lang"), "the old key survived");
});

test("a second run reports same and writes nothing", () => {
  const stale = blockFor("language", "deck").replace(/· v\d+ ·/, "· v0 ·");
  const root = site({ groups: ["fonts"] }, { "talks/t/index.html": wrap(stale) });
  applyFences(root, planFences(root));
  const second = planFences(root);
  assert.ok(second.every(e => e.state === "same"), JSON.stringify(second));
  assert.deepEqual(applyFences(root, second), []);
});

test("the emitted language block is a findable fence with the right variant", () => {
  for (const variant of ["page", "deck"]) {
    const out = blockFor("language", variant);
    const f = findFence(out, "language");
    assert.ok(f, `${variant}: not a findable fence`);
    assert.equal(f.variant, variant);
    assert.equal(f.start, 0);
    assert.equal(f.end, out.split("\n").length - 1);
  }
});

test("both variants emit the same bytes — the block itself does not vary", () => {
  const p = blockFor("language", "page");
  const d = blockFor("language", "deck");
  assert.equal(p.replace("· page ", "· X "), d.replace("· deck ", "· X "),
    "the two variants differ by more than the variant word");
});

test("FAMILY names exactly the three domains and matches them with and without www", () => {
  for (const h of ["blust.ch", "www.blust.ch", "companygraph.io", "guestgraph.io"])
    assert.ok(FAMILY.test(h), h);
  for (const h of ["example.com", "notblust.ch", "blust.ch.evil.com"])
    assert.ok(!FAMILY.test(h), h);
});

test("the block carries FAMILY's source text, so page and check agree", () => {
  const out = blockFor("language", "page");
  assert.ok(out.includes(FAMILY.source),
    "the block's inline FAMILY regex has drifted from lib/family.mjs");
});
