// The link checker against a site served over http and read by a real browser. A card's links
// exist only after a script wrote them and a fragment may name an element a script made, so a fake
// browser would test a fake site. The fixture under test/fixtures/links holds one of each case the
// spec names; the expectations below are the whole of what it should find.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import { collect } from "../verify/links/collect.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, "fixtures", "links");

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };

// A static server shaped like GitHub Pages: a folder is served from its index.html, a folder asked
// for without its slash is redirected to it, and anything missing is a 404.
export function serve(root) {
  const server = http.createServer((req, res) => {
    const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(root, p);
    const st = fs.statSync(file, { throwIfNoEntry: false });
    if (st?.isDirectory() && !p.endsWith("/")) { res.writeHead(301, { location: `${p}/` }); res.end(); return; }
    if (st?.isDirectory()) file = path.join(file, "index.html");
    if (!fs.statSync(file, { throwIfNoEntry: false })?.isFile()) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({
    base: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
  })));
}

let site, served;
before(async () => {
  served = await serve(FIXTURE);
  site = await collect({ root: FIXTURE, base: served.base, chromium });
});
after(() => served.close());

const where = (href) => [...(site.found.get(href) ?? [])].sort();

test("every page the sitemap names is loaded, and every own page they reach", () => {
  assert.deepEqual([...site.pages.keys()].sort(), [
    "/", "/about/", "/ledger/", "/lineage/", "/model/", "/nodata/", "/noopener/", "/talks/deck/",
  ]);
  assert.ok(!site.pages.has("/missing/"), "a page not in the checkout is not loaded");
});

test("what a page says about itself is kept for the resolver", () => {
  assert.ok(site.pages.get("/about/").ids.has("late"), "ids are read after scripts ran");
  assert.deepEqual({ ...site.pages.get("/model/"), ids: undefined }, { ids: undefined, stage: true, data: "model.json" });
  assert.deepEqual({ ...site.pages.get("/nodata/"), ids: undefined }, { ids: undefined, stage: true, data: null });
  assert.equal(site.pages.get("/ledger/").stage, false, "reading the model is not drawing a stage");
  assert.equal(site.pages.get("/ledger/").data, "model.json");
});

test("links are read from the markup, the head, JSON-LD and the stylesheets", () => {
  const o = served.base;
  assert.deepEqual(where(`${o}/missing/`), ["/"]);
  assert.deepEqual(where("https://fixture.test/og.png"), ["/"]);
  assert.deepEqual(where("https://example.org/elsewhere"), ["/"]);
  assert.deepEqual(where(`${o}/fonts/missing.woff2`), ["/"]);
  assert.deepEqual(where(`${o}/fonts/present.woff2`), ["/"]);
  assert.deepEqual(where(`${o}/slides.pdf`), ["/talks/deck/"], "a deck the sitemap does not name is still read");
  assert.deepEqual(where("https://fixture.test/"), ["/", "sitemap.xml"]);
  assert.ok(site.found.has("mailto:someone@example.org"), "found, and left to the resolver to skip");
});

test("every card is opened, by Open all, by each item, and by each node of a stage", () => {
  const o = served.base;
  assert.deepEqual(where(`${o}/model/?stage=expanded#things/b`), ["/ledger/ (card)", "/lineage/ (card)"]);
  assert.deepEqual(where(`${o}/model/?stage=expanded#things/lost`), ["/ledger/ (card)"]);
  assert.deepEqual(where(`${o}/model/?stage=expanded#things/a`), ["/", "/lineage/ (card)"]);
  assert.deepEqual(where(`${o}/model/#things/b`), ["/model/ (card)"]);
  assert.deepEqual(where(`${o}/model/#things/void`), ["/model/ (card)"]);
});

test("a page that reads the model and opens no card is a problem, not a silence", () => {
  assert.deepEqual(site.problems, [{
    link: "/noopener/",
    reason: "carries a <link data-stage> and none of #openall, .openall, .ln-s or #stage, so its cards cannot be opened",
    from: ["/noopener/"],
  }]);
});

test("the model's URL strings are found, with the entity each sits in", () => {
  assert.deepEqual(where("https://example.org/reference"), ["model.json · things/a"]);
  assert.deepEqual(where("https://fixture.test/gone/"), ["model.json · things/b"]);
  assert.ok(site.idsOf("model.json").has("things"));
});

test("a site that is not served, or whose sitemap names nothing here, is an error", async () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "design-links-empty-"));
  fs.writeFileSync(path.join(empty, "CNAME"), "fixture.test\n");
  fs.writeFileSync(path.join(empty, "sitemap.xml"), "<urlset><url><loc>https://fixture.test/gone/</loc></url></urlset>");
  const s = await serve(empty);
  await assert.rejects(collect({ root: empty, base: s.base, chromium }), /no page named by sitemap\.xml is in this checkout/);
  await s.close();
  await assert.rejects(collect({ root: FIXTURE + "-nowhere", base: served.base, chromium }), /CNAME and sitemap\.xml/);
});
