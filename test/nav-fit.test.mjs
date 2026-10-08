import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { assemble } from "../lib/assemble.mjs";
import { blockFor } from "../lib/fences.mjs";
import { DESIGN_CHECKS } from "../verify/design.mjs";

// A header as the sites write it: a shell around a header around a bar, the brand on the left,
// the nav on the right. Every width in it is fixed, so what the row needs does not depend on
// which fonts the machine running the suite has, and the fractions the tests turn on are the
// fixture's own and not a font's accident. The shell's width is what the tests move: it is the
// room the row has. `hidden` adds an item with no box ahead of the brand.
function pageHtml({ shell, script = true, rootAttr = "", extraCss = "", hidden = false }) {
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
${hidden ? `<span class="gone" style="display:none">hidden</span>` : ""}
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

// The shell width a state's row fits in exactly: the fractional right edge of its last item and
// that item's margin, against the bar's left edge, plus the bar's padding and border on the
// right as layout holds them. It is the quantity nav fit has to decide on, read here
// independently of it, and it is read in a shell too narrow for the row, because in a roomy one
// the bar spreads its items and the last edge is the bar's own.
const need = (page, state) => page.evaluate((s) => {
  const root = document.documentElement, bar = document.querySelector(".bar");
  const prev = root.getAttribute("data-nav"), wrap = bar.style.flexWrap;
  if (s) root.setAttribute("data-nav", s); else root.removeAttribute("data-nav");
  bar.style.flexWrap = "nowrap";
  const grid = (px) => Math.floor(px * 64) / 64;
  const style = getComputedStyle(bar);
  const left = bar.getBoundingClientRect().left;
  const right = Math.max(...[...bar.querySelectorAll(":scope > *, :scope > nav > *")]
    .filter((el) => el.getClientRects().length)
    .map((el) => el.getBoundingClientRect().right + grid(parseFloat(getComputedStyle(el).marginRight))));
  bar.style.flexWrap = wrap;
  if (prev === null) root.removeAttribute("data-nav"); else root.setAttribute("data-nav", prev);
  return right - left + grid(parseFloat(style.paddingRight)) + grid(parseFloat(style.borderRightWidth));
}, state);

// Layout counts in sixty-fourths of a pixel, and a width the fixture asks for is snapped to
// that grid; asking on the grid keeps what the test says and what the browser holds the same.
const grid = (px) => Math.floor(px * 64) / 64;

const state = (page) => page.evaluate(() => document.documentElement.getAttribute("data-nav"));

test("the header check wants the tight row's spacing on a page nav fit tightened, and the wide row's on one it did not", async () => {
  // A row nav fit tightens is a row the page is meant to have, so the check wants its values.
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

// The integers nav fit also reads, scrollWidth and clientWidth, round: a row that needs a
// fraction of a pixel more than the bar has can read as fitting and wrap. The row is held to
// its real width instead, so these cases put the room a fraction of a pixel short of what a row
// needs, on a grid of sixty-fourths because that is the grid layout keeps.
const probeOf = (extra) => withPage(pageHtml({ shell: 100, script: false, ...extra }), async (page) =>
  ({ wide: await need(page, null), tight: await need(page, "tight") }));

// The state nav fit settles on, given a shell of that width.
const settle = (room, extra) => withPage(pageHtml({ shell: room, ...extra }), async (page) => {
  const bar = await page.evaluate(() => document.querySelector(".bar").getBoundingClientRect().width);
  assert.equal(bar, room, "the bar is not the width the fixture gave it");
  return await state(page);
});

async function holdsTheRowToItsRealWidth(extra) {
  const probe = await probeOf(extra);
  assert.ok(probe.tight < probe.wide, "the fixture's tight row is not narrower than its wide one");

  // Short of the wide row's need by 0.2px, the two read the same integer.
  const shortWide = grid(probe.wide - 0.2);
  assert.equal(Math.round(shortWide), Math.round(probe.wide), "the fixture no longer rounds to one integer");
  assert.ok(shortWide < probe.wide);
  assert.equal(await settle(shortWide, extra), "tight", "a row 0.2px too wide was left to wrap");

  const shortTight = grid(probe.tight - 0.2);
  assert.equal(Math.round(shortTight), Math.round(probe.tight), "the fixture no longer rounds to one integer");
  assert.equal(await settle(shortTight, extra), "compact", "a tight row 0.2px too wide was left to wrap");

  // And a row with room to spare, or exactly enough, is left as it is.
  assert.equal(await settle(grid(probe.wide + 300), extra), null, "a row with room to spare was tightened");
  assert.equal(await settle(probe.wide, extra), null, "a row that fits exactly was tightened");
  assert.equal(await settle(probe.tight, extra), "tight", "a tight row that fits exactly was collapsed");
}

test("a row that overflows by less than a pixel is tightened, and one tightened that still overflows by less than a pixel collapses", async () => {
  await holdsTheRowToItsRealWidth({});
});

test("a bar with padding is held to its laid-out content edge, and a row that fits it stays wide", async () => {
  // Computed style reports the padding as declared, 9.6px, and layout keeps 9.59375, so a room
  // read from the declared value sits inside the real edge and counts every fitting row as over.
  await holdsTheRowToItsRealWidth({ extraCss: ".bar{padding:0 .6rem} .brand{width:120.4px}" });
});

test("a trailing margin counts toward what the row needs", async () => {
  await holdsTheRowToItsRealWidth({ extraCss: "nav{margin-right:3px}" });
});

test("a nav that draws no box and an item that has none are read through", async () => {
  // `display:contents` hands the nav's items to the bar, and the tight row narrows the bar's
  // own gap then, because a gap on a nav with no box does nothing.
  await holdsTheRowToItsRealWidth({
    hidden: true,
    extraCss: "nav, .navlinks{display:contents} .bar{gap:30px} :root[data-nav=\"tight\"] .bar{gap:10px}",
  });
});
