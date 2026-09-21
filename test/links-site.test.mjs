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
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chromium } from "playwright";

import { collect } from "../verify/links/collect.mjs";
import { checkOwn } from "@robertblust/design/verify/links";

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

const CLI = path.join(path.dirname(HERE), "bin", "design.mjs");

// Async, so the server in this process keeps answering while the CLI runs.
async function cli(args, cwd, env = {}) {
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, [CLI, ...args], { cwd, env: { ...process.env, ...env } });
    return { code: 0, stdout, stderr };
  } catch (e) {
    return { code: e.code, stdout: e.stdout, stderr: e.stderr };
  }
}

function copyFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "design-links-site-"));
  fs.cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

test("every own link that does not land is named once, with where it was found", async () => {
  const lines = [];
  const { failures } = await checkOwn({ root: FIXTURE, base: served.base, chromium, log: (l) => lines.push(l) });
  assert.deepEqual(failures.map((f) => [f.link, f.reason, f.from]), [
    ["/fonts/missing.woff2", "no file here", ["/"]],
    ["/gone/", "no page here", ["model.json · things/b"]],
    ["/missing/", "no page here", ["/"]],
    ["/model/#things/nope", "no node things/nope in model.json", ["/"]],
    ["/model/#things/void", "no node things/void in model.json", ["/model/ (card)"]],
    ["/model/?stage=expanded#things/ghost", "no node things/ghost in model.json", ["/"]],
    ["/model/?stage=expanded#things/lost", "no node things/lost in model.json", ["/ledger/ (card)"]],
    ["/nodata/#things/a", "/nodata/ draws a stage and names no data, so #things/a cannot be drawn", ["/"]],
    ["/noopener/", "carries a <link data-stage> and none of #openall, .openall, .ln-s or #stage, so its cards cannot be opened", ["/noopener/"]],
    ["/og.png", "no file here", ["/"]],
    ["/slides.pdf", "no file here", ["/talks/deck/"]],
    ["/about/#nobody", "no element with id nobody on /about/", ["/"]],
  ].sort((a, b) => a[0].localeCompare(b[0])));
  assert.match(lines.join("\n"), /12 own link\(s\) do not resolve/);
});

test("the CLI fails on a wrong STAGE_PAGE and passes once it is set back", async () => {
  // The spec's positive control, on the fixture: Surfaces's card links are the gap v0.68.0 left.
  const dir = copyFixture();
  for (const drop of ["missing", "nodata", "noopener", "talks"]) fs.rmSync(path.join(dir, drop), { recursive: true, force: true });
  fs.writeFileSync(path.join(dir, "og.png"), "");
  fs.writeFileSync(path.join(dir, "fonts", "missing.woff2"), "");
  fs.mkdirSync(path.join(dir, "gone")); fs.writeFileSync(path.join(dir, "gone", "index.html"), "<!doctype html><title>Gone</title>");
  const html = (rel) => path.join(dir, rel);
  fs.writeFileSync(html("index.html"), `<!doctype html><title>Clean</title><link rel="stylesheet" href="style.css"><a href="about/#team">about</a><a href="lineage/">lineage</a><a href="model/#things">model</a><a href="og.png">card</a><a href="gone/">gone</a>`);
  fs.writeFileSync(html("model.json"), JSON.stringify({ rootId: "root", entities: [{ id: "root", see: [] }, { id: "things/a", see: ["things/b"] }, { id: "things/b", see: [] }] }));
  fs.writeFileSync(html("ledger/index.html"), fs.readFileSync(html("ledger/index.html"), "utf8").replace("things/lost", "things/a"));
  const s = await serve(dir);
  try {
    const clean = await cli(["links", "--base", s.base], dir);
    assert.equal(clean.code, 0, clean.stdout + clean.stderr);
    assert.match(clean.stdout, /✓ every own link resolves/);

    const lineage = html("lineage/index.html");
    fs.writeFileSync(lineage, fs.readFileSync(lineage, "utf8").replace('var STAGE_PAGE = "../model/";', 'var STAGE_PAGE = "../nowhere/";'));
    const wrong = await cli(["links", "--base", s.base], dir);
    assert.equal(wrong.code, 1);
    assert.match(wrong.stdout, /✗ \/nowhere\/\?stage=expanded#things\/a {2}no page here\n {6}from \/lineage\/ \(card\)/);

    fs.writeFileSync(lineage, fs.readFileSync(lineage, "utf8").replace('"../nowhere/"', '"../model/"'));
    assert.equal((await cli(["links", "--base", s.base], dir)).code, 0);
  } finally {
    await s.close();
  }
});

test("the CLI fails when it checked nothing, and names why", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "design-links-bare-"));
  fs.writeFileSync(path.join(dir, "CNAME"), "fixture.test\n");
  fs.writeFileSync(path.join(dir, "sitemap.xml"), "<urlset></urlset>");
  const s = await serve(dir);
  try {
    const none = await cli(["links", "--base", s.base], dir);
    assert.equal(none.code, 1);
    assert.match(none.stderr, /no page named by sitemap\.xml is in this checkout/);
  } finally {
    await s.close();
  }
  const down = await cli(["links", "--base", "http://127.0.0.1:9"], FIXTURE);
  assert.equal(down.code, 1);
  assert.match(down.stderr, /nothing answers at http:\/\/127\.0\.0\.1:9/);
  assert.equal((await cli(["links", "--base"], FIXTURE)).code, 2);
});
