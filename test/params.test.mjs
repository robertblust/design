// The parameter mechanism, and the difference between a value the package owns and a value the
// site owns.
//
// Every substitution before this one came from the package: `{{variant}}` is chosen from a fixed
// two-member set that blockFor itself holds. `langKey` is the first that comes from the consuming
// site — and it can never be derived. blust.ch stores under "rb-lang"; nothing about the domain
// yields that. More importantly, changing a storage key silently discards every visitor's saved
// language, so it is a constant with a migration cost and belongs where changing it is visible.
import { test } from "node:test";
import assert from "node:assert/strict";

import { FENCES, blockFor } from "../lib/fences.mjs";
import { FAMILY } from "../lib/family.mjs";
import { findFence } from "../lib/rewrite.mjs";

test("the language fence declares langKey as a site-supplied parameter", () => {
  assert.deepEqual(FENCES["language"].params, ["langKey"]);
});

test("no other fence declares a parameter", () => {
  for (const [name, spec] of Object.entries(FENCES))
    if (name !== "language") assert.equal(spec.params, undefined, name);
});

test("blockFor substitutes the site's key", () => {
  const out = blockFor("language", "page", { langKey: "rb-lang" });
  assert.match(out, /var LANG_KEY = "rb-lang";/);
  assert.ok(!out.includes("{{langKey}}"), "the slot was left unfilled");
});

test("a different site gets a different key and nothing else differs", () => {
  const rb = blockFor("language", "page", { langKey: "rb-lang" });
  const gg = blockFor("language", "page", { langKey: "gg-lang" });
  assert.notEqual(rb, gg);
  assert.equal(rb.replace(/rb-lang/, "X"), gg.replace(/gg-lang/, "X"));
});

test("omitting a declared parameter throws, and the message names it", () => {
  assert.throws(() => blockFor("language", "page", {}), /langKey/);
  assert.throws(() => blockFor("language", "page"), /langKey/);
});

test("supplying a parameter a block does not declare throws", () => {
  assert.throws(() => blockFor("design tokens", "page", { langKey: "rb-lang" }),
    /design tokens|langKey/);
});

test("the emitted block is a findable fence with the right variant", () => {
  for (const variant of ["page", "deck"]) {
    const out = blockFor("language", variant, { langKey: "rb-lang" });
    const f = findFence(out, "language");
    assert.ok(f, `${variant}: not a findable fence`);
    assert.equal(f.variant, variant);
    assert.equal(f.start, 0);
    assert.equal(f.end, out.split("\n").length - 1);
  }
});

test("both variants emit the same bytes — the block itself does not vary", () => {
  const p = blockFor("language", "page", { langKey: "rb-lang" });
  const d = blockFor("language", "deck", { langKey: "rb-lang" });
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
  const out = blockFor("language", "page", { langKey: "rb-lang" });
  assert.ok(out.includes(FAMILY.source),
    "the block's inline FAMILY regex has drifted from lib/family.mjs");
});
