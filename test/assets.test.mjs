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
  for (const sel of [".ledger{", ".ledger summary{", ".ledger .mark::after, .glyph::after{", ".ledger .body .card{", '.expand[aria-pressed="true"]{'])
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

test("the card's prose is dim and its section headings are headings, not labels", () => {
  const css = asset("assets/stage.css");
  const decls = (sel) => { const r = css.slice(css.indexOf(sel)); return r.slice(0, r.indexOf("}")); };
  assert.match(decls(".cbody p{"), /color:var\(--dim\)/, "the card's paragraphs inherit ink");
  assert.match(decls(".cbody ul.prose{"), /color:var\(--dim\)/, "the card's lists inherit ink");
  assert.ok(css.includes(".cbody p code, .cbody ul.prose code{color:var(--ink)}"), "inline code went dim with the prose");
  const h4 = decls(".cbody h4{");
  assert.doesNotMatch(h4, /text-transform/, ".cbody h4 is still an uppercase label");
  assert.match(h4, /Bricolage Grotesque/, ".cbody h4 is not in the title's face");
  assert.match(h4, /border-top:1px solid var\(--rule\)/, ".cbody h4 has no rule above it");
  assert.ok(css.includes(".ledger .cbody h4{"), "the ledger does not step the heading down");
  assert.match(decls(".cbody td{"), /color:var\(--dim\)/, "a table cell inherits ink");
  assert.ok(css.includes(".cbody td code{color:var(--ink)}"), "a quoted token in a cell went dim");
});

