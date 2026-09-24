import fs from "node:fs";
import os from "node:os";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { pageChecks, bannedForms, expectedGerman } from "../verify/pages.mjs";
import { assemble } from "../lib/assemble.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OPTS = { SITE: "https://example.test", BASE: "http://127.0.0.1:8000" };

// What a member's vendored conventions/GERMAN.md carries in its refused-forms fence.
const GERMAN_STUB = "# German\n\n```banned\nReservierung → Reservation\nOffener Kern → Open Core\n```\n";

// The twenty-six this module is responsible for. A body that quietly stops being exported
// takes its coverage from three suites at once, and every one of them still reports "all
// checks pass" — nothing else in the system would notice.
const EXPECTED = ["carriesLang", "card", "contains", "contrast", "footer", "headerBaseline",
  "headerFits", "internalLinks", "landing", "lang", "links", "mobileNav", "navOrder", "noFlash", "noNewTab",
  "readoutInvariant", "sameOrigin", "sameTab", "seo", "sourceLang", "storageKeys", "title",
  "translates", "transportBaseline", "transportFits", "typography", "wayOut"];

test("every shared check is present and callable", () => {
  const checks = pageChecks(OPTS);
  assert.deepEqual(Object.keys(checks).sort(), [...EXPECTED].sort());
  for (const n of EXPECTED) assert.equal(typeof checks[n], "function", `${n} is not callable`);
});

test("the factory refuses to build without the two values its bodies close over", () => {
  // Called with nothing, seo and card would compare against `undefined` and pass everything.
  assert.throws(() => pageChecks({}), /SITE/);
  assert.throws(() => pageChecks({ SITE: "https://example.test" }), /BASE/);
});

test("title holds the reconciled 65-character limit", () => {
  // Ruling 1. The number is the decision; if someone relaxes it back to 70 this says so.
  //
  // Comments stripped before matching, as in the card test below: a comment mentioning
  // "length > 65" in prose would satisfy this even if the code said 70.
  const src = pageChecks(OPTS).title.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /length > 65/);
});

test("internalLinks inspects [src] and CSS url(), not only a[href]", () => {
  // The drift named at the top of the spec: the weaker version let a root-absolute [src]
  // through, which breaks under file://.
  //
  // Comments stripped before matching, as in the card test below: prose mentioning these
  // same tokens would otherwise satisfy the assertion even if the code did not.
  const src = pageChecks(OPTS).internalLinks.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /\[href\], \[src\]/);
  assert.match(src, /styleSheets/);
  assert.match(src, /url\\\(/);
});

test("card rewrites onto BASE, never onto location.origin", () => {
  // An origin carries no path. The weaker version dropped a /talks prefix and called a good
  // card unfetchable.
  //
  // Comments stripped before matching: the moved body's own explanatory comment names
  // "location.origin" in prose (to say the code does NOT use it), which would otherwise
  // trip this exact assertion on the correct, verbatim code. Stripped, this checks what it
  // is meant to — an actual code reference, not a word in an explanation of its absence.
  const src = pageChecks(OPTS).card.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /testBase/);
  assert.doesNotMatch(src, /location\.origin/);
});

test("sameOrigin listens for real network requests, not the markup", () => {
  // The point of this check is that it watches actual traffic; a body that only inspected
  // markup would be indistinguishable from links/internalLinks, which is exactly the gap it
  // exists to close.
  const src = pageChecks(OPTS).sameOrigin.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /page\.on\("request"/);
});

test("lang reads documentElement.lang after applyLang has run", () => {
  // sourceLang below is the same shape asserting the opposite: this one reads the DOM live,
  // which is the half of the pair that would go unnoticed if it silently started reading the
  // static source instead.
  const src = pageChecks(OPTS).lang.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /documentElement\.lang/);
});

test("translates presses DE, reads the German, and returns through EN", () => {
  // The rendered DOM is only ever one language, so this is the single check that sees the
  // German half of a page. Three things it must keep doing, each of which once regressed on
  // the site it came from: press the DE segment rather than the box around both (`#lde`,
  // not `#langind`); read `innerText`, so uppercase nav labels match as a visitor reads them;
  // and go back through a *different* control (`#len`), because pressing DE twice is a no-op
  // on a segmented control and "restored" would be asserted against a page that never moved.
  const src = pageChecks(OPTS).translates.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /spec\.translates\.id \|\| "lde"/);
  assert.match(src, /spec\.translates\.backId \|\| "len"/);
  assert.match(src, /document\.body\.innerText/);
  assert.match(src, /documentElement\.lang/);
  // It is the last key: the only check that changes what the others read.
  assert.equal(Object.keys(pageChecks(OPTS)).at(-1), "translates");
});

test("sourceLang is fetched cold, never through the live page", () => {
  // The reconciled bug: a crawler running no JS saw the pre-toggle language. Reading through
  // `page.evaluate` instead of `fetch` would reintroduce exactly that gap while still calling
  // itself sourceLang.
  const src = pageChecks(OPTS).sourceLang.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /fetch\(spec\.absolute\)/);
});

test("contains walks every string in spec.contains, not just the first", () => {
  // A body that only tested spec.contains[0] would still pass any spec asserting one string,
  // which is most of them — the loop is what makes this check scale to a page's real claims.
  const src = pageChecks(OPTS).contains.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /for \(const s of spec\.contains\)/);
});

test("links matches only true absolute http(s) hrefs", () => {
  // Per its own comment, presence is the one thing no other check does; the selector is what
  // decides which hrefs are even candidates for that presence test.
  const src = pageChecks(OPTS).links.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /a\[href\^='http'\]/);
});

test("headerBaseline measures a text range, not an element box", () => {
  // The header bug this replaced was exactly a box that centered while the text inside it did
  // not; measuring getBoundingClientRect() of the element instead of a Range over its text
  // node would silently bring that bug back.
  const src = pageChecks(OPTS).headerBaseline.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /createRange/);
});

test("carriesLang decorates on mousedown, not click", () => {
  // Documented as deliberate: mousedown fires before navigation, so the href can be rewritten
  // without the page already having left. click fires too late to matter here.
  const src = pageChecks(OPTS).carriesLang.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /"mousedown"/);
});

