import { test } from "node:test";
import assert from "node:assert/strict";
import { runSuite } from "@robertblust/design/verify/suite";

// A page that answers the handful of calls the runner makes of it, and records nothing else.
// Checks themselves are supplied by the test, so this only has to be good enough to get the
// loop running.
function fakePage() {
  return {
    // The runner's own gate is `if (!res || !res.ok())`, so the stub's response must satisfy
    // it — an empty goto() answers "no response" on every single run, which is not the clean
    // pass the "clean site" test needs.
    async goto() { return { ok: () => true, status: () => 200 }; },
    async close() {}, async evaluate() { return null; },
    async $() { return null; }, on() {}, context: () => ({ browser: () => fakeBrowser() }),
  };
}
function fakeBrowser() {
  return { async newPage() { return fakePage(); }, async close() {} };
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
  PAGES: [{ path: "/", seo: true, tokenVersion: true, fences: ["design tokens"] }],
  CHECKS: {}, systemFaces: new Set(["plex mono", "monospace"]),
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
  const o = OPTS(); o.PAGES = [{ path: "/", tokenVersion: true, fences: [] }];
  assert.ok(await runSuite(o) > 0, "a page without seo passed");
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
  o.PAGES = [{ path: "/about/", seo: true, tokenVersion: true, fences: ["design tokens"] }];
  assert.ok(await runSuite(o) > 0, "a sitemap naming another site passed");
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

test("runSuite returns rather than exiting", () => {
  // process.exit in a library makes it untestable and takes the decision away from the caller.
  assert.doesNotMatch(runSuite.toString(), /process\.exit/);
});
