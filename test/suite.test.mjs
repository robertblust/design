import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { runSuite } from "@robertblust/design/verify/suite";

// A page that answers the handful of calls the runner makes of it, and records nothing else.
// Checks themselves are supplied by the test, so this only has to be good enough to get the
// loop running.
//
// `ld` is what this page's `evaluate` answers. The runner calls evaluate twice per page — once
// to await document.fonts, once to collect the page's JSON-LD — and discards the first result,
// so one answer serves both. A page given no `ld` answers null, which is what a page carrying
// no JSON-LD looks like to the collector.
function fakePage(ld) {
  return {
    // The runner's own gate is `if (!res || !res.ok())`, so the stub's response must satisfy
    // it — an empty goto() answers "no response" on every single run, which is not the clean
    // pass the "clean site" test needs.
    async goto() { return { ok: () => true, status: () => 200 }; },
    async close() {}, async evaluate() { return ld ?? null; },
    async $() { return null; }, on() {}, context: () => ({ browser: () => fakeBrowser() }),
  };
}
// Pages are handed out in the order the runner asks for them, which is the order of PAGES, so
// a test can give one page a different graph from its neighbour by position.
function fakeBrowser(lds = []) {
  let i = 0;
  return { async newPage() { return fakePage(lds[i++]); }, async close() {} };
}

// Every site-wide fetch the runner makes, answered well enough to pass. Individual tests
// override one entry to make exactly one thing wrong.
function fakeFetch(over = {}) {
  const body = {
    // The one page PAGES declares, so the sitemap's own crawl-map reachability loop (which
    // fetches every <loc> it lists, including this one) has something to find.
    "/": "<html></html>",
    "/sitemap.xml": `<urlset><loc>https://x.test/</loc></urlset>`,
    "/robots.txt": "Sitemap: https://x.test/sitemap.xml",
    "/favicon.svg": `<svg><text font-family="Plex Mono, monospace">rb</text></svg>`,
    ...over,
  };
  return async (url) => {
    const path = new URL(url).pathname;
    const text = body[path];
    return { ok: text !== undefined, status: text === undefined ? 404 : 200,
             async text() { return text ?? ""; } };
  };
}

const OPTS = () => ({
  browser: fakeBrowser(), SITE: "https://x.test", BASE: "https://x.test",
  PAGES: [{ path: "/", seo: true, tokenVersion: true, fences: ["design tokens"], typography: true }],
  CHECKS: {}, systemFaces: new Set(["plex mono", "monospace"]),
});

// process.exit is stubbed once for the whole file, installed before any test runs and
// restored only after every test has finished — not inside one test's own body. By the time
// the dedicated "does not exit" test below would run, six earlier tests have already called
// runSuite with whatever process.exit currently is; a stub scoped to just that one test's
// body would never see a real process.exit fire, because a real one would have terminated
// the process during an earlier test, long before this test's body ever installed anything.
// Recording every call here, for the whole file, means a regression is caught by whichever
// test happens to run first against it, not only by the one test that thinks to check.
const realExit = process.exit;
const exitCalls = [];
before(() => {
  process.exit = (code) => { exitCalls.push(code); };
});
after(() => {
  process.exit = realExit;
});

test("a clean site reports no failures", async (t) => {
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  t.after(() => { globalThis.fetch = real; });
  assert.equal(await runSuite(OPTS()), 0);
});

test("a page that has not opted into seo is a failure", async (t) => {
  // The guard exists because the runner skips any check whose key is undefined, so deleting
  // one line from PAGES turns a contract off and changes no output. Silence is the failure
  // mode it defends against.
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  t.after(() => { globalThis.fetch = real; });
  const o = OPTS(); o.PAGES = [{ path: "/", tokenVersion: true, fences: [], typography: true }];
  assert.ok(await runSuite(o) > 0, "a page without seo passed");
});

test("a page that has not opted into tokenVersion is a failure", async (t) => {
  // Same contract as seo, same reason: the runner skips any check whose key is undefined, so
  // removing this one line from a page's spec turns the guard off and changes no output.
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  t.after(() => { globalThis.fetch = real; });
  const o = OPTS(); o.PAGES = [{ path: "/", seo: true, fences: [], typography: true }];
  assert.ok(await runSuite(o) > 0, "a page without tokenVersion passed");
});