// carriesLang against a real, served page carrying the real assembled page.js — the only way
// to reach the bug task one found: a visitor arrives, switches language, and only then follows
// a family link. Every other test of this check here works from its source text, because the
// check itself is a Playwright script; this one actually drives it, the way a site's own CI
// does, against a minimal fixture rebuilt fresh from lib/assemble.mjs and blocks/lang.js on
// every run — so it is red while the file form still carries the stale-copy bug and green once
// it is fixed, never a frozen snapshot that could quietly stop testing the thing it names.
//
// The fixture stands in for a real page's own hand-written half of the hook contract: it reads
// ?lang= and localStorage itself (page.js's own `language` part no longer does this for a
// fenced page's script to share — see hooks.test.mjs), exposes `window.rbPage`, and wires
// #lde/#len exactly as a real page must. `.bar` is there because `nav fit`, also part of
// page.js, throws without one.
function carriesLangFixtureHtml() {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body>
<div class="bar"></div>
<button id="lde">DE</button>
<button id="len">EN</button>
<a href="https://companygraph.io/">sibling</a>
<script>
(function () {
  var m = /[?&]lang=(de|en)(&|$)/.exec(location.search);
  var fromUrl = null;
  if (m) {
    fromUrl = m[1];
    try {
      var q = location.search.replace(/([?&])lang=(de|en)(&|$)/, "$1").replace(/[?&]$/, "");
      history.replaceState(null, "", location.pathname + q + location.hash);
    } catch (e) {}
  }
  var stored = null;
  try { stored = localStorage.getItem("lang"); } catch (e) {}
  var lang = fromUrl || stored || "en";
  function applyLang(v) {
    lang = v;
    document.documentElement.lang = v;
    try { localStorage.setItem("lang", v); } catch (e) {}
  }
  document.documentElement.lang = lang;
  window.rbPage = { lang: lang, applyLang: applyLang };
  document.getElementById("lde").addEventListener("click", function () { applyLang("de"); });
  document.getElementById("len").addEventListener("click", function () { applyLang("en"); });
})();
</script>
<script src="page.js"></script>
</body>
</html>`;
}

// A GitHub-Pages-shaped static server, the same shape test/links-site.test.mjs already serves
// its own fixture from, kept local here rather than imported so this file's suite does not
// depend on that one's internal helper staying exported the same way.
function serveDir(dir) {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(dir, p);
    try {
      if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    } catch (e) { /* not a directory; read below and 404 if it is not a file either */ }
    let body;
    try { body = fs.readFileSync(file); } catch (e) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "content-type": file.endsWith(".js") ? "text/javascript" : "text/html; charset=utf-8" });
    res.end(body);
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
  })));
}

// A deliberate, minimal reproduction of the pre-fix shape — the closure-captured `lang` that
// assemble()'s IIFE gave blocks/lang.js before the fix, hand-written here rather than read from
// the package so this regression stays provable even once blocks/lang.js itself is correct and
// there is no longer a live buggy copy to point the check at.
function buggyCarriesLangFixtureHtml() {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"></head>
<body>
<button id="lde">DE</button>
<button id="len">EN</button>
<a href="https://companygraph.io/">sibling</a>
<script>
// The page's own closure: reads ?lang=, exposes the hook, and owns the actual switching —
// exactly the shape README's "hook object" section describes.
(function () {
  var m = /[?&]lang=(de|en)(&|$)/.exec(location.search);
  var fromUrl = m ? m[1] : null;
  if (m) {
    try {
      var q = location.search.replace(/([?&])lang=(de|en)(&|$)/, "$1").replace(/[?&]$/, "");
      history.replaceState(null, "", location.pathname + q + location.hash);
    } catch (e) {}
  }
  var lang = fromUrl || "en";
  function applyLang(v) { lang = v; document.documentElement.lang = v; }
  document.documentElement.lang = lang;
  window.rbPage = { lang: lang, applyLang: applyLang };
  document.getElementById("lde").addEventListener("click", function () { applyLang("de"); });
  document.getElementById("len").addEventListener("click", function () { applyLang("en"); });
})();
</script>
<script>
// "The file": a separate closure — the pre-fix shape of blocks/lang.js, reproduced directly
// rather than read from the package, so this regression stays provable once blocks/lang.js
// itself is correct and there is no longer a live buggy copy to point the check at. It reads
// window.rbPage.lang once, into its own private var, and never again — the bug.
(function () {
  var lang = (window.rbPage && typeof window.rbPage.lang !== "undefined") ? window.rbPage.lang : "en";
  function carryLang(e) {
    var a = e.target && e.target.closest && e.target.closest("a[href]");
    if (!a) return;
    var u; try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.origin === location.origin) return;
    u.searchParams.set("lang", lang);
    a.href = u.toString();
  }
  document.addEventListener("mousedown", carryLang, true);
  document.addEventListener("click", carryLang, true);
})();
</script>
</body>
</html>`;
}

test("carriesLang fails a page whose language carry still reads the copy it captured at load, after a visitor's own toggle", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "carries-lang-buggy-"));
  let served, browser;
  try {
    fs.writeFileSync(path.join(dir, "index.html"), buggyCarriesLangFixtureHtml());
    served = await serveDir(dir);
    browser = await chromium.launch();
    const page = await browser.newPage();
    const result = await pageChecks({ SITE: served.base, BASE: served.base })
      .carriesLang(page, { absolute: served.base + "/" });
    assert.equal(typeof result, "string",
      `expected the check to catch a link still carrying the language captured at load after a toggle, got ${JSON.stringify(result)}`);
    assert.match(result, /English/);
  } finally {
    if (browser) await browser.close();
    if (served) await served.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("carriesLang follows a visitor's own toggle before pressing a family link, not only the language the page arrived with", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "carries-lang-"));
  let served, browser;
  try {
    fs.writeFileSync(path.join(dir, "index.html"), carriesLangFixtureHtml());
    fs.writeFileSync(path.join(dir, "page.js"), assemble("page.js", {}));
    served = await serveDir(dir);
    browser = await chromium.launch();
    const page = await browser.newPage();
    const result = await pageChecks({ SITE: served.base, BASE: served.base })
      .carriesLang(page, { absolute: served.base + "/" });
    assert.equal(result, null,
      `expected the fixed block to pass once the check also follows a visitor's own toggle, got ${JSON.stringify(result)}`);
  } finally {
    if (browser) await browser.close();
    if (served) await served.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("mobileNav is measured at the 360px breakpoint", () => {
  // The width picked is narrower than the phones in the analytics; asserting it pins the
  // breakpoint the rest of the check's findings are only meaningful at.
  const src = pageChecks(OPTS).mobileNav.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /width: 360/);
});

// mobileNav's own evaluate callbacks are self-contained closures over document/getComputedStyle,
// so — as with contrast's fake page above — a fake page can hand back canned shut/open/closed
// states per call rather than mocking the check itself. Three evaluate calls happen when
// `shut.burger` is true: the 360px shut state, the opened state after clicking #burger, and the
// closed state after Escape.
function makeMobileNavPage(shutOverrides = {}, openOverrides = {}) {
  let evalCalls = 0;
  return {
    async setViewportSize() {},
    async goto() {},
    async evaluate() {
      evalCalls += 1;
      if (evalCalls === 1)
        return {
          brand: 40, mark: 40, wide: false, links: false, burger: true, seg: true,
          // Header contract v6: off the bar with the menu shut, back when it opens, and the
          // language control in the same place either way.
          theme: false, langTop: 20,
          ...shutOverrides,
        };
      if (evalCalls === 2)
        return { links: true, flag: "true", theme: true, langTop: 20, collides: false, ...openOverrides };
      return true;
    },
    async click() {},
    keyboard: { press: async () => {} },
  };
}

test("mobileNav fails when a page declaring noFlash never brings the theme control back", async () => {
  // The defect this closes: `.seg.theme` deleted from a prose page used to pass every check,
  // because storageKeys clicked it present-or-skip, navOrder only cares that #langind is last,
  // and design:check cannot see site-owned markup. `noFlash` is the page's own declaration
  // that it carries the fence and therefore the two controls. Under v6 the control is off the
  // bar, so "lost it" now means the menu does not bring it back — a page with no way at all to
  // change appearance on a phone.
  const page = makeMobileNavPage({ theme: false }, { theme: false });
  const result = await pageChecks(OPTS).mobileNav(page, { absolute: "https://example.test/", noFlash: "rb-theme" });
  assert.match(result, /did not bring the theme control back/);
});