test("the stage carries a history control that acts on the browser's history and nothing else", () => {
  const js = asset("assets/stage.js"), css = asset("assets/stage.css");
  assert.match(js, /hist\.className = "history"/, "stage.js does not build the control");
  assert.match(js, /stageHead\.insertBefore\(hist, expandBtn\)/, "the control is not placed between the path and Expand");
  for (const call of ["history.back()", "history.forward()", "history.go(-pos)"]) assert.ok(js.includes(call), `stage.js lacks ${call}`);
  assert.ok(!/\bfocus\(trailNode|focus\(nodeById\(trail/.test(js), "the control focuses a node itself instead of moving the browser");
  assert.match(js, /aria-disabled/, "a side with nowhere to go is disabled for real, which drops the focus");
  assert.ok(!/hFirst\.disabled|hBack\.disabled|hNext\.disabled/.test(js), "a button uses the disabled attribute");
  assert.match(js, /ev\.key === "ArrowLeft"/, "Left is not bound"); assert.match(js, /ev\.key === "ArrowRight"/, "Right is not bound");
  assert.match(js, /ev\.altKey \|\| ev\.ctrlKey \|\| ev\.metaKey/, "the keys do not yield to a modifier");
  for (const sel of [".stagehead{display:grid; grid-template-columns:1fr auto 1fr", ".history .slab{", ".history .lcd{", ".history .step{", '.history button[aria-disabled="true"]{'])
    assert.ok(css.includes(sel), `stage.css lacks ${sel}`);
});

test("a chip carries the claimed level as marks, and a hover is a note on the thing", () => {
  const js = asset("assets/card.js"), css = asset("assets/stage.css"), stage = asset("assets/stage.js");
  assert.match(js, /function withLevel\(/, "card.js does not decorate a chip with its level");
  assert.match(js, /marks\.setAttribute\("aria-hidden", "true"\)/, "the marks are read out square by square");
  assert.match(js, /a\.setAttribute\("aria-label", name \+ ", " \+ claimed\)/, "the label does not name the level");
  assert.match(js, /tab\.columns\.indexOf\("Level"\)/, "the level is not read off the owner's Level column");
  assert.match(js, /function describe\(el, kind, name, text\)/, "card.js has no tooltip");
  assert.match(js, /el\.removeAttribute\("title"\)/, "a described element keeps a browser title beside the tooltip");
  assert.match(js, /setAttribute\("role", "tooltip"\)/, "the tooltip has no role");
  assert.match(js, /setAttribute\("aria-describedby", "tip"\)/, "the target does not point at the tooltip");
  assert.match(js, /closest\("dialog\[open\]"\)\) \|\| document\.body/, "the tooltip stays under an open dialog's top layer");
  assert.match(js, /describe: describe/, "describe is not exported for the stage");
  assert.ok(!/\.title = /.test(stage), "stage.js still sets a browser title");
  assert.match(stage, /rbCard\.describe\(/, "the transport does not use the tooltip");
  for (const sel of [".cbody .chips .lv{", ".cbody .chips .lv i.on{", ".tip{position:fixed", "background:var(--raise); border:1px solid var(--rule)", ".tip .k{display:none}", ".tip .n{color:var(--ink)"])
    assert.ok(css.includes(sel), `stage.css lacks ${sel}`);
});

test("stage.css carries the kind filter beside Open all", () => {
  const css = asset("assets/stage.css");
  for (const sel of [".stagehead .right{", ".kinds > summary{", ".kinds .menu{", ".kinds .menu input:checked{", ".kinds .menu .all{", ".ledger .none{"])
    assert.ok(css.includes(sel), `stage.css lacks ${sel}`);
  assert.match(css, /\.expand\{[^}]*line-height:1\.5/, "Open all and the filter do not share a line box");
  assert.match(css, /\.stagehead \.right\{grid-column:3;/, "the right-hand group does not name its column, and a page with no transport centers it");
});

test("the ledger's mark is the kind, and the caption carries the same marks", () => {
  const css = asset("assets/stage.css");
  const decls = (sel) => { const r = css.slice(css.indexOf(sel)); return r.slice(0, r.indexOf("}")); };
  for (const sel of [".ledger li.under::before{"])
    assert.ok(css.includes(sel), `stage.css lacks ${sel}`);
  // Every shape is drawn once, for the row's mark and for the caption's glyph in the same
  // rule. A shape changed on one and left on the other is a caption that explains a mark the
  // ledger no longer draws, which is the drift the pairing exists to prevent.
  for (const kind of ["independent", "project", "community", "education"])
    assert.ok(css.includes(`.ledger .k-${kind} .mark::after, .glyph.k-${kind}::after{`),
      `the ${kind} mark and its glyph are not one rule`);
  assert.ok(css.includes(".ledger .k-role .mark::after, .ledger .k-independent .mark::after, .glyph.k-role::after, .glyph.k-independent::after{"),
    "the track's mark and its glyph are not one rule");
  assert.ok(css.includes(".ledger .mark::after, .glyph::after{"), "the plain square and its glyph are not one rule");
  assert.match(decls(".ledger .mark, .glyph{"), /width:1\.25rem; height:1rem/, "the glyph is not the mark's box");
  assert.match(decls("\n  .glyph{"), /display:inline-block; vertical-align:middle/, "the glyph does not sit in a line of prose");
  assert.match(decls(".ledger .k-independent .mark::after, .glyph.k-independent::after{"), /border:2\.5px solid var\(--c-firm\)/, "an independent period is not a hollow square in the track's color");
  assert.match(decls(".ledger .k-project .mark::after, .glyph.k-project::after{"), /rotate\(45deg\)/, "a project is not a diamond");
  assert.match(decls(".ledger .k-community .mark::after, .glyph.k-community::after{"), /border-radius:50%/, "community work is not a circle");
  assert.match(decls(".ledger .k-education .mark::after, .glyph.k-education::after{"), /clip-path:polygon/, "education is not a triangle");
  assert.match(decls(".ledger details[open] > summary .mark::before{"), /border:2px solid var\(--ink\)/, "the open ring is not on the box");
  assert.match(decls(".ledger .k-role .name, .ledger .k-independent .name{"), /font-size:1\.3rem/, "the track's title did not step up");
  assert.match(decls(".ledger .what{"), /2\.2rem/, "the indent did not widen");
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
  assert.ok(branch.includes("modal.focus("), "the dialog does not take the focus on arrival");
  assert.ok(asset("assets/stage.css").includes("dialog.modal:focus, dialog.modal:focus-visible{outline:none}"), "the dialog would draw a ring");
});

test("card.js abbreviates the German months the way WRITING.md does", () => {
  // Jan., Febr., März, Apr., Mai, Juni, Juli, Aug., Sept., Okt., Nov., Dez. — the period
  // where German abbreviates and none where it does not. The English list stays three
  // letters without a period, which is that language's rule.
  const js = asset("assets/card.js");
  const m = /de:\s*\[([^\]]+)\]/.exec(js);
  assert.ok(m, "card.js has no German month list");
  const de = m[1].split(",").map(s => s.trim().replace(/"/g, ""));
  assert.deepEqual(de, ["Jan.", "Febr.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."]);
  const e = /en:\s*\[([^\]]+)\]/.exec(js);
  assert.deepEqual(e[1].split(",").map(s => s.trim().replace(/"/g, "")), ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
});