test("a page that has not opted into typography is a failure", async (t) => {
  // Same contract again, same reason: the runner skips any check whose key is undefined, so
  // removing this one line from a page's spec turns the guard off and changes no output.
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  t.after(() => { globalThis.fetch = real; });
  const o = OPTS(); o.PAGES = [{ path: "/", seo: true, tokenVersion: true, fences: ["design tokens"] }];
  assert.ok(await runSuite(o) > 0, "a page without typography passed");
});

test("a page that has not opted into fences is a failure", async (t) => {
  // Same contract again: fences alone is presence-only, so a page that never declares the
  // key is invisible to this guard exactly as it is to design:check's own discovery.
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  t.after(() => { globalThis.fetch = real; });
  const o = OPTS(); o.PAGES = [{ path: "/", seo: true, tokenVersion: true, typography: true }];
  assert.ok(await runSuite(o) > 0, "a page without fences passed");
});

test("a sitemap that does not name this site is a failure", async (t) => {
  // The site-identity guard. One static server on port 8000 can serve the wrong repository,
  // and a run once reported six failures belonging to a site nobody was testing.
  //
  // This uses a non-root page on purpose. With PAGES at "/", a sitemap naming another site
  // trips the crawl-map's own missing-URL check too (its "expected" list is built from the
  // same SITE), so that check alone would pass this test even with the identity guard
  // deleted. A page at "/about/" keeps the crawl-map entry correct (it is listed and
  // reachable) while the sitemap still omits the homepage the identity guard looks for,
  // so this test only goes green because that guard specifically caught it.
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch({
    "/sitemap.xml": `<urlset><loc>https://x.test/about/</loc></urlset>`,
    "/about/": "<html></html>",
  });
  t.after(() => { globalThis.fetch = real; });
  const o = OPTS();
  o.PAGES = [{ path: "/about/", seo: true, tokenVersion: true, fences: ["design tokens"], typography: true }];
  assert.ok(await runSuite(o) > 0, "a sitemap naming another site passed");
});

test("a sitemap listing a URL that is not in PAGES is a failure", async (t) => {
  // The crawl map's own contract, distinct from the site-identity guard above: every URL the
  // sitemap advertises must be one PAGES actually declares, or the sitemap is a list of
  // promises the site does not keep. The homepage <loc> stays present here so the identity
  // guard passes, and the extra URL is itself reachable (200) so the reachability loop a few
  // lines down has no 404 to catch either — only the crawl map's missing/unexpected
  // comparison can be responsible for this failure. Leaving the extra URL unreachable would
  // have made this test pass for the wrong reason: the same overlap that made the original
  // site-identity test unable to isolate its own guard (see the comment there).
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch({
    "/sitemap.xml": `<urlset><loc>https://x.test/</loc><loc>https://x.test/extra/</loc></urlset>`,
    "/extra/": "<html></html>",
  });
  t.after(() => { globalThis.fetch = real; });
  assert.ok(await runSuite(OPTS()) > 0, "a sitemap listing an unexpected URL passed");
});

test("robots.txt naming no sitemap is a failure", async (t) => {
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch({ "/robots.txt": "User-agent: *" });
  t.after(() => { globalThis.fetch = real; });
  assert.ok(await runSuite(OPTS()) > 0, "robots.txt without a sitemap passed");
});

test("a favicon naming a face it cannot load is a failure", async (t) => {
  // The favicon is the only place the brand mark exists outside a page, so no DOM check
  // reaches it.
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch({
    "/favicon.svg": `<svg><text font-family="Comic Sans MS">rb</text></svg>` });
  t.after(() => { globalThis.fetch = real; });
  assert.ok(await runSuite(OPTS()) > 0, "a favicon naming an unloadable face passed");
});

test("a failing check counts, and a passing one does not", async (t) => {
  // The loop's own contract: a check returning a string is a failure, null is a pass.
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  t.after(() => { globalThis.fetch = real; });
  const bad = OPTS(); bad.CHECKS = { boom: async () => "it broke" }; bad.PAGES[0].boom = true;
  const good = OPTS(); good.CHECKS = { fine: async () => null }; good.PAGES[0].fine = true;
  assert.ok(await runSuite(bad) > 0, "a check returning a string did not count");
  assert.equal(await runSuite(good), 0, "a check returning null counted");
});

