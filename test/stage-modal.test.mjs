// The model page's own Expand, in Chromium: it opens the family's one modal holding the stage,
// titled by the focus, keeps the page behind still, and gives the stage back to the page.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { chromium } from "playwright";
import { modelPage, stageFiles } from "./fixtures/stage-page.mjs";
import { STAGE_CHECKS } from "../verify/stage.mjs";

let server, base, browser;
before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    // /site/ is the page in a column as a site lays it out, so Expand has room to widen it,
    // which the site checks below hold it to.
    const files = { "/model/": ["text/html", modelPage()], "/site/": ["text/html", modelPage({ extra: "<style>main{max-width:1100px;margin:0 auto}</style>" })], ...stageFiles() };
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
const order = (p) => p.evaluate(() => [...document.querySelector(".figure-section").children].map((e) => e.id || e.className));

test("on the model page, Expand opens the one modal holding the stage, titled by the focus, and gives it back", async () => {
  const { p, close } = await page("/model/#concepts/guest");
  const before = await order(p);
  await p.click("#expand");
  await p.waitForSelector("dialog.rbmodal[open]");
  const s = await p.evaluate(() => { const d = document.querySelector("dialog.rbmodal[open]"); return { fig: d.contains(document.getElementById("fig")), card: d.contains(document.getElementById("card")), title: d.querySelector(".rbmodal-title").textContent, old: document.getElementById("stagemodal").open }; });
  assert.deepEqual(s, { fig: true, card: true, title: "graph · Guest", old: false });
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => !document.querySelector("dialog.rbmodal[open]"));
  assert.deepEqual(await order(p), before, "the stage did not go back where it stood");
  await close();
});

test("the modal's title follows the focus as the visitor walks the graph", async () => {
  const { p, close } = await page("/model/#concepts/guest");
  await p.click("#expand");
  await p.waitForSelector("dialog.rbmodal[open]");
  await p.click("dialog.rbmodal #fig g.n:not(.focus):not(.ancestor) >> nth=0");
  await p.waitForFunction(() => document.querySelector("dialog.rbmodal .rbmodal-title").textContent !== "graph · Guest");
  await close();
});

test("arriving with ?stage=expanded opens the modal on the node, with a clean address and no lit close", async () => {
  const { p, close } = await page("/model/?stage=expanded#concepts/merge");
  await p.waitForSelector("dialog.rbmodal[open]");
  const s = await p.evaluate(() => ({ search: location.search, focus: (document.querySelector("#fig .n.focus") || {}).dataset.id, lit: !!(document.activeElement && document.activeElement.classList.contains("rbmodal-close")), title: document.querySelector("dialog.rbmodal .rbmodal-title").textContent }));
  assert.deepEqual(s, { search: "", focus: "concepts/merge", lit: false, title: "graph · Merge" });
  await close();
});

test("the page behind the expanded stage does not scroll", async () => {
  const { p, close } = await page("/model/#concepts/guest");
  await p.click("#expand");
  await p.waitForSelector("dialog.rbmodal[open]");
  assert.equal(await p.evaluate(() => getComputedStyle(document.documentElement).overflow), "hidden");
  await close();
});

// The checks every site runs on its model page, run here on the fixture, so a change that
// would turn the three sites red on their next re-pin turns this suite red first.
for (const name of ["graph", "divider"]) {
  test(`the site check "${name}" passes on a model page whose Expand opens the one modal`, { timeout: 60000 }, async () => {
    const { p, close } = await page("/site/");
    assert.equal(await STAGE_CHECKS[name](p, { absolute: base + "/site/" }) ?? null, null);
    await close();
  });
}

test("the modal's title follows the page's language while it is open", async () => {
  const { p, close } = await page("/model/#concepts/guest");
  await p.click("#expand");
  await p.waitForSelector("dialog.rbmodal[open]");
  await p.evaluate(() => { document.documentElement.lang = "de"; });
  await p.waitForFunction(() => document.querySelector("dialog.rbmodal .rbmodal-title").textContent === "Graph · Guest");
  await close();
});

test("Expand opened and closed again and again keeps one modal", async () => {
  const { p, close } = await page("/model/#concepts/guest");
  for (let i = 0; i < 3; i++) { await p.click("#expand"); await p.waitForSelector("dialog.rbmodal[open]"); await p.keyboard.press("Escape"); await p.waitForFunction(() => !document.querySelector("dialog.rbmodal[open]")); }
  assert.equal(await p.evaluate(() => document.querySelectorAll("dialog.rbmodal").length), 1);
  await close();
});

test("where modal.js cannot be fetched, Expand still opens the stage, in the page's own dialog", async () => {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  const p = await context.newPage();
  await p.route("**/modal.js", (r) => r.abort());
  await p.goto(base + "/model/#concepts/guest");
  await p.waitForSelector("#fig g.n");
  const before = await order(p);
  await p.click("#expand");
  await p.waitForSelector("dialog#stagemodal[open]", { timeout: 5000 });
  assert.equal(await p.evaluate(() => document.getElementById("stagemodal").contains(document.getElementById("fig"))), true);
  await p.keyboard.press("Escape");
  // The page's own dialog gives the stage back on its close event, a task after it closes.
  await p.waitForFunction(() => document.querySelector(".figure-section").firstElementChild.id === "stagehead");
  assert.deepEqual(await order(p), before);
  await context.close();
});
