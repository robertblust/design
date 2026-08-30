// The two checks that guard the stage. They need Playwright and a served site to run, which
// this package has neither of — the site suites exercise them for real. What is asserted here
// is that they exist, that they match the shape the runner calls them with, and that the
// spine assertion — which lived in exactly one of the three repositories — is in the copy
// this package ships.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { STAGE_CHECKS } from "../verify/stage.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("ships exactly the two stage checks", () => {
  assert.deepEqual(Object.keys(STAGE_CHECKS).sort(), ["divider", "graph"]);
});

test("each check takes (page, spec), the shape the runner calls", () => {
  for (const [name, fn] of Object.entries(STAGE_CHECKS)) {
    assert.equal(typeof fn, "function", name);
    assert.equal(fn.length, 2, `${name} should take (page, spec)`);
    assert.equal(fn.constructor.name, "AsyncFunction", `${name} should be async`);
  }
});

test("graph carries the spine assertion — the fix that had not travelled", () => {
  const src = fs.readFileSync(path.join(PKG, "verify/stage.mjs"), "utf8");
  assert.match(src, /getPointAtLength/,
    "the spine assertion is missing: this is companygraph.io's older graph check");
  assert.match(src, /a spine ends inside a node instead of at its edge/);
});

test("neither check hardcodes a site or a base URL", () => {
  const src = fs.readFileSync(path.join(PKG, "verify/stage.mjs"), "utf8");
  assert.ok(!/https:\/\/(blust\.ch|companygraph\.io|guestgraph\.io)/.test(src),
    "a site origin leaked into a shared check");
  assert.ok(!/localhost:8000/.test(src), "a base URL leaked into a shared check");
});