test("a page whose fake records a failed request produces a failure naming the file", async (t) => {
  // The listener has to be attached before goto() resolves, or it misses the failure — so
  // the fake fires it from inside its own goto(), the same order a real failed request
  // would arrive in: after page.on("requestfailed", ...) has already run.
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  t.after(() => { globalThis.fetch = real; });
  const realLog = console.log;
  const lines = [];
  console.log = (s) => lines.push(s);
  t.after(() => { console.log = realLog; });

  const page = {
    async goto() {
      page._onRequestFailed?.({ url: () => "https://x.test/broken.png" });
      return { ok: () => true, status: () => 200 };
    },
    async close() {}, async evaluate() { return null; }, async $() { return null; },
    on(event, cb) { if (event === "requestfailed") page._onRequestFailed = cb; },
    context: () => ({ browser: () => browser }),
  };
  const browser = { async newPage() { return page; }, async close() {} };
  const o = OPTS(); o.browser = browser;

  assert.ok(await runSuite(o) > 0, "a failed request did not count as a failure");
  assert.ok(lines.some(l => l.includes("failed requests: broken.png")),
    "the failure did not name the file that failed");
});

test("a page with no failed requests is not marked as one", async (t) => {
  // The counter-example to the test above: the default fake page's on() is a no-op, so the
  // requestfailed listener is registered but never invoked, and `missing` stays empty.
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  t.after(() => { globalThis.fetch = real; });
  assert.equal(await runSuite(OPTS()), 0, "a page with no failed requests still failed");
});

test("the fonts wait happens after the page loads and before checks run", async (t) => {
  // This is the one that matters most: a check that measures text is measuring an unstyled
  // page unless the fonts wait runs between goto() and the CHECKS loop. Asserting on source
  // text (e.g. that the words "fonts.ready" appear before the loop) would pass even if the
  // call were dead code that never executed, or moved into a branch nothing here takes — so
  // instead the fake records the order it is actually called in, and the assertion is on
  // that recording, not on where a line sits in the file.
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  t.after(() => { globalThis.fetch = real; });

  const order = [];
  // The runner calls evaluate() twice — once for the fonts wait, once (added by the shared-node
  // check) to collect the page's JSON-LD after CHECKS closes — so this fake counts calls and
  // labels each by position, rather than recording every evaluate() as the same word. That
  // keeps the assertion below able to prove both that the fonts wait runs where it should and
  // that graph collection runs exactly once, exactly after the checks — the full call sequence
  // the runner makes of a page, not just a subsequence of it.
  let evalCalls = 0;
  const page = {
    async goto() { order.push("goto"); return { ok: () => true, status: () => 200 }; },
    async close() {},
    async evaluate() { order.push(++evalCalls === 1 ? "fonts" : "graph"); return null; },
    async $() { return null; }, on() {}, context: () => ({ browser: () => browser }),
  };
  const browser = { async newPage() { return page; }, async close() {} };

  const o = OPTS();
  o.browser = browser;
  o.CHECKS = { ordering: async () => { order.push("check"); return null; } };
  o.PAGES[0].ordering = true;

  await runSuite(o);
  assert.deepEqual(order, ["goto", "fonts", "check", "graph"],
    "the runner's call sequence to a page no longer matches goto, fonts, checks, graph");
});

test("runSuite returns rather than exiting", async (t) => {
  // process.exit in a library makes it untestable and takes the decision away from the
  // caller. A match against runSuite.toString() for the literal text "process.exit" would
  // still pass if that call were dead, unreachable code that behavior never touches —
  // source text present, behavior unaffected. The module-scope recorder installed above
  // covers every runSuite call this file makes, including this test's own two; asserting it
  // is still empty here tests what actually happened across the whole file, not just what
  // this test's own body did.
  const real = globalThis.fetch;
  globalThis.fetch = fakeFetch();
  t.after(() => { globalThis.fetch = real; });

  await runSuite(OPTS());

  const bad = OPTS();
  bad.CHECKS = { boom: async () => "it broke" };
  bad.PAGES[0].boom = true;
  await runSuite(bad);

  assert.deepEqual(exitCalls, [], "process.exit was called during this file's runSuite calls");
});

// One node, described the same way twice. `node()` builds the JSON-LD text a page would carry.
const node = (over = {}) => ({
  "@type": "WebSite", "@id": "https://x.test/#website", name: "X", ...over,
});
const graph = (...nodes) => [JSON.stringify({ "@context": "https://schema.org", "@graph": nodes })];