test("mobileNav fails when the theme control is back on the bar", async () => {
  // v5's shape, which v6 replaces. It has to fail rather than merely stop being required:
  // three items and two gaps do not fit 360px, so a theme control on the bar is a header that
  // wraps to two rows and costs 61px above the fold on every phone page.
  const page = makeMobileNavPage({ theme: true });
  const result = await pageChecks(OPTS).mobileNav(page, { absolute: "https://example.test/", noFlash: "rb-theme" });
  assert.match(result, /still on the bar at 360px/);
});

test("mobileNav fails when opening the menu moves the language control", async () => {
  // The first attempt at v6 put the theme control back in flow, which pushed the language
  // control onto a second row the moment the menu opened. Nothing here would have caught it:
  // the control was present, the menu opened, and every other assertion held.
  const page = makeMobileNavPage({ langTop: 20 }, { langTop: 63 });
  const result = await pageChecks(OPTS).mobileNav(page, { absolute: "https://example.test/", noFlash: "rb-theme" });
  assert.match(result, /moved the language control 43px/);
});

test("mobileNav fails when the theme control overlaps the first menu link", async () => {
  // Contract v7 positions the control into the panel's top-right corner while the first link
  // sits at its top-left. Neither knows the other is there, and how close they come depends on
  // how long that page's first link is — site-owned markup the fence cannot see. blust.ch's
  // narrowest clearance is 134px at 320px wide; a site with a longer first word has less.
  const page = makeMobileNavPage({}, { collides: true });
  const result = await pageChecks(OPTS).mobileNav(page, { absolute: "https://example.test/", noFlash: "rb-theme" });
  assert.match(result, /overlaps the first menu link/);
});

test("mobileNav passes on the v7 shape, and invents no requirement for a page with no noFlash flag", async () => {
  const v6 = await pageChecks(OPTS).mobileNav(
    makeMobileNavPage(), { absolute: "https://example.test/", noFlash: "rb-theme" });
  assert.equal(v6, null, `expected a pass, got ${JSON.stringify(v6)}`);

  // A deck carries neither the noFlash flag nor the theme control — the check must not
  // demand a control the page never claimed to have, in either state.
  const noFlag = await pageChecks(OPTS).mobileNav(
    makeMobileNavPage({ theme: false }, { theme: false }), { absolute: "https://example.test/" });
  assert.equal(noFlag, null, `expected a pass, got ${JSON.stringify(noFlag)}`);
});

test("storageKeys fails on zero writes, not only on an undeclared key", () => {
  // The half of the check that used to be unreachable from outside: a trigger the check failed
  // to find and a page that truly writes nothing looked identical without this branch.
  const src = pageChecks(OPTS).storageKeys.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /no write path was exercised/);
});

test("navOrder requires the language switcher to be the last child", () => {
  // The order list alone would pass a switcher buried mid-row; this is the assertion that
  // pins it to the row's right-hand edge, which is the actual rule being enforced.
  const src = pageChecks(OPTS).navOrder.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /sw !== kids\.length - 1/);
});

test("noNewTab also inspects data-de markup a visitor has not rendered yet", () => {
  // The bug this caught lived in translated markup the live DOM never shows in English mode;
  // dropping this half silently narrows the check back to the language the crawler happens
  // to be looking at.
  const src = pageChecks(OPTS).noNewTab.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /\[data-de\]/);
});

test("sameTab only checks the hrefs spec.sameTab names", () => {
  // What separates this from noNewTab: it does not sweep the whole page, it holds a named
  // set of links to the rule. Losing spec.sameTab turns it into a duplicate of noNewTab or a
  // no-op, not the targeted check it is.
  const src = pageChecks(OPTS).sameTab.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /spec\.sameTab/);
});

test("wayOut requires the way back to live in the transport chrome", () => {
  // A same-tab deck with a way-back link anywhere on the page is not the same guarantee as
  // one in #chrome; inChrome is the distinction the check's own comment calls out.
  const src = pageChecks(OPTS).wayOut.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /inChrome/);
});

test("transportFits does not fall back to mobileNav's scrollWidth overflow test", () => {
  // body{overflow:hidden} on every deck keeps scrollWidth pinned to innerWidth no matter how
  // badly the transport overflows — that assertion is permanently false on a deck, which is
  // exactly how the theme control's overflow went unseen. A rewrite that "simplified" this
  // check back to the mobileNav shape would reintroduce the same blind spot silently.
  const src = pageChecks(OPTS).transportFits.toString().replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(src, /scrollWidth/);
  assert.match(src, /elementFromPoint/);
});

test("transportFits takes its widths from the page's own spec", () => {
  // Mirrors wayOut and sameTab: the page names what it is asserting rather than this file
  // guessing a width that happens to matter to one site and not another.
  const src = pageChecks(OPTS).transportFits.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /spec\.transportFits/);
});

// The check's own evaluate callback is a self-contained closure over document/getComputedStyle
// (as with mobileNav's), so a fake page can hand back a canned bad-control list per width
// rather than mocking the check's control-walking logic itself.
function makeTransportFitsPage(badByWidth) {
  const seen = [];
  return {
    async setViewportSize({ width }) { seen.push(width); },
    async goto() {},
    async evaluate() {
      const width = seen[seen.length - 1];
      return (badByWidth[width] || []).slice();
    },
  };
}

test("transportFits checks every width in spec.transportFits, not only the first", async () => {
  const page = makeTransportFitsPage({ 390: [], 414: ["thDark (off-screen)", "tUp (off-screen)"] });
  const result = await pageChecks(OPTS).transportFits(page, {
    absolute: "https://example.test/talks/x/", transportFits: [390, 414],
  });
  assert.match(result, /414px:.*thDark/);
  assert.doesNotMatch(result, /390px/);
});

test("transportFits passes when every control is reachable at every width", async () => {
  const page = makeTransportFitsPage({ 320: [], 390: [], 414: [] });
  const result = await pageChecks(OPTS).transportFits(page, {
    absolute: "https://example.test/talks/x/", transportFits: [320, 390, 414],
  });
  assert.equal(result, null, `expected a pass, got ${JSON.stringify(result)}`);
});

// Same shape as makeTransportFitsPage: the check's evaluate callback closes over document,
// so the fake hands back the canned verdict for whatever width was last set.
function makeTransportBaselinePage(badByWidth) {
  const seen = [];
  return {
    async setViewportSize({ width }) { seen.push(width); },
    async goto() {},
    async evaluate() { return badByWidth[seen[seen.length - 1]] ?? null; },
  };
}

test("transportBaseline checks every width in spec.transportBaseline, not only the first", async () => {
  // The bar has three mobile tiers and a desktop form, and only the desktop form was ever
  // wrong. A check that stopped at the first width would have reported the fix and never
  // looked at the tiers whose own min-height is what holds the two controls together there.
  const page = makeTransportBaselinePage({
    360: null, 500: null, 1200: "language 29.1px at 734.5, theme 23.3px at 737.4 (5.8px taller, 2.9px apart)",
  });
  const result = await pageChecks(OPTS).transportBaseline(page, {
    absolute: "https://example.test/talks/x/", transportBaseline: [360, 500, 1200],
  });
  assert.match(result, /1200px:.*5\.8px taller/);
  assert.doesNotMatch(result, /360px|500px/);
});

