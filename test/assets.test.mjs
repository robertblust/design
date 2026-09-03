// The vendored stage must be the repaired one.
//
// blust.ch and companygraph.io drifted by ten lines, and those ten lines are a bug fix that
// never travelled: `markH` — half a mark's HEIGHT, which is not half its width, because a
// folder's box is drawn 4px taller than a page's square. Vendor the wrong copy and this
// package would ship the bug to the repository that had already fixed it.
//
// So this is a guard, not a unit test: it asserts the identity of the bytes, not behavior.
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

test("the prose list declares its own display and list-style", () => {
  // The pages that host the stage carry their own `.card ul` — a `list-style:none` grid. A
  // rule here that named only margin and padding inherited both, so the list drew no bullets
  // and took the page's row gap, and the CSS file looked correct while it did. Two
  // declarations, asserted because their absence is invisible outside a browser.
  const css = asset("assets/stage.css");
  const rule = css.slice(css.indexOf(".cbody ul.prose{"));
  const decls = rule.slice(0, rule.indexOf("}"));
  assert.match(decls, /display:\s*block/, ".cbody ul.prose leaves display to the host page");
  assert.match(decls, /list-style:\s*disc/, ".cbody ul.prose leaves list-style to the host page");
});

test("a `- ` block becomes a list, and the marker is not printed as text", () => {
  // stage.js is browser code with no unit seam, so this is a shape guard like the ones above:
  // it asserts the branch builds a ul and strips the file's marker, not that it renders.
  const js = asset("assets/stage.js");
  const branch = js.slice(js.indexOf('if (/^-\\s/.test(par))'));
  assert.ok(branch.includes('h("ul", null, "prose")'), 'a "- " block no longer builds a ul');
  assert.match(branch.slice(0, branch.indexOf("bodyEl.appendChild(ul)")), /replace\(\/\^-\\s\+\/, ""\)/,
    "the list marker is left in the item text");
});
