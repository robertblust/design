import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { assemble } from "../lib/assemble.mjs";
import { blockFor } from "../lib/fences.mjs";
import { DESIGN_CHECKS } from "../verify/design.mjs";

// A header as the sites write it: a shell around a header around a bar, the brand on the left,
// the nav on the right. Every width in it is fixed, so what the row needs does not depend on
// which fonts the machine running the suite has, and the fractions the second half of this
// file turns on are the fixture's own and not a font's accident. The shell's width is what the
// tests move: it is the room the row has.
function pageHtml({ shell, script = true, rootAttr = "", extraCss = "" }) {
  return `<!doctype html>
<html lang="en"${rootAttr ? ` data-nav="${rootAttr}"` : ""}>
<head><meta charset="utf-8"><style>
${assemble("tokens.css", {})}
${blockFor("header contract", null)}
html, body{margin:0}
.shell{width:${shell}px}
.bar{display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap}
.brand{display:flex; align-items:center; gap:.7rem; flex:none; width:120.2px; white-space:nowrap}
.brand svg{width:28px; height:28px; flex:none}
.navlinks a{flex:none; width:90px; box-sizing:border-box}
#langind{flex:none; width:60px}
${extraCss}
</style></head>
<body>
<div class="shell"><header><div class="bar">
<a class="brand" href="/"><svg viewBox="0 0 28 28"><rect width="28" height="28"/></svg><span>X</span></a>
<nav><span class="navlinks" id="navlinks"><a href="/a/">Alpha</a><a href="/b/">Beta</a><a href="/c/">Gamma</a></span><span id="langind" class="langind"></span></nav>
</div></header></div>
${script ? `<script>${blockFor("nav fit", "page")}</script>` : ""}
</body></html>`;
}

async function withPage(html, body, size = { width: 1400, height: 800 }) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: size });
    await page.setContent(html);
    return await body(page);
  } finally {
    await browser.close();
  }
}

// What the row needs in a state, by the fractional right edge of its last item against the bar's
// left edge: the same quantity nav-fit has to decide on, read here independently of it. It is
// read in a shell too narrow for the row, because in a roomy one the bar spreads its items and
// the last edge is the bar's own.
const need = (page, state) => page.evaluate((s) => {
  const root = document.documentElement, bar = document.querySelector(".bar");
  const prev = root.getAttribute("data-nav"), wrap = bar.style.flexWrap;
  if (s) root.setAttribute("data-nav", s); else root.removeAttribute("data-nav");
  bar.style.flexWrap = "nowrap";
  const left = bar.getBoundingClientRect().left;
  const right = Math.max(...[...bar.querySelectorAll(":scope > *, :scope > nav > *")]
    .filter((el) => el.getClientRects().length).map((el) => el.getBoundingClientRect().right));
  bar.style.flexWrap = wrap;
  if (prev === null) root.removeAttribute("data-nav"); else root.setAttribute("data-nav", prev);
  return right - left;
}, state);

// Layout counts in sixty-fourths of a pixel, and a width the fixture asks for is snapped to
// that grid; asking on the grid keeps what the test says and what the browser holds the same.
const grid = (px) => Math.floor(px * 64) / 64;

const state = (page) => page.evaluate(() => document.documentElement.getAttribute("data-nav"));

test("the header check wants the tight row's spacing on a page nav fit tightened, and the wide row's on one it did not", async () => {
  // The Processes label made the wide row need more than blust.ch's shell: nav-fit tightens it
  // as designed, and the check reported the tight row as broken on every page.
  const probe = await withPage(pageHtml({ shell: 100, script: false }), async (page) =>
    ({ wide: await need(page, null), tight: await need(page, "tight") }));
  assert.ok(probe.tight < probe.wide, "the fixture's tight row is not narrower than its wide one");
  const between = Math.round((probe.wide + probe.tight) / 2);

  const tightened = await withPage(pageHtml({ shell: between }), async (page) => {
    assert.equal(await state(page), "tight", "nav fit did not tighten a row that fits only tightened");
    return await DESIGN_CHECKS.header(page);
  });
  assert.equal(tightened, null, `a tightened row failed the header check: ${tightened}`);

  const roomy = await withPage(pageHtml({ shell: 2000 }), async (page) => {
    assert.equal(await state(page), null, "nav fit tightened a row that fits wide");
    return await DESIGN_CHECKS.header(page);
  });
  assert.equal(roomy, null, `a wide row failed the header check: ${roomy}`);
});

test("the header check still fails a wide row that carries the tight spacing, and a tight row that carries the wide", async () => {
  // The two values are not interchangeable: which one the check wants follows the attribute,
  // so a page that says one thing and draws the other is still caught.
  const tightCss = `nav, .navlinks{gap:1.2rem} nav{letter-spacing:.11em}`;
  const wideDrawnTight = await withPage(
    pageHtml({ shell: 2000, script: false, extraCss: tightCss }), (page) => DESIGN_CHECKS.header(page));
  assert.match(wideDrawnTight, /nav gap is 19\.2px, expected 30\.4px/);
  assert.match(wideDrawnTight, /letter-spacing is 1\.3376px, expected 1\.7024px/);

  const tightDrawnWide = await withPage(
    pageHtml({ shell: 2000, script: false, rootAttr: "tight", extraCss: ":root[data-nav=\"tight\"] nav{gap:1.9rem; letter-spacing:.14em}" }),
    (page) => DESIGN_CHECKS.header(page));
  assert.match(tightDrawnWide, /nav gap is 30\.4px, expected 19\.2px/);
  assert.match(tightDrawnWide, /letter-spacing is 1\.7024px, expected 1\.3376px/);
});

// nav-fit compared two integers, bar.scrollWidth and bar.clientWidth, and a row that needs a
// fraction of a pixel more than the bar has rounded to the same integer as the bar and counted
// as fitting: on guestgraph.io at a 1001px window the bar was 860.875px, the row needed a little
// more, both read 861, and the row wrapped onto two lines.
test("a row that overflows by less than a pixel is tightened, and one tightened that still overflows by less than a pixel collapses", async () => {
  const probe = await withPage(pageHtml({ shell: 100, script: false }), async (page) =>
    ({ wide: await need(page, null), tight: await need(page, "tight") }));

  const run = (room) => withPage(pageHtml({ shell: room }), async (page) => {
    const bar = await page.evaluate(() => document.querySelector(".bar").getBoundingClientRect().width);
    assert.equal(bar, room, "the bar is not the width the fixture gave it");
    return await state(page);
  });

  // Short of the wide row's need by 0.2px, the two read the same integer.
  const justShortWide = grid(probe.wide - 0.2);
  assert.equal(Math.round(justShortWide), Math.round(probe.wide), "the fixture no longer rounds to one integer");
  assert.ok(justShortWide < probe.wide);
  assert.equal(await run(justShortWide), "tight", "a row 0.2px too wide was left to wrap");

  const justShortTight = grid(probe.tight - 0.2);
  assert.equal(Math.round(justShortTight), Math.round(probe.tight), "the fixture no longer rounds to one integer");
  assert.equal(await run(justShortTight), "compact", "a tight row 0.2px too wide was left to wrap");

  // And a row with room to spare, or exactly enough, is left as it is.
  assert.equal(await run(probe.wide), null, "a row that fits exactly was tightened");
  assert.equal(await run(probe.tight), "tight", "a tight row that fits exactly was collapsed");
});