test("transportBaseline passes when the two controls agree at every width", async () => {
  const page = makeTransportBaselinePage({ 320: null, 430: null, 900: null });
  const result = await pageChecks(OPTS).transportBaseline(page, {
    absolute: "https://example.test/talks/x/", transportBaseline: [320, 430, 900],
  });
  assert.equal(result, null, `expected a pass, got ${JSON.stringify(result)}`);
});

test("transportBaseline compares the controls structurally, not by id", () => {
  // A deck's language control is #lang and a prose page's is #langind; the third site is free
  // to name its own. Keying on an id would make this check pass by finding nothing.
  const src = pageChecks(OPTS).transportBaseline.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /\.seg:not\(\.theme\)/);
  assert.match(src, /\.seg\.theme/);
  assert.doesNotMatch(src, /getElementById\("lang/);
});

test("transportBaseline takes its widths from the page's own spec", () => {
  const src = pageChecks(OPTS).transportBaseline.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /spec\.transportBaseline/);
});

test("landing requires the landing link to be the brand lockup", () => {
  // Any link to the landing href would otherwise satisfy this; isLockup is what pins it to
  // the specific brand element the check exists to guard.
  const src = pageChecks(OPTS).landing.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /\.namemark svg/);
});

test("footer counts only direct children, never nested descendants", () => {
  // The reconciled bug: an unclosed <a> reparented every later entry inside it, and a
  // querySelectorAll would have counted those reparented entries as if nothing broke.
  // f.children is what makes nesting visible instead of silently collapsing the list.
  const src = pageChecks(OPTS).footer.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /f\.children/);
});

test("seo's canonical must equal the page's own URL, not merely echo og:url", () => {
  // Comparing canonical only to og:url would pass two tags agreeing on the same wrong URL;
  // comparing to `want` — this page's real address — is what catches a canonical pointing
  // at another page and quietly ceding this one's signals to it.
  const src = pageChecks(OPTS).seo.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /canonical !== want/);
});

// readoutInvariant's whole input is the page's served HTML — like noFlash and sourceLang, no
// Playwright page is needed, so these fakes stub fetch rather than mocking a page.
async function runReadoutInvariant(html, spec = { absolute: "https://example.test/talks/x/" }) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ text: async () => html });
  try {
    return await pageChecks(OPTS).readoutInvariant({}, spec);
  } finally {
    globalThis.fetch = realFetch;
  }
}

// A minimal design-tokens fence, inline in a <style> the way a real page carries it: both
// halves declare --c-mid (a token that genuinely differs between themes in the real package)
// and the --lcd family (invariant), so a test can drop an .lcd rule in after it and know
// exactly which of the two a reference to it should trip.
const TOKENS_HTML = (lcdCss) => `<!doctype html><html><head><style>
  :root[data-theme="light"]{
    --ground:#FAF9F5; --c-mid:#3A6DA6; --lcd:#0a0b0e; --lcd-ink:#7FA3D8; --lcd-faint:#7C8496;
  }
  :root{
    --ground:#0C0E13; --c-mid:#7FA3D8; --lcd:#0a0b0e; --lcd-ink:#7FA3D8; --lcd-faint:#7C8496;
  }
  ${lcdCss}
</style></head><body></body></html>`;

test("readoutInvariant passes a .lcd rule that paints only invariant tokens", async () => {
  const html = TOKENS_HTML(".lcd{background:var(--lcd)} .lcd .n{color:var(--lcd-ink)}");
  const result = await runReadoutInvariant(html);
  assert.equal(result, null, `expected a pass, got ${JSON.stringify(result)}`);
});

test("readoutInvariant fails a page-level .lcd rule the package's own scan cannot see", async () => {
  // The vector this check exists for: a rule added to a deck page's own CSS, outside any
  // fence this package generates. It is invisible to design:check, which only compares bytes
  // between markers, and to theme.test.mjs's own scan, which only reads
  // blocks/deck-transport.css — this check has to catch it from the served page instead.
  const html = TOKENS_HTML(".lcd{color:var(--c-mid)}");
  const result = await runReadoutInvariant(html);
  assert.match(result, /--c-mid/);
  assert.match(result, /\.lcd/);
});

test("readoutInvariant derives which tokens flip from the page itself, not a hardcoded list", () => {
  // It cannot read blocks/tokens.css at run time on a site, so it has to work out "which
  // tokens flip" from the served :root / :root[data-theme="light"] pair alone. Proven here
  // with --lcd-ink deliberately given different values in the two halves — something the real
  // package tokens never do — so a pass would mean the derivation is reading a hardcoded
  // package-side list instead of the page in front of it.
  return runReadoutInvariant(`<!doctype html><html><head><style>
    :root[data-theme="light"]{ --lcd:#0a0b0e; --lcd-ink:#111111; }
    :root{ --lcd:#0a0b0e; --lcd-ink:#7FA3D8; }
    .lcd .n{color:var(--lcd-ink)}
  </style></head><body></body></html>`).then((result) => {
    assert.match(result, /--lcd-ink/);
  });
});

test("readoutInvariant catches a .lcd rule nested inside @media, not only a top-level one", async () => {
  const html = TOKENS_HTML("@media (max-width:400px){ .lcd{border-color:var(--c-mid)} }");
  const result = await runReadoutInvariant(html);
  assert.match(result, /--c-mid/);
});

// A fenceless deck — the whole-file shape tokenVersion's own fenceless branch reads (see
// verify/design.mjs) — carries no :root pair inline at all: the palette lives in the linked
// tokens.css instead, and the page's own <style> holds only what the deck itself adds, such
// as a `.lcd` rule this check exists to catch. Two fetches, like tokenVersion's own fallback:
// the page's HTML, then the linked file's bytes, keyed by their resolved URLs.
function runFetchingReadoutInvariant(bodyByUrl, spec = { absolute: "https://example.test/talks/x/" }) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({ text: async () => bodyByUrl[url] ?? "" });
  return pageChecks(OPTS).readoutInvariant({}, spec).finally(() => { globalThis.fetch = realFetch; });
}

const TOKENS_CSS = `/* @robertblust/design — tokens.css, assembled from the shared blocks: tokens v11.
   Editing this file in a site does nothing: the next npm run design overwrites it. */

:root[data-theme="light"]{
  --ground:#FAF9F5; --c-mid:#3A6DA6; --lcd:#0a0b0e; --lcd-ink:#7FA3D8; --lcd-faint:#7C8496;
}
:root{
  --ground:#0C0E13; --c-mid:#7FA3D8; --lcd:#0a0b0e; --lcd-ink:#7FA3D8; --lcd-faint:#7C8496;
}
`;

