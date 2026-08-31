// The fence manifest, and the three blocks it names.
//
// These blocks are written verbatim into twenty pages across three repositories, so the tests
// that matter are the ones about their shape: that each carries its own fence lines (the package
// owns the whole block, markers included), that the version in the file agrees with
// versions.json, and that the token block does NOT carry the closing brace — the variant adds it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { FENCES, FENCE_NAMES, blockFor } from "../lib/fences.mjs";
import { findFence } from "../lib/rewrite.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const versions = JSON.parse(fs.readFileSync(path.join(PKG, "versions.json"), "utf8"));

test("names exactly the six fences this release ships", () => {
  assert.deepEqual([...FENCE_NAMES].sort(),
    ["design tokens", "header contract", "language", "prose footer", "prose reset",
     "stage contract"]);
});

test("every block source exists", () => {
  for (const n of FENCE_NAMES)
    assert.ok(fs.existsSync(path.join(PKG, FENCES[n].source)), `${n}: ${FENCES[n].source}`);
});

test("every fence's version matches versions.json", () => {
  for (const n of FENCE_NAMES) assert.equal(FENCES[n].version, versions[FENCES[n].key], n);
});

// A placeholder value for each parameter a fence declares. What the values are does not matter
// to the test below — only that every declared parameter is supplied, so the call succeeds
// regardless of which fences declare params or what they are named.
function paramsFor(spec) {
  return Object.fromEntries((spec.params ?? []).map((name) => [name, `${name}-value`]));
}

test("each block carries its own opening and closing markers", () => {
  const visited = [];
  for (const n of FENCE_NAMES) {
    visited.push(n);
    const text = blockFor(n, FENCES[n].variants ? FENCES[n].variants[0] : null, paramsFor(FENCES[n]));
    const f = findFence(text, n);
    assert.ok(f, `${n}: the emitted block is not a findable fence`);
    assert.equal(f.start, 0, `${n}: the block must start at its own opening marker`);
    assert.equal(f.end, text.split("\n").length - 1, `${n}: the block must end at its own marker`);
  }
  // Guard against the loop silently short-circuiting: every fence must actually have been tried,
  // not just declared.
  assert.deepEqual(visited, [...FENCE_NAMES], "the loop must reach every fence, not stop early");
});

test("every fence emits the version versions.json declares, for every fence", () => {
  // Was asserted for "design tokens" alone while three other fences went unchecked, and the
  // file's own header claimed the version is "stamped from versions.json rather than typed".
  // It is typed — into the first line of each block file — and nothing reconciled the two.
  // Bumping versions.json without editing the block emits the old marker under the new
  // number, which is precisely the "same version, different content" failure the two version
  // numbers exist to prevent, inverted.
  const visited = [];
  for (const n of FENCE_NAMES) {
    visited.push(n);
    const text = blockFor(n, FENCES[n].variants ? FENCES[n].variants[0] : null,
                          paramsFor(FENCES[n]));
    assert.equal(findFence(text, n).version, versions[FENCES[n].key],
                 `${n}: block file says ${findFence(text, n).version}, ` +
                 `versions.json says ${versions[FENCES[n].key]}`);
  }
  assert.deepEqual(visited, [...FENCE_NAMES], "the loop must reach every fence, not stop early");
});

test("the page variant closes the :root brace and the deck variant does not", () => {
  const page = blockFor("design tokens", "page").split("\n");
  const deck = blockFor("design tokens", "deck").split("\n");
  assert.equal(page[page.length - 2].trim(), "}", "the page variant must close :root");
  assert.notEqual(deck[deck.length - 2].trim(), "}", "the deck variant must leave :root open");
  assert.equal(page.length, deck.length + 1, "the two variants differ by exactly one line");
});

test("the stored token block carries no closing brace of its own", () => {
  const raw = fs.readFileSync(path.join(PKG, FENCES["design tokens"].source), "utf8")
    .replace(/\n$/, "").split("\n");
  assert.notEqual(raw[raw.length - 2].trim(), "}",
    "blocks/tokens.css still has the brace — the deck variant would emit it too");
});

test("a block with no variants rejects one, and a block with variants requires one", () => {
  assert.throws(() => blockFor("header contract", "deck"), /variant/);
  assert.throws(() => blockFor("design tokens", null), /variant/);
});

test("blockFor is stable — the same call twice gives the same bytes", () => {
  assert.equal(blockFor("design tokens", "deck"), blockFor("design tokens", "deck"));
});
