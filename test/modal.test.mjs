// The family's one modal, in Chromium: a page that loads modal.js opens it, stacks a second,
// gives back what it held, keeps the page behind it still, and says its close in two languages.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { TERMINAL } from "./fixtures/terminal.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const asset = (f) => fs.readFileSync(path.join(PKG, "assets", f));
const PAGE = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${TERMINAL} body{margin:0;background:#0C0E13;color:#EFEDE8}</style></head>
<body><div id="home"><p id="thing">A thing</p><p id="other">Another</p></div><button id="opener">Open</button>
<div style="height:4000px">A long page.</div><script src="/modal.js"></script></body></html>`;
let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    const files = { "/": ["text/html", PAGE], "/modal.js": ["text/javascript", asset("modal.js")], "/modal.css": ["text/css", asset("modal.css")] };
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": hit[0], "cache-control": "no-store" }); res.end(hit[1]);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

async function page(viewport = { width: 1600, height: 1100 }) {
  const context = await browser.newContext({ viewport });
  const p = await context.newPage();
  await p.goto(base + "/");
  await p.waitForFunction(() => !!window.rbModal && !!document.querySelector("link[data-rbmodal]"));
  await p.waitForFunction(() => [...document.styleSheets].some((s) => s.href && s.href.endsWith("/modal.css")));
  return { p, close: () => context.close() };
}
const openThing = (p, extra = "") => p.evaluate((x) => { window.h = rbModal.open(Object.assign({ title: "graph · Shape", body: document.getElementById("thing") }, x ? JSON.parse(x) : {})); }, extra);

test("it opens with the head, the title and the close, holds the body, and gives it back on close", async () => {
  const { p, close } = await page();
  await openThing(p);
  const s = await p.evaluate(() => { const d = document.querySelector("dialog.rbmodal"); return { open: d.open, title: d.querySelector(".rbmodal-title").textContent, holds: d.querySelector(".rbmodal-body").contains(document.getElementById("thing")), named: document.getElementById(d.getAttribute("aria-labelledby")) === d.querySelector(".rbmodal-title") }; });
  assert.deepEqual(s, { open: true, title: "graph · Shape", holds: true, named: true });
  await p.evaluate(() => window.h.close());
  assert.equal(await p.evaluate(() => document.getElementById("home").firstElementChild.id), "thing");
  assert.equal(await p.evaluate(() => document.querySelector("dialog.rbmodal").open), false);
  await close();
});

test("the close says Close · Esc, in German too, and Escape and the backdrop close it", async () => {
  const { p, close } = await page();
  await openThing(p);
  assert.equal(await p.$eval(".rbmodal-close", (b) => b.getAttribute("data-tip")), "Close · Esc");
  assert.equal(await p.$eval(".rbmodal-close", (b) => b.getAttribute("aria-label")), "Close · Esc");
  await p.evaluate(() => { document.documentElement.lang = "de"; });
  await p.waitForFunction(() => document.querySelector(".rbmodal-close").getAttribute("data-tip") === "Schliessen · Esc");
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => !document.querySelector("dialog.rbmodal").open);
  await openThing(p);
  await p.mouse.click(4, 4);
  await p.waitForFunction(() => !document.querySelector("dialog.rbmodal").open);
  await close();
});

test("the page behind stays where it was and does not scroll while a modal is open", async () => {
  const { p, close } = await page();
  await p.evaluate(() => window.scrollTo(0, 600));
  await openThing(p);
  // What the modal took from the page leaves its place for as long as it is open, so the page
  // may settle once; from then on nothing moves it, and closing gives back the place it had.
  const opened = await p.evaluate(() => Math.round(window.scrollY));
  await p.mouse.move(4, 4);
  await p.mouse.wheel(0, 800);
  await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => Math.round(window.scrollY)), opened, "the page behind scrolled");
  assert.equal(await p.evaluate(() => getComputedStyle(document.documentElement).overflow), "hidden");
  await p.evaluate(() => window.h.close());
  assert.equal(await p.evaluate(() => Math.round(window.scrollY)), 600);
  assert.notEqual(await p.evaluate(() => getComputedStyle(document.documentElement).overflow), "hidden");
  await close();
});

test("a second modal stacks, and the lock holds until the last one closes", async () => {
  const { p, close } = await page();
  await p.evaluate(() => { window.a = rbModal.open({ title: "A", body: document.getElementById("thing") }); window.b = rbModal.open({ title: "B", body: document.getElementById("other") }); });
  assert.equal(await p.$$eval("dialog.rbmodal[open]", (d) => d.length), 2);
  await p.evaluate(() => window.b.close());
  assert.equal(await p.$$eval("dialog.rbmodal[open]", (d) => d.length), 1);
  assert.equal(await p.evaluate(() => getComputedStyle(document.documentElement).overflow), "hidden", "the lock let go under an open modal");
  await p.evaluate(() => window.a.close());
  assert.notEqual(await p.evaluate(() => getComputedStyle(document.documentElement).overflow), "hidden");
  await close();
});

test("a keyed modal keeps a body that has no place of its own", async () => {
  const { p, close } = await page();
  const same = await p.evaluate(() => {
    const f = document.createElement("iframe"); f.srcdoc = "<p>x</p>"; window.f = f;
    const one = rbModal.open({ key: "g", title: "graph · One", body: f }); const d1 = one.el; one.close();
    const two = rbModal.open({ key: "g", title: "graph · Two", body: f });
    return { sameDialog: two.el === d1, frameInside: d1.contains(f), title: d1.querySelector(".rbmodal-title").textContent };
  });
  assert.deepEqual(same, { sameDialog: true, frameInside: true, title: "graph · Two" });
  await close();
});

test("the focus goes back to what opened it, and opening does not light the close", async () => {
  const { p, close } = await page();
  await p.focus("#opener");
  await p.evaluate(() => { window.h = rbModal.open({ title: "t", body: document.getElementById("thing"), opener: document.getElementById("opener") }); });
  assert.equal(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains("rbmodal-close")), false);
  await p.evaluate(() => window.h.close());
  assert.equal(await p.evaluate(() => document.activeElement && document.activeElement.id), "opener");
  await close();
});

test("the controls slot sits between the title and the close", async () => {
  const { p, close } = await page();
  await p.evaluate(() => { const c = document.createElement("div"); c.id = "ctl"; c.textContent = "− + Fit"; window.h = rbModal.open({ title: "t", body: document.getElementById("thing"), controls: c }); });
  const s = await p.evaluate(() => { const slot = document.getElementById("ctl").parentNode; return { slot: slot.className, before: slot.previousElementSibling.className, after: slot.nextElementSibling.className }; });
  assert.deepEqual(s, { slot: "rbmodal-controls", before: "rbmodal-title", after: "rbmodal-close" });
  await close();
});

test("it is the model page's size on a desk and a sheet on a phone", async () => {
  const desk = await page({ width: 1600, height: 1100 });
  await openThing(desk.p);
  const r = await desk.p.$eval("dialog.rbmodal", (d) => { const b = d.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; });
  assert.equal(r.w, 1500); assert.ok(r.h <= 1000 && r.h >= 990, JSON.stringify(r));
  await desk.close();
  const phone = await page({ width: 390, height: 844 });
  await openThing(phone.p);
  const q = await phone.p.$eval("dialog.rbmodal", (d) => { const b = d.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height) }; });
  assert.deepEqual(q, { w: 390, h: 844 });
  await phone.close();
});