test("readoutInvariant reads the palette from a linked tokens.css when the page's own <style> carries none", async () => {
  // The bug this closes: a deck that links tokens.css rather than carrying the design-tokens
  // fence inline has no :root pair for the old regex to find, so it failed every such page —
  // exactly the deck blust.ch is moving to the linked-file shape now stands on. This deck's
  // own <style> paints .lcd with only invariant tokens, so the check should still pass once
  // the palette is read from the linked file instead.
  const html = '<!doctype html><html><head><link rel="stylesheet" href="tokens.css">' +
    '<style>.lcd{background:var(--lcd)} .lcd .n{color:var(--lcd-ink)}</style>' +
    "</head><body></body></html>";
  const result = await runFetchingReadoutInvariant({
    "https://example.test/talks/x/": html,
    "https://example.test/talks/x/tokens.css": TOKENS_CSS,
  });
  assert.equal(result, null, `expected a pass, got ${JSON.stringify(result)}`);
});

test("readoutInvariant still fails a page that links tokens.css but adds its own flipping .lcd rule", async () => {
  // The fenceless shape must not become a way around this check: a `.lcd` rule the deck adds
  // in its own CSS, outside anything the package owns, is exactly the vector readoutInvariant
  // exists for — linking tokens.css only moves where the palette itself is read from.
  const html = '<!doctype html><html><head><link rel="stylesheet" href="tokens.css">' +
    "<style>.lcd{color:var(--c-mid)}</style>" +
    "</head><body></body></html>";
  const result = await runFetchingReadoutInvariant({
    "https://example.test/talks/x/": html,
    "https://example.test/talks/x/tokens.css": TOKENS_CSS,
  });
  assert.match(result, /--c-mid/);
  assert.match(result, /\.lcd/);
});

test("readoutInvariant reads a linked tokens.css on a page that keeps one fence of its own, not just a page declaring none", async () => {
  // tokenVersion's own fenceless branch (verify/design.mjs) used to gate on `spec.fences.length
  // === 0`, which is too narrow for a page like blust.ch's four stage pages: they keep `stage
  // contract` inline while moving tokens.css to the linked-file shape, so `spec.fences` there
  // is `["stage contract"]`, never `[]`. readoutInvariant never had that gate to begin with —
  // it derives the fenceless case structurally, from whether a bare `:root{}` is actually found
  // in the page's own <style> content, not from what `spec.fences` declares — so a page keeping
  // `stage contract` (whose own CSS carries no `:root{}`, only `.stage` rules) already falls
  // through to the linked file correctly. This pins that down as a contract rather than an
  // accident of the current regex, and answers the question the parallel fix to tokenVersion
  // raises: whether this check has the same fault. It does not.
  const html = '<!doctype html><html><head><link rel="stylesheet" href="tokens.css">' +
    '<style>.stage{position:relative} .lcd{background:var(--lcd)}</style>' +
    "</head><body></body></html>";
  const result = await runFetchingReadoutInvariant({
    "https://example.test/talks/x/": html,
    "https://example.test/talks/x/tokens.css": TOKENS_CSS,
  }, { absolute: "https://example.test/talks/x/", fences: ["stage contract"] });
  assert.equal(result, null, `expected a page keeping one other fence to read the linked file, got ${JSON.stringify(result)}`);
});

test("readoutInvariant requires both halves from the same source, not a page/file blend", async () => {
  // A page's own <style> can carry a bare :root with no :root[data-theme="light"] beside it —
  // a mid-migration page, or one whose light half only ever lived in the linked tokens.css.
  // Filling only the missing half from the linked file, as the old code did with `light = light
  // ?? …`, pairs the page's own dark with the file's light — two halves nothing ever compares in
  // a real page. Here the page's own (stale) dark value for --c-mid happens to equal the linked
  // file's real light value, so that blend reads as non-flipping, while the file's own
  // consistent pair — its actual dark next to its actual light — genuinely differs. A .lcd rule
  // painted from --c-mid must still be caught: the blend must not launder it into a pass.
  const html = '<!doctype html><html><head><link rel="stylesheet" href="tokens.css">' +
    '<style>:root{--c-mid:#111111; --lcd:#0a0b0e;} .lcd{color:var(--c-mid)}</style>' +
    "</head><body></body></html>";
  const tokensCss =
    ':root[data-theme="light"]{--c-mid:#111111; --lcd:#0a0b0e;}\n' +
    ':root{--c-mid:#222222; --lcd:#0a0b0e;}\n';
  const result = await runFetchingReadoutInvariant({
    "https://example.test/talks/x/": html,
    "https://example.test/talks/x/tokens.css": tokensCss,
  });
  assert.match(result ?? "", /--c-mid/,
    `expected the blended pair to still be caught as flipping, got ${JSON.stringify(result)}`);
});

test("readoutInvariant is fetched cold, like noFlash and sourceLang, not through page.evaluate", () => {
  const src = pageChecks(OPTS).readoutInvariant.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /fetch\(spec\.absolute\)/);
});

test("two independently built check sets do not share mutable state", () => {
  // Each site calls the factory once; if the bodies were hoisted onto one shared object, the
  // last site to import would silently win SITE and BASE for all of them.
  const a = pageChecks({ SITE: "https://a.test", BASE: "http://a.local" });
  const b = pageChecks({ SITE: "https://b.test", BASE: "http://b.local" });
  assert.notEqual(a.seo, b.seo);
});

test("typography sits immediately before translates", () => {
  const keys = Object.keys(pageChecks(OPTS));
  assert.equal(keys.indexOf("typography"), keys.indexOf("translates") - 1);
});

test("typography reads the stems from the vendored conventions-check, not a literal", () => {
  // One list in the family. A literal here would be the second copy the conventions
  // repository exists to remove; the check fetches the site's own vendored script.
  const src = pageChecks(OPTS).typography.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /conventions\/conventions-check/);
  assert.match(src, /STEMS=/);
  assert.doesNotMatch(src, /colour|behaviour/);
});

test("typography reads German and English notes cold, English text from the body's textContent, and drops code on all sides", () => {
  const src = pageChecks(OPTS).typography.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /fetch\(spec\.absolute\)/);
  assert.match(src, /data-\(de\|notes-de\|notes\)/);
  assert.match(src, /textContent/);
  assert.match(src, /code/);
});

test("typography names each hit with its side and its context", async () => {
  // A stub page and a stub fetch: the check must work from what it reads, not from Playwright.
  const html = `<html lang="en"><body><p data-de="Der Weg — „hier“ ist es.">The way – it is.</p>
    <p data-de="Die Strasse ist grösser.">Fine.</p></body></html>`;
  const stems = "#!/bin/sh\nSTEMS='colour|behaviour|grey([^a-z]|$)'\n";
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({
    ok: true,
    text: async () => (String(url).endsWith("conventions-check") ? stems : String(url).endsWith("/conventions/GERMAN.md") ? GERMAN_STUB : html),
  });
  try {
    const page = { evaluate: async () => ({ text: "The way – it is. The colour of it. Fine.", title: "", desc: "" }) };
    const out = await pageChecks(OPTS).typography(page, { absolute: "https://example.test/" });
    assert.ok(out, "expected findings");
    assert.match(out, /\[de\] em-dash/);
    assert.match(out, /\[de\] „/);
    assert.match(out, /\[en\] spaced en-dash/);
    assert.match(out, /\[en\] colour/);
    assert.doesNotMatch(out, /Strasse/);
  } finally { globalThis.fetch = realFetch; }
});