const TWO_PAGES = (a, b) => {
  const o = OPTS();
  o.PAGES = [
    { path: "/", seo: true, tokenVersion: true, fences: ["design tokens"], typography: true },
    { path: "/two/", seo: true, tokenVersion: true, fences: ["design tokens"], typography: true },
  ];
  o.browser = fakeBrowser([a, b]);
  return o;
};

const TWO_PAGE_FETCH = () => fakeFetch({
  "/two/": "<html></html>",
  "/sitemap.xml": `<urlset><loc>https://x.test/</loc><loc>https://x.test/two/</loc></urlset>`,
});

test("two pages describing one id the same way pass", async (t) => {
  const real = globalThis.fetch;
  globalThis.fetch = TWO_PAGE_FETCH();
  t.after(() => { globalThis.fetch = real; });
  assert.equal(await runSuite(TWO_PAGES(graph(node()), graph(node()))), 0);
});

test("two pages describing one id differently is a failure", async (t) => {
  // The drift this exists to catch: one page's copy of a shared node gained a field and the
  // other's did not, which no per-page check can see because neither page is wrong alone.
  const real = globalThis.fetch;
  globalThis.fetch = TWO_PAGE_FETCH();
  t.after(() => { globalThis.fetch = real; });
  const o = TWO_PAGES(graph(node()), graph(node({ sameAs: ["https://elsewhere.test/"] })));
  assert.ok(await runSuite(o) > 0, "a split node passed");
});

test("key order alone is not a disagreement", async (t) => {
  // Compared on a canonical form, because two pages that order one node's keys differently
  // describe the same thing and failing that would be noise rather than a finding.
  const real = globalThis.fetch;
  globalThis.fetch = TWO_PAGE_FETCH();
  t.after(() => { globalThis.fetch = real; });
  const a = [JSON.stringify({ "@context": "https://schema.org", "@graph": [
    { "@type": "WebSite", "@id": "https://x.test/#website", name: "X" }] })];
  const b = [JSON.stringify({ "@context": "https://schema.org", "@graph": [
    { name: "X", "@id": "https://x.test/#website", "@type": "WebSite" }] })];
  assert.equal(await runSuite(TWO_PAGES(a, b)), 0);
});

test("a pointer is not compared against the node it points at", async (t) => {
  // A bare { "@id": … } describes nothing, and pages.mjs already requires every pointer to
  // resolve inside its own document. Comparing them here would report that twice.
  const real = globalThis.fetch;
  globalThis.fetch = TWO_PAGE_FETCH();
  t.after(() => { globalThis.fetch = real; });
  const withPointer = [JSON.stringify({ "@context": "https://schema.org", "@graph": [
    node(),
    { "@type": "WebPage", "@id": "https://x.test/two/#webpage", isPartOf: { "@id": "https://x.test/#website" } },
  ] })];
  assert.equal(await runSuite(TWO_PAGES(graph(node()), withPointer)), 0);
});

test("a node inlined under a property is still compared", async (t) => {
  // companygraph.io's DefinedTerms hang off hasDefinedTerm rather than sitting at the top of
  // @graph, and pages.mjs already treats a node inlined that way as a definition in its own
  // right. A rule that says "wherever its @id appears" has to reach there too, or the same
  // drift this check exists to catch could hide one property deep.
  const real = globalThis.fetch;
  globalThis.fetch = TWO_PAGE_FETCH();
  t.after(() => { globalThis.fetch = real; });
  const term = (over = {}) => ({
    "@type": "DefinedTerm", "@id": "https://x.test/#glossary-x", name: "X", ...over,
  });
  const withTerm = (d) => [JSON.stringify({ "@context": "https://schema.org", "@graph": [
    { ...node(), hasDefinedTerm: d },
  ] })];
  const o = TWO_PAGES(withTerm(term()), withTerm(term({ description: "changed" })));
  // An exact count, not merely > 0: the inlined term sits inside the outer WebSite node's own
  // object, so changing the term also changes the container's canonical form. A looser
  // assertion would pass on the container's own split alone, whether or not the walk ever
  // reached inside it — which is exactly the gap this test exists to close. Two failures means
  // both the container and the inlined node were reported; one would mean the walk never
  // looked inside.
  assert.equal(await runSuite(o), 2,
    "with the walk both the container and the inlined node are reported; only the container " +
    "means the walk never reached inside");
});
