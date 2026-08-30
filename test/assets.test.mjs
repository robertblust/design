// The vendored stage must be the repaired one.
//
// blust.ch and companygraph.io drifted by ten lines, and those ten lines are a bug fix that
// never travelled: `markH` — half a mark's HEIGHT, which is not half its width, because a
// folder's box is drawn 4px taller than a page's square. Vendor the wrong copy and this
// package would ship the bug to the repository that had already fixed it.
//
// So this is a guard, not a unit test: it asserts the identity of the bytes, not behaviour.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { GROUPS, GROUP_NAMES } from "../lib/groups.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const asset = (rel) => fs.readFileSync(path.join(PKG, rel), "utf8");

test("stage.js carries markH — it is the repaired copy", () => {
  const js = asset("assets/stage.js");
  assert.match(js, /function markH\(/,
    "vendored stage.js has no markH: this is companygraph.io's buggy copy");
});

test("stage.js terminates spines at markH, never at a flat R_NODE", () => {
  const js = asset("assets/stage.js");
  const shape = js.slice(js.indexOf("function shape("));
  assert.ok(shape.includes("a.y + markH(a)"), "the spine's start still uses a flat half-width");
  assert.ok(!/a\.y \+ R_NODE/.test(shape), "a spine end still computes from R_NODE");
});

test("stage.js reads its data from a data-stage element, so it stays generic", () => {
  assert.match(asset("assets/stage.js"), /data-stage/);
});

test("every asset is non-empty", () => {
  for (const name of GROUP_NAMES)
    for (const [from] of GROUPS[name]) {
      const size = fs.statSync(path.join(PKG, from)).size;
      assert.ok(size > 0, `${from} is empty`);
    }
});

test("the vendored d3 is the pinned 7.9.0 build", () => {
  assert.match(asset("assets/d3.v7.min.js"), /\/\/ https:\/\/d3js\.org v7\.9\.0/);
});