test("typography strips tags before it decodes, so escaped angle brackets in German prose survive", async () => {
  const html = `<p data-de="Adoption &lt; X — und Score &gt; +2 — im Scope.">x</p>`;
  const stems = "STEMS='colour([^a-z]|$)|organis(e|ed|es|ing|ation|ations)'";
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({
    ok: true,
    text: async () => (String(url).endsWith("conventions-check") ? stems : String(url).endsWith("/conventions/GERMAN.md") ? GERMAN_STUB : html),
  });
  try {
    const page = { evaluate: async () => ({ text: "Clean English text.", title: "", desc: "" }) };
    const out = await pageChecks(OPTS).typography(page, { absolute: "https://example.test/x/" });
    const count = (out.match(/\[de\] em-dash/g) || []).length;
    assert.equal(count, 2, `expected both em-dashes reported, got: ${out}`);
    assert.match(out, /Adoption < X/, "the prose between the escaped brackets must survive the strip");
  } finally { globalThis.fetch = realFetch; }
});

test("typography holds English speaker notes to the English rules, and German notes to the German ones", async () => {
  // data-notes is English: a spaced en-dash there is a hit; data-notes-de is German: the same
  // dash there is correct, and the em-dash beside it is the hit.
  const html = `<section data-notes="First point – second point." data-notes-de="Erster Punkt – zweiter Punkt — dritter."></section>`;
  const stems = "STEMS='colour([^a-z]|$)'";
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => ({
    ok: true,
    text: async () => (String(url).endsWith("conventions-check") ? stems : String(url).endsWith("/conventions/GERMAN.md") ? GERMAN_STUB : html),
  });
  try {
    const page = { evaluate: async () => ({ text: "Clean English text.", title: "", desc: "" }) };
    const out = await pageChecks(OPTS).typography(page, { absolute: "https://example.test/x/" });
    assert.match(out, /\[en\] spaced en-dash in "First point – second point\."/);
    assert.match(out, /\[de\] em-dash/);
    assert.doesNotMatch(out, /\[de\] spaced en-dash/);
    assert.doesNotMatch(out, /\[en\] em-dash/);
    assert.equal((out.match(/\[/g) || []).length, 2, `exactly two hits, got: ${out}`);
  } finally { globalThis.fetch = realFetch; }
});

test("typography holds the English title and meta description to the English rules", async () => {
  // Both live in the head, outside the body clone, and they are the first English a crawler
  // or a tab strip reads; a British word in a title would pass every other check.
  const realFetch = globalThis.fetch;
  try {
    const stems = "STEMS='colour([^a-z]|$)|organis(e|ed|es|ing|ation|ations)'";
    globalThis.fetch = async url => ({ ok: true, text: async () => String(url).endsWith("conventions-check") ? stems : String(url).endsWith("/conventions/GERMAN.md") ? GERMAN_STUB : "<p>x</p>" });
    const page = { evaluate: async () => ({ text: "Clean English text.", title: "The colour of it", desc: "One – two." }) };
    const out = await pageChecks(OPTS).typography(page, { absolute: "https://example.test/x/" });
    assert.match(out, /\[en title\] colour in "The colour of it"/);
    assert.match(out, /\[en desc\] spaced en-dash in "One – two\."/);
  } finally { globalThis.fetch = realFetch; }
});

test("translates holds the German title and meta description to the German marks after the toggle", async () => {
  // The German title is a script string, UI.de or TALK.de, that the cold scan never sees and
  // that exists only after the toggle; blust.ch shipped "Ideen — Robert Blust" under a rule
  // that gives German no em-dash, and no check said so.
  let lang = "en";
  const page = {
    click: async sel => { lang = sel === "#lde" ? "de" : "en"; },
    title: async () => lang === "de" ? "Ideen — Robert Blust" : "Ideas — Robert Blust",
    evaluate: async fn => {
      const s = fn.toString();
      if (s.includes("documentElement.lang")) return lang;
      if (s.includes("metadesc")) return lang === "de" ? "Zwei Ideen, zur Prüfung gestellt." : "Two ideas.";
      if (s.includes("data-de-href")) return null;
      // a page whose every -de element switches: the walk finds nothing kept
      if (s.includes("data-de-aria")) return [];
      return lang === "de" ? "Ideen" : "Ideas";
    },
  };
  const spec = { translates: { lang: "de", shows: ["Ideen"], hides: ["Ideas"] } };
  const out = await pageChecks(OPTS).translates(page, spec);
  assert.match(out, /\[de title\] em-dash in "Ideen — Robert Blust"/);
  assert.doesNotMatch(out, /\[de desc\]/);
  // And a clean pair passes, so the rule does not fire on the marks it allows. The first run
  // returned at the marks, before the toggle back, so the stub is reset to English first.
  lang = "en";
  page.title = async () => lang === "de" ? "Ideen – Robert Blust" : "Ideas — Robert Blust";
  assert.equal(await pageChecks(OPTS).translates(page, spec), null);
});

test("translates takes its German title and description from the page when the spec names none", () => {
  const html = `<script>var UI = { de:{ title:"Titel – DE", desc:"Beschreibung." }, en:{ title:"Title", desc:"Description." } };</script>`;
  assert.deepEqual(expectedGerman(html), { title: "Titel – DE", desc: "Beschreibung." });
  assert.equal(expectedGerman("<p data-de='x'>y</p>"), null);
  const src = pageChecks(OPTS).translates.toString();
  assert.match(src, /expectedGerman/);
});

// germanValues keeps a js value as the raw source text, escapes and all, so applyGerman can
// write it back unchanged; expectedGerman compares against the rendered title and meta
// description, which never carry a backslash, so it has to unescape first.
test("expectedGerman unescapes a js value's own escaped quotes", () => {
  const html = `<script>var UI = { de:{ title:"Robert\\'s Titel", desc:"Eine \\"Sache\\"." }, en:{ title:"Robert's Title", desc:"A \\"thing\\"." } };</script>`;
  assert.deepEqual(expectedGerman(html), { title: "Robert's Titel", desc: 'Eine "Sache".' });
});

// A site's spec used to restate the German title and description of every page verbatim, so a
// better translation failed the check until the spec caught up. With no title/desc named, the
// check now reads what the page's own de:{ title, desc } object declares and holds the toggle
// to that instead.
test("translates checks the toggle's title and description against the page's own de object when the spec names none", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ text: async () =>
    `<script>var UI = { de:{ title:"Ideen – Robert Blust", desc:"Zwei Ideen." }, en:{ title:"Ideas", desc:"Two." } };</script>` });
  try {
    let lang = "en";
    const page = {
      click: async sel => { lang = sel === "#lde" ? "de" : "en"; },
      title: async () => lang === "de" ? "Ideen – Robert Blust" : "Ideas",
      evaluate: async fn => {
        const s = fn.toString();
        if (s.includes("documentElement.lang")) return lang;
        if (s.includes("metadesc")) return lang === "de" ? "Zwei Ideen." : "Two.";
        if (s.includes("data-de-href")) return null;
        if (s.includes("data-de-aria")) return [];
        return lang === "de" ? "Ideen" : "Ideas";
      },
    };
    const spec = { absolute: "https://example.test/", translates: { lang: "de", shows: ["Ideen"], hides: ["Ideas"] } };
    assert.equal(await pageChecks(OPTS).translates(page, spec), null);

    // A page whose toggle disagrees with its own de object is caught, naming the page's value
    // as the expectation — not a value the spec never stated.
    page.title = async () => lang === "de" ? "Wrong Title" : "Ideas";
    const out = await pageChecks(OPTS).translates(page, spec);
    assert.match(out, /expected "Ideen – Robert Blust"/);
  } finally { globalThis.fetch = realFetch; }
});

