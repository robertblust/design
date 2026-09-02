import { test } from "node:test";
import assert from "node:assert/strict";
import { pageChecks } from "../verify/pages.mjs";

const OPTS = { SITE: "https://example.test", BASE: "http://127.0.0.1:8000" };

// The twenty-three this module is responsible for. A body that quietly stops being exported
// takes its coverage from three suites at once, and every one of them still reports "all
// checks pass" — nothing else in the system would notice.
const EXPECTED = ["carriesLang", "card", "contains", "contrast", "footer", "headerBaseline",
  "internalLinks", "landing", "lang", "links", "mobileNav", "navOrder", "noFlash", "noNewTab",
  "readoutInvariant", "sameOrigin", "sameTab", "seo", "sourceLang", "storageKeys", "title",
  "transportFits", "wayOut"];

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

// mobileNav's own evaluate callbacks are self-contained closures over document/getComputedStyle,
// so — as with contrast's fake page above — a fake page can hand back canned shut/open/closed
// states per call rather than mocking the check itself. Three evaluate calls happen when
// `shut.burger` is true: the 360px shut state, the opened state after clicking #burger, and the
// closed state after Escape.
function makeMobileNavPage(shutOverrides = {}) {
  let evalCalls = 0;
  return {
    async setViewportSize() {},
    async goto() {},
    async evaluate() {
      evalCalls += 1;
      if (evalCalls === 1)
        return {
          brand: 40, mark: 40, wide: false, links: false, burger: true, seg: true,
          theme: false,
          ...shutOverrides,
        };
      if (evalCalls === 2) return { links: true, flag: "true" };
      return true;
    },
    async click() {},
    keyboard: { press: async () => {} },
  };
}

test("mobileNav fails when a page declaring noFlash has lost its theme control", async () => {
  // The defect this closes: `.seg.theme` deleted from a prose page used to pass every check,
  // because storageKeys clicked it present-or-skip, navOrder only cares that #langind is last,
  // and design:check cannot see site-owned markup. `noFlash` is the page's own declaration
  // that it carries the fence and therefore the two controls; a page that set it but lost
  // #thLight/#thDark must fail here.
  const page = makeMobileNavPage({ theme: false });
  const result = await pageChecks(OPTS).mobileNav(page, { absolute: "https://example.test/", noFlash: "rb-theme" });
  assert.match(result, /the theme control is not on the bar/);
});

test("mobileNav passes with the theme control present, and invents no requirement for a page with no noFlash flag", async () => {
  const withTheme = await pageChecks(OPTS).mobileNav(
    makeMobileNavPage({ theme: true }), { absolute: "https://example.test/", noFlash: "rb-theme" });
  assert.equal(withTheme, null, `expected a pass, got ${JSON.stringify(withTheme)}`);

  // A deck carries neither the noFlash flag nor the theme control — the check must not
  // demand a control the page never claimed to have.
  const noFlag = await pageChecks(OPTS).mobileNav(
    makeMobileNavPage({ theme: false }), { absolute: "https://example.test/" });
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
