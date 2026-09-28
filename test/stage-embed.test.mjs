// A model page embedded in another page's dialog, in Chromium: it shows its expanded stage
// alone, keeps its history to itself, and talks to its parent in four same-origin messages.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { chromium } from "playwright";
import { modelPage, stageFiles } from "./fixtures/stage-page.mjs";

const ID_A = "concepts/guest", ID_B = "concepts/merge";
const PARENT = `<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>
<script>window.got = []; addEventListener("message", (e) => { if (e.origin === location.origin) window.got.push(e.data); });</script>
<iframe id="f" src="/model/?stage=expanded&embed#${ID_A}" style="width:1000px;height:700px;border:0"></iframe></body></html>`;
let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    const files = { "/model/": ["text/html", modelPage()], "/parent": ["text/html", PARENT], ...stageFiles() };
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": hit[0], "cache-control": "no-store" }); res.end(hit[1]);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

async function parent() {
  const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const p = await context.newPage();
  await p.goto(base + "/parent");
  await p.waitForFunction(() => window.got.some((m) => m && m.type === "rb-graph-ready"));
  const f = p.frame({ url: /\/model\// });
  return { p, f, close: () => context.close() };
}
const pathOf = (f) => f.$eval("#path", (e) => e.textContent);
const shown = (f, sel) => f.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return getComputedStyle(e).visibility !== "hidden" && getComputedStyle(e).display !== "none" && r.width > 0 && r.height > 0; });

test("an embedded page shows the expanded stage alone, focused where its address says", async () => {
  const { f, close } = await parent();
  assert.equal(await f.evaluate(() => document.documentElement.hasAttribute("data-embed")), true);
  assert.equal(await f.$eval("#stagemodal", (d) => d.open), true, "the stage did not open expanded");
  assert.equal(await shown(f, "#siteheader"), false, "the page's header shows");
  assert.equal(await shown(f, "#sitefooter"), false, "the page's footer shows");
  assert.equal(await shown(f, "#fig"), true, "the stage does not show");
  assert.equal(await f.$eval("#expand", (b) => getComputedStyle(b).display), "none");
  assert.equal(await f.$eval("#stagemodal", (d) => { const r = d.getBoundingClientRect(); return r.right <= innerWidth && r.bottom <= innerHeight; }), true, "the stage falls outside the frame");
  assert.equal(await pathOf(f), "concepts / guest");
  assert.equal(await f.evaluate(() => !!document.querySelector(".rbchat-open")), false);
  await close();
});

test("the stage's × stands down, and its close and Escape ask the parent to close, leaving the stage open", async () => {
  const { p, f, close } = await parent();
  assert.equal(await f.$eval("#modalclose", (b) => getComputedStyle(b).display), "none", "the stage shows a second close");
  await f.$eval("#modalclose", (b) => b.click());
  await p.waitForFunction(() => window.got.filter((m) => m.type === "rb-graph-close").length === 1);
  assert.equal(await f.$eval("#stagemodal", (d) => d.open), true);
  await f.focus("#stagemodal");
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => window.got.filter((m) => m.type === "rb-graph-close").length === 2);
  assert.equal(await f.$eval("#stagemodal", (d) => d.open), true);
  await close();
});

test("the parent moves the focus by message, and nothing the stage does adds to the tab's history", async () => {
  const { p, f, close } = await parent();
  const before = await p.evaluate(() => history.length);
  await p.evaluate((id) => document.getElementById("f").contentWindow.postMessage({ type: "rb-graph-focus", id }, location.origin), ID_B);
  await f.waitForFunction(() => document.getElementById("path").textContent === "concepts / merge");
  for (let i = 0; i < 2; i++) {
    const was = await pathOf(f);
    await f.click("#fig g.n:not(.focus):not(.ancestor) >> nth=0");
    await f.waitForFunction((w) => document.getElementById("path").textContent !== w, was);
  }
  const was = await pathOf(f);
  await f.click(".history .back");
  await p.waitForTimeout(250);
  assert.notEqual(await pathOf(f), was, "the stage's back control did not move the focus");
  assert.equal(await p.evaluate(() => history.length), before, "the stage wrote to the tab's history");
  assert.ok(await f.evaluate(() => location.hash.length > 1), "the frame's address does not name the focus");
  await close();
});

test("the frame is ready once it has focused, and an unknown id focuses the root", async () => {
  const { p, f, close } = await parent();
  assert.ok(await p.evaluate(() => window.got.some((m) => m.type === "rb-graph-ready")));
  await p.evaluate(() => document.getElementById("f").contentWindow.postMessage({ type: "rb-graph-focus", id: "nothing/here" }, location.origin));
  await f.waitForFunction(() => document.getElementById("path").textContent !== "concepts / guest");
  assert.equal((await pathOf(f)).includes("/"), false, "an unknown id did not focus the root");
  await close();
});

test("a message from another origin is ignored", async () => {
  const { p, f, close } = await parent();
  const was = await pathOf(f);
  await f.evaluate((id) => window.dispatchEvent(new MessageEvent("message", { data: { type: "rb-graph-focus", id }, origin: "https://elsewhere.example" })), ID_B);
  await p.waitForTimeout(250);
  assert.equal(await pathOf(f), was);
  await close();
});

test("the parent's look reaches the frame", async () => {
  const { p, f, close } = await parent();
  await p.evaluate(() => document.getElementById("f").contentWindow.postMessage({ type: "rb-graph-look", theme: "light", lang: "de" }, location.origin));
  await f.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "light" && document.documentElement.lang === "de");
  await close();
});

// ─── The final review's findings ─────────────────────────────────────────────────────────
test("the embed flag is set even where site data is blocked", async () => {
  const context = await browser.newContext();
  await context.addInitScript(() => { Object.defineProperty(window, "localStorage", { get(){ throw new DOMException("blocked", "SecurityError"); } }); });
  const p = await context.newPage();
  await p.goto(base + "/parent");
  const f = await (await p.waitForSelector("#f")).contentFrame();
  await f.waitForFunction(() => document.readyState !== "loading");
  assert.equal(await f.evaluate(() => document.documentElement.hasAttribute("data-embed")), true);
  await context.close();
});

test("the page's look reaches its own static text, through the page's applyLang", async () => {
  const { p, f, close } = await parent();
  await p.evaluate(() => document.getElementById("f").contentWindow.postMessage({ type: "rb-graph-look", theme: "dark", lang: "de" }, location.origin));
  await f.waitForFunction(() => document.documentElement.getAttribute("data-applied") === "de");
  await close();
});

test("the frame tells its parent where the focus is, by the node's own name", async () => {
  const { p, close } = await parent();
  await p.evaluate(() => document.getElementById("f").contentWindow.postMessage({ type: "rb-graph-focus", id: "nothing/here" }, location.origin));
  await p.waitForFunction(() => window.got.some((m) => m.type === "rb-graph-at" && m.title === "GuestGraph"));
  assert.ok(await p.evaluate(() => window.got.some((m) => m.type === "rb-graph-at" && m.title === "Guest")), "the first focus was not told");
  await close();
});

test("a page opened on its own with embed in its address is an ordinary page", async () => {
  const context = await browser.newContext();
  const p = await context.newPage();
  await p.goto(base + "/model/?stage=expanded&embed#concepts/guest");
  await p.waitForSelector("#stagemodal[open]");
  assert.equal(await p.evaluate(() => document.documentElement.hasAttribute("data-embed")), false, "a top-level page traps the visitor in its stage");
  await context.close();
});