// Read the source, not asked of it: a spec with no `absolute` — the shape every pre-existing
// translates test above and below this one uses — must never reach fetch, because fetch(undefined)
// is a thrown TypeError, not a skipped check. A page with no de object and no literal title/desc
// checks neither, exactly as before this task.
test("translates never calls fetch when the spec carries no absolute", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("fetch must not be called without spec.absolute"); };
  try {
    let lang = "en";
    const page = {
      click: async sel => { lang = sel === "#lde" ? "de" : "en"; },
      title: async () => lang === "de" ? "Ideen" : "Ideas",
      evaluate: async fn => {
        const s = fn.toString();
        if (s.includes("documentElement.lang")) return lang;
        if (s.includes("metadesc")) return "";
        if (s.includes("data-de-href")) return null;
        if (s.includes("data-de-aria")) return [];
        return lang === "de" ? "Ideen" : "Ideas";
      },
    };
    const spec = { translates: { lang: "de", shows: ["Ideen"], hides: ["Ideas"] } };
    assert.equal(await pageChecks(OPTS).translates(page, spec), null);
  } finally { globalThis.fetch = realFetch; }
});

test("the vendored STEMS line compiles as a JavaScript regex and reads as the check reads it", async () => {
  const src = await readFile(new URL("../conventions/conventions-check", import.meta.url), "utf8");
  const line = src.match(/^STEMS='(.*)'$/m);
  assert.ok(line, "conventions-check carries a STEMS= line");
  const re = new RegExp(`(${line[1]})`, "i");
  assert.match("the colour of it", re);
  assert.match("Materialised views", re);
  assert.doesNotMatch("the color of it", re);
  assert.doesNotMatch("a Greyhound", re, "the ([^a-z]|$) anchor holds under the i flag");
});

test("typography passes a clean page and fails a site with no vendored stems", async () => {
  const realFetch = globalThis.fetch;
  const clean = `<html><body><p data-de="Der Weg – «hier» ist es.">The way — it is.</p></body></html>`;
  globalThis.fetch = async (url) => ({
    ok: true, text: async () => (String(url).endsWith("conventions-check") ? "STEMS='colour'\n" : String(url).endsWith("/conventions/GERMAN.md") ? GERMAN_STUB : clean) });
  try {
    const page = { evaluate: async () => "The way — it is. May 2012–Oct 2016." };
    assert.equal(await pageChecks(OPTS).typography(page, { absolute: "https://example.test/" }), null);
  } finally { globalThis.fetch = realFetch; }
  globalThis.fetch = async (url) => (String(url).endsWith("conventions-check") ? { ok: false, text: async () => "" } : String(url).endsWith("/conventions/GERMAN.md") ? { ok: true, text: async () => GERMAN_STUB } : { ok: true, text: async () => clean });
  try {
    const page = { evaluate: async () => "" };
    const out = await pageChecks(OPTS).typography(page, { absolute: "https://example.test/" });
    assert.match(out, /no vendored conventions-check/);
  } finally { globalThis.fetch = realFetch; }
});

test("navOrder's rule names Timeline after Model", () => {
  const src = pageChecks(OPTS).navOrder.toString();
  const m = /const ORDER = \[([^\]]+)\]/.exec(src);
  assert.ok(m, "navOrder has no ORDER list");
  const order = m[1].split(",").map(s => s.trim().replace(/"/g, ""));
  assert.equal(order.indexOf("Timeline"), order.indexOf("Model") + 1);
  assert.equal(order.indexOf("Example"), order.indexOf("Timeline") + 1);
});

// Both lists, parsed and compared — not two strings matched. The previous form asserted that
// header.css contained the words "order Ideas, Principles, …" and that the file named a fence
// version, and both held while API sat in one list and not the other: a name missing from the
// contract is invisible to a regex built out of the names that are there. A contract that
// disagrees with the check enforcing it is worse than no contract, and this is the test that
// has to notice.
// CLI is first, by the owner's decision: a reader who came to set the thing up wants the
// command before anything a site says about it, and a site without a CLI page loses nothing, since
// the rule is filtered to the items a site has. After it the order is read right to left: the
// switcher sits at the edge and each step left is more the site's own subject, and nothing is
// more the site's own subject than who does the work, so Team comes next and nothing else may
// be inserted before it. Principles follows it, because what
// the work is held to belongs to a site as closely as who does it; Surfaces comes after both,
// since where the work is published is a consequence of them and precedes any one thing
// published there.
test("navOrder's rule puts CLI first, then Team and Principles", () => {
  const src = pageChecks(OPTS).navOrder.toString();
  const m = /const ORDER = \[([^\]]+)\]/.exec(src);
  assert.ok(m, "navOrder has no ORDER list");
  const order = m[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);
  assert.equal(order[0], "CLI");
  assert.equal(order.indexOf("Team"), 1);
  assert.equal(order.indexOf("Principles"), 2);
  assert.equal(order.indexOf("Surfaces"), 3);
  assert.equal(order.indexOf("API"), 4);
});

test("the header contract's order comment names exactly what navOrder enforces", () => {
  const src = pageChecks(OPTS).navOrder.toString();
  const m = /const ORDER = \[([^\]]+)\]/.exec(src);
  assert.ok(m, "navOrder has no ORDER list");
  const enforced = m[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean);

  const css = fs.readFileSync(path.join(PKG, "blocks/header.css"), "utf8");
  const c = /·\s*order\s+([\s\S]+?)\s*then the language control/.exec(css);
  assert.ok(c, "the header contract states no order");
  const stated = c[1].replace(/\s+/g, " ").replace(/,\s*$/, "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  assert.deepEqual(stated, enforced,
    `the contract states ${stated.join(", ")}; navOrder enforces ${enforced.join(", ")}`);
});

test("translates holds every -de attribute to the switch, not a sample", () => {
  // A spec's shows/hides list samples three strings a page. The German of an element the
  // list never names could stay English, or be rewritten by a script after the toggle, and
  // every suite would still say "all checks pass". So after the toggle the check walks
  // every element that carries data-de and every one that carries data-de-aria, and after
  // toggling back it walks them again against the English it captured.
  const src = pageChecks(OPTS).translates.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /\[data-de\]/, "translates never selects the data-de elements");
  assert.match(src, /\[data-de-aria\]/, "translates never selects the data-de-aria elements");
  assert.match(src, /data-en-aria/, "translates does not hold the English label on the way back");
});

test("headerFits looks for a wrapped bar, at both languages and across the widths", () => {
  // The bug it exists for: the bar wrapped from 641px up, in both languages, on every page,
  // for as long as there were five nav items. mobileNav reads sideways scroll and the
  // wordmark's height; navOrder reads the order. A wrapped bar shows in neither.
  const src = pageChecks(OPTS).headerFits.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /getBoundingClientRect\(\)\.top/, "it does not read where each child sits");
  assert.match(src, /rows > 1/, "it does not fail on a bar that has wrapped");
  assert.match(src, /"de"/, "it never toggles to the longer language, which is the one that breaks");
  for (const w of [641, 1000, 1001]) assert.ok(src.includes(String(w)), `it never measures ${w}px`);
});

