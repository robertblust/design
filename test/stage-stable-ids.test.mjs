// The stage on a model whose entities carry stable ids, in Chromium. Where a page sits is its
// address and which entity it is, its id: the canvas, the breadcrumb and the hash are built from
// the address, every edge is followed by the id, and a hash or a message may name either. The
// model is the stage fixture with UUID ids beside path addresses, so reading the wrong one of the
// two fails here; stage-model.json, with no address, keeps the fallback covered by the other
// stage tests.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { chromium } from "playwright";
import { modelPage, stageFiles } from "./fixtures/stage-page.mjs";
import { STABLE_MODEL, idAt } from "./fixtures/stable-ids.mjs";
import { STAGE_CHECKS } from "../verify/stage.mjs";

const PARENT = (hash) => `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>
<script>window.got = []; addEventListener("message", (e) => { if (e.origin === location.origin) window.got.push(e.data); });</script>
<iframe id="f" src="/model/?stage=expanded&embed#${hash}" style="width:1000px;height:700px;border:0"></iframe></body></html>`;
let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    const files = {
      "/model/": ["text/html", modelPage()],
      "/site/": ["text/html", modelPage({ extra: "<style>main{max-width:1100px;margin:0 auto}</style>" })],
      "/parent": ["text/html", PARENT("concepts/guest")],
      ...stageFiles({ model: JSON.stringify(STABLE_MODEL) }),
    };
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": hit[0], "cache-control": "no-store" }); res.end(hit[1]);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

async function page(address) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const p = await context.newPage();
  await p.goto(base + address);
  await p.waitForSelector("#fig g.n");
  return { p, close: () => context.close() };
}
const pathOf = (p) => p.$eval("#path", (e) => e.textContent);
const focusOf = (p) => p.$eval("#fig g.n.focus", (n) => n.getAttribute("data-id"));
const hashOf = (p) => p.evaluate(() => decodeURIComponent(location.hash.slice(1)));

test("the fixture's ids and addresses are two different strings", () => {
  const shape = STABLE_MODEL.entities.find((e) => e.address === "processes/delivery/phases/shape");
  assert.match(shape.id, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(shape.owner, idAt("processes/delivery"));
});

test("a folder hash lands on the folder, with its breadcrumb", async () => {
  const { p, close } = await page("/model/#concepts");
  assert.equal(await pathOf(p), "concepts");
  assert.equal(await focusOf(p), "concepts");
  await close();
});

test("an owned folder's hash lands three levels down, with its breadcrumb and its pages", async () => {
  const { p, close } = await page("/model/#processes/delivery/phases");
  assert.equal(await pathOf(p), "processes / delivery / phases");
  assert.equal(await focusOf(p), "processes/delivery/phases");
  assert.equal(await p.$eval("#card .eyebrow", (e) => e.textContent), "processes/delivery/phases");
  assert.match(await p.$eval("#card .empty", (e) => e.textContent), /^2 /);
  const drawn = await p.$$eval("#fig g.n", (ns) => ns.map((n) => n.getAttribute("data-id")));
  for (const at of ["root", "processes", "processes/delivery", "processes/delivery/phases/shape", "processes/delivery/phases/build"])
    assert.ok(drawn.includes(at), `${at} is not on the canvas: ${drawn}`);
  await close();
});

test("an entity's address, as a hand-written link carries it, opens the entity as before", async () => {
  const { p, close } = await page("/model/?stage=expanded#concepts/guest");
  assert.equal(await pathOf(p), "concepts / guest");
  assert.equal(await hashOf(p), "concepts/guest");
  assert.equal(await p.$eval("#card h3", (e) => e.textContent), "Guest");
  await close();
});

test("an id hash opens the entity and is written back as its address, in place", async () => {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const p = await context.newPage();
  await p.goto(base + "/model/");
  await p.waitForSelector("#fig g.n");
  await p.goto(base + "/model/#" + idAt("processes/delivery/phases/shape"));
  await p.waitForSelector("#fig g.n.focus");
  assert.equal(await pathOf(p), "processes / delivery / phases / shape");
  assert.equal(await p.$eval("#card h3", (e) => e.textContent), "Shape");
  assert.equal(await hashOf(p), "processes/delivery/phases/shape");
  // The same page's hash moved by an id: the entity opens, the hash says its address, and the
  // rewrite added nothing to the history beyond the one step the hash itself took.
  const before = await p.evaluate(() => history.length);
  await p.evaluate((id) => { location.hash = "#" + id; }, idAt("concepts/guest"));
  await p.waitForFunction(() => document.getElementById("path").textContent === "concepts / guest");
  assert.equal(await hashOf(p), "concepts/guest");
  assert.equal(await p.evaluate(() => history.length), before + 1);
  // Back returns to the phase by its address.
  await p.goBack();
  await p.waitForFunction(() => document.getElementById("path").textContent === "processes / delivery / phases / shape");
  await context.close();
});

test("the root's id in a hash focuses the root", async () => {
  const { p, close } = await page("/model/#" + STABLE_MODEL.rootId);
  assert.equal(await focusOf(p), "root");
  assert.equal(await hashOf(p), "");
  await close();
});

test("edges are followed by id and drawn between addresses, and a card's links name the address", async () => {
  const { p, close } = await page("/model/#processes/delivery/phases/shape");
  const refs = await p.$$eval('#fig .ref[data-from="processes/delivery/phases/shape"]', (ls) => ls.map((l) => l.getAttribute("data-to")).sort());
  assert.deepEqual(refs, ["concepts/guest", "processes/delivery/phases/build"]);
  const hrefs = await p.$$eval("#card a.go", (as) => as.map((a) => a.getAttribute("href")).sort());
  assert.deepEqual(hrefs, ["#concepts/guest", "#processes/delivery/phases/build"]);
  // Followed, a card's link moves the focus to the entity it names.
  await p.click('#card a.go[href="#concepts/guest"]');
  await p.waitForFunction(() => document.getElementById("path").textContent === "concepts / guest");
  // And the other way: what refers to the guest is drawn in, by address.
  assert.ok(await p.$('#fig .ref[data-from="processes/delivery/phases/shape"][data-to="concepts/guest"]'), "the referrer is not drawn");
  await close();
});

test("the parent may focus an embedded stage by id or by address", async () => {
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const p = await context.newPage();
  await p.goto(base + "/parent");
  await p.waitForFunction(() => window.got.some((m) => m && m.type === "rb-graph-ready"));
  const f = p.frame({ url: /\/model\// });
  const post = (id) => p.evaluate((id) => document.getElementById("f").contentWindow.postMessage({ type: "rb-graph-focus", id }, location.origin), id);
  await post(idAt("processes/delivery/phases/build"));
  await f.waitForFunction(() => document.getElementById("path").textContent === "processes / delivery / phases / build");
  assert.equal(await f.evaluate(() => decodeURIComponent(location.hash.slice(1))), "processes/delivery/phases/build");
  await post("processes/delivery");
  await f.waitForFunction(() => document.getElementById("path").textContent === "processes / delivery");
  await context.close();
});

for (const name of ["graph", "divider"]) {
  test(`the site check "${name}" passes on a model whose entities carry stable ids`, { timeout: 60000 }, async () => {
    const { p, close } = await page("/site/");
    assert.equal(await STAGE_CHECKS[name](p, { absolute: base + "/site/" }) ?? null, null);
    await close();
  });
}
