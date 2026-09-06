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
  // card.js is browser code with no unit seam, so this is a shape guard like the ones above:
  // it asserts the branch builds a ul and strips the file's marker, not that it renders.
  const js = asset("assets/card.js");
  const branch = js.slice(js.indexOf('if (/^-\\s/.test(par))'));
  assert.ok(branch.includes('h("ul", null, "prose")'), 'a "- " block no longer builds a ul');
  assert.match(branch.slice(0, branch.indexOf("bodyEl.appendChild(ul)")), /replace\(\/\^-\\s\+\/, ""\)/,
    "the list marker is left in the item text");
});

test("card.js is in the stage group and defines rbCard with render, fmtPeriod and fmtDate", () => {
  const dests = GROUPS.stage.map(([, to]) => to);
  assert.ok(dests.includes("card.js"), "card.js is not shipped with the stage");
  const js = asset("assets/card.js");
  assert.match(js, /window\.rbCard\s*=\s*\{/);
  for (const fn of ["render", "fmtPeriod", "fmtDate"])
    assert.match(js, new RegExp(fn + ":\\s*" + fn), `rbCard exposes no ${fn}`);
});

test("stage.js no longer carries the card or the dates — it calls rbCard", () => {
  const js = asset("assets/stage.js");
  assert.ok(!/function fmtPeriod\(/.test(js), "fmtPeriod still lives in stage.js");
  assert.ok(!/function fmtDate\(/.test(js), "fmtDate still lives in stage.js");
  assert.ok(!/function extLink\(/.test(js), "extLink still lives in stage.js");
  assert.match(js, /rbCard\.render\(/);
  assert.match(js, /rbCard\.fmtPeriod\(/);
});

test("stage.css carries the ledger and the pressed expand control", () => {
  const css = asset("assets/stage.css");
  for (const sel of [".ledger{", ".ledger summary{", ".ledger .mark::after{", ".ledger .body .card{", '.expand[aria-pressed="true"]{'])
    assert.ok(css.includes(sel), `stage.css lacks ${sel}`);
});

test("the card's eyebrow is the type alone, source is not drawn and skills are a grouped last section", () => {
  const js = asset("assets/card.js");
  assert.ok(!js.includes('e.type + " · " + e.id'), "the eyebrow still carries the path");
  assert.match(js, /h\("div", e\.type, "eyebrow"\)/);
  assert.match(js, /k !== "source" && k !== "skills"/, "source or skills is still drawn in the field list");
  assert.match(js, /h\("details", null, "grp"\)/, "skills are not grouped");
  assert.equal((js.match(/localeCompare\(y, "en"\)/g) || []).length, 2, "groups and chips are not both sorted");
  const css = asset("assets/stage.css");
  for (const sel of [".cbody .grp > summary{", ".cbody .grp > .chips{", ".cbody .chips a{", ".ledger .cbody h3{"])
    assert.ok(css.includes(sel), `stage.css lacks ${sel}`);
});

test("the ledger's gutter shows the range wide and the start year narrow", () => {
  const css = asset("assets/stage.css");
  assert.ok(css.includes(".ledger .when .start{display:none}"), "the start year is not hidden wide");
  const narrow = css.slice(css.indexOf("@media (max-width:640px){\n    .ledger{--when:4.2rem}"));
  assert.ok(narrow.includes(".ledger .when .range{display:none}"), "the range is not hidden narrow");
  assert.ok(narrow.includes(".ledger .when .start{display:inline}"), "the start year is not shown narrow");
});

test("stage.js opens the expanded stage when the address asks for it, and cleans the address", () => {
  const js = asset("assets/stage.js");
  assert.match(js, /function expand\(\)/);
  assert.match(js, /expandBtn\.addEventListener\("click", expand\)/);
  assert.match(js, /stage=expanded/);
  const branch = js.slice(js.indexOf("stage=expanded"));
  assert.ok(branch.includes("history.replaceState"), "the parameter is not taken out of the address");
  assert.ok(branch.includes("expand();"), "the parameter does not open the stage");
});