test("the header contract collapses on a measurement, not on a width", () => {
  const css = fs.readFileSync(path.join(PKG, "blocks/header.css"), "utf8");
  // A width cannot be right for three sites whose navs hold three, four and six items.
  // Measured, the German row needed 720px on guestgraph.io, 900 on companygraph.io and 1000
  // on blust.ch, so any single number gave two of them a button where a row would have read.
  assert.ok(!/@media \(max-width:(640|1000)px\)\{/.test(css),
    "the contract still collapses at a width");
  assert.match(css, /:root\[data-nav="compact"\] \.bar\{/,
    "the collapse is not keyed off the attribute the page sets");
  assert.match(css, /:root\[data-nav="compact"\] \.burger\{display:inline-flex; order:-1\}/,
    "the button no longer takes the left-hand corner");

  // And exactly one thing may set that attribute.
  const js = fs.readFileSync(path.join(PKG, "blocks/nav-fit.js"), "utf8");
  assert.match(js, /removeAttribute\("data-nav"\)/, "it never measures in the wide state");
  assert.match(js, /flexWrap = "nowrap"/,
    "it measures a row that may wrap, where a wrapped child reports the width it was given");
  assert.match(js, /scrollWidth > bar\.clientWidth/, "it does not compare need against room");
  assert.match(js, /attributeFilter: \["lang"\]/,
    "it never re-measures when the language changes, which is the case that started this");
  assert.match(js, /document\.fonts/, "it never re-measures once the real face has arrived");
  // A fence in the wrong place must fail loudly. Put beside `theme boot` in the head rather
  // than beside `theme` at the end of the body — and `end theme` is a prefix of
  // `end theme boot`, so it is one slip away — the row is not in the DOM and a block that
  // returned would leave every page uncollapsed with nothing saying why.
  assert.match(js, /throw new Error\("nav fit: this page has no \.bar/,
    "a page without a row is handled quietly, so a misplaced fence says nothing");
});

function stubFetch(html, german = GERMAN_STUB) {
  const stems = "STEMS='colour([^a-z]|$)'";
  const real = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.endsWith("/conventions/GERMAN.md")) return german === null ? { ok: false, text: async () => "" } : { ok: true, text: async () => german };
    return { ok: true, text: async () => (u.endsWith("conventions-check") ? stems : html) };
  };
  return () => { globalThis.fetch = real; };
}
const cleanPage = { evaluate: async () => ({ text: "Clean English text.", title: "", desc: "" }) };

test("bannedForms reads the fence, one form and its replacement a line", () => {
  const forms = bannedForms(GERMAN_STUB);
  assert.equal(forms.length, 2);
  assert.equal(forms[0][0], "Reservierung (write Reservation)");
  assert.ok(forms[0][1].test("Ihre RESERVIERUNGEN"));
  assert.equal(bannedForms("# German\n\nno fence\n"), null);
});

test("typography fails an empty German value", async () => {
  const restore = stubFetch(`<h2 id="x" data-de="">Apaleo could not be reached</h2>`);
  try {
    const out = await pageChecks(OPTS).typography(cleanPage, { absolute: "https://example.test/x/" });
    assert.match(out, /\[de\] empty data-de/);
  } finally { restore(); }
});

test("typography names the element on an empty German value, so two empty hits do not read alike", async () => {
  const restore = stubFetch(
    `<h2 id="x" data-de="">Apaleo could not be reached</h2><meta name="og:site" content="" data-de="">`);
  try {
    const out = await pageChecks(OPTS).typography(cleanPage, { absolute: "https://example.test/x/" });
    assert.match(out, /\[de\] empty data-de on <h2> "Apaleo could not be reached": a German visitor sees nothing here/);
    // The meta tag has no text of its own, so the start tag is the whole identifier.
    assert.match(out, /\[de\] empty data-de on <meta>: a German visitor sees nothing here/);
  } finally { restore(); }
});

test("typography names the empty element from germanValues, not from a zip with its own regex scan", async () => {
  // A data-de inside a <script> string and one inside an HTML comment are both counted by
  // the raw regex this check also runs, but germanValues walks the DOM and skips both; a
  // single-quoted data-de is the other way around: germanValues counts it, the regex does
  // not. Any of the three shifts a zip by position, so the real empty value below would be
  // named from whichever entry the zip happened to land on instead of its own tag and text.
  const restore = stubFetch(
    `<script>var s = 'data-de="x"';</script>` +
    `<!-- <p data-de="y">Hidden</p> -->` +
    `<p data-de='Gut'>OK</p>` +
    `<h2 data-de="">Apaleo could not be reached</h2>`);
  try {
    const out = await pageChecks(OPTS).typography(cleanPage, { absolute: "https://example.test/x/" });
    assert.equal((out.match(/\[de\] empty/g) || []).length, 1, out);
    assert.match(out, /\[de\] empty data-de on <h2> "Apaleo could not be reached": a German visitor sees nothing here/);
  } finally { restore(); }
});

test("typography scans the page's own de object for the German title and description", async () => {
  const restore = stubFetch(
    `<p data-de="Gut.">x</p><script>var UI = { de:{ title:"Reservierung", desc:"Gut." }, en:{ title:"Reservation", desc:"Fine." } };</script>`);
  try {
    const out = await pageChecks(OPTS).typography(cleanPage, { absolute: "https://example.test/x/" });
    assert.match(out, /\[de title\] Reservierung \(write Reservation\)/);
  } finally { restore(); }
});

test("typography fails a refused form as a whole phrase, in any case, and nothing inside another word", async () => {
  const restore = stubFetch(`<p data-de="Ihre Reservierungen und ein offener Kern.">x</p><p data-de="Die Vorreservierung läuft.">y</p>`);
  try {
    const out = await pageChecks(OPTS).typography(cleanPage, { absolute: "https://example.test/x/" });
    assert.match(out, /Offener Kern \(write Open Core\)/);
    assert.match(out, /Reservierung \(write Reservation\) in "Ihre Reservierungen/);
    assert.doesNotMatch(out, /Vorreservierung/);
  } finally { restore(); }
});

test("typography fails the informal plural and a bare count of the years, and passes «Über fünfundzwanzig Jahre»", async () => {
  const restore = stubFetch(`<p data-de="Weder eure Entscheide noch euer Plan.">x</p><p data-de="Dahinter stehen fünfundzwanzig Jahre Plattformarbeit.">y</p><p data-de="Über fünfundzwanzig Jahre der Reihe nach.">z</p>`);
  try {
    const out = await pageChecks(OPTS).typography(cleanPage, { absolute: "https://example.test/x/" });
    assert.equal((out.match(/\[de\] informal plural/g) || []).length, 2);
    assert.equal((out.match(/\[de\] bare count of the years/g) || []).length, 1);
  } finally { restore(); }
});

test("typography fails a site with no vendored GERMAN.md and names the release that brings it", async () => {
  const restore = stubFetch(`<p data-de="Gut.">x</p>`, null);
  try {
    const out = await pageChecks(OPTS).typography(cleanPage, { absolute: "https://example.test/x/" });
    assert.match(out, /no vendored conventions\/GERMAN\.md .* v1\.29\.0/);
  } finally { restore(); }
});
