import { test } from "node:test";
import assert from "node:assert/strict";
import { pageChecks } from "../verify/pages.mjs";

const OPTS = { SITE: "https://example.test", BASE: "http://127.0.0.1:8000" };

// The nineteen this module is responsible for. A body that quietly stops being exported takes
// its coverage from three suites at once, and every one of them still reports "all checks
// pass" — nothing else in the system would notice.
const EXPECTED = ["carriesLang", "card", "contains", "footer", "headerBaseline", "internalLinks",
  "landing", "lang", "links", "mobileNav", "navOrder", "noNewTab", "sameOrigin", "sameTab",
  "seo", "sourceLang", "storageKeys", "title", "wayOut"];

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
  // The header bug this replaced was exactly a box that centred while the text inside it did
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

test("mobileNav is measured at the 360px breakpoint", () => {
  // The width picked is narrower than the phones in the analytics; asserting it pins the
  // breakpoint the rest of the check's findings are only meaningful at.
  const src = pageChecks(OPTS).mobileNav.toString().replace(/\/\/.*$/gm, "");
  assert.match(src, /width: 360/);
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

test("two independently built check sets do not share mutable state", () => {
  // Each site calls the factory once; if the bodies were hoisted onto one shared object, the
  // last site to import would silently win SITE and BASE for all of them.
  const a = pageChecks({ SITE: "https://a.test", BASE: "http://a.local" });
  const b = pageChecks({ SITE: "https://b.test", BASE: "http://b.local" });
  assert.notEqual(a.seo, b.seo);
});
