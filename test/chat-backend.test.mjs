// Choosing which chat host answers, in Chromium: a tag naming two backends lets /backend draw a
// menu of their names, a number picks one, the keys line names it, the choice is kept across a
// reload, and the next message goes to the chosen host and nowhere else. A tag naming none
// offers no command, and a kept name the tag no longer names falls back to the tag's own host.
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
const page = (attrs) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${TERMINAL}</style><link rel="stylesheet" href="/chat.css"></head>
<body><p>A page.</p><script src="/chat.js" data-chat="/chat" data-model="/model/"${attrs} defer></script></body></html>`;
const BACKENDS = ' data-chat-backends="google=/chat azure=/chat-azure"';
const STREAM = 'event: text\ndata: {"text":"An answer."}\n\nevent: done\ndata: {"model":null,"spent":1,"dayLeft":1}\n\n';

// Where each POST went and what it carried.
const posted = [];
let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if ((url === "/chat" || url === "/chat-azure") && req.method === "POST") {
      let body = "";
      req.on("data", (c) => { body += c; });
      req.on("end", () => { posted.push({ to: url === "/chat" ? "google" : "azure", body: JSON.parse(body) }); res.writeHead(200, { "content-type": "text/event-stream" }); res.end(STREAM); });
      return;
    }
    const files = { "/": ["text/html", page(BACKENDS)], "/plain": ["text/html", page("")], "/chat.js": ["text/javascript", asset("chat.js")], "/chat.css": ["text/css", asset("chat.css")] };
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": hit[0] }); res.end(hit[1]);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

async function open(context, address) {
  const p = await context.newPage();
  await p.goto(base + address);
  await p.waitForSelector(".rbchat-open", { state: "attached" });
  if (await p.$("section.rbchat:not([hidden])") === null) await p.click(".rbchat-open");
  await p.waitForSelector("section.rbchat:not([hidden]) textarea");
  return p;
}
async function arrive(address) {
  posted.length = 0;
  const context = await browser.newContext();
  return { page: await open(context, address), context };
}
async function type(p, text) {
  await p.fill("section.rbchat textarea", text);
  await p.press("section.rbchat textarea", "Enter");
}
async function ask(p, text) {
  const before = await p.$$eval(".rbchat-assistant, .rbchat-refusal", (a) => a.length);
  await type(p, text);
  await p.waitForFunction((n) => document.querySelectorAll(".rbchat-assistant, .rbchat-refusal").length > n, before);
}
const keys = (p) => p.$eval(".rbchat-keys", (k) => k.textContent);
const kept = (p) => p.evaluate(() => localStorage.getItem("chat-backend"));
const helpWords = (p) => p.$$eval(".rbchat-help-k", (ks) => ks.map((k) => k.textContent));
async function lastMenu(p, count) {
  await p.waitForFunction((n) => document.querySelectorAll(".rbchat-menu").length >= n, count);
  return p.$$eval(".rbchat-menu", (ms) => [...ms.at(-1).querySelectorAll(".rbchat-row")].map((r) => ({
    n: r.querySelector(".rbchat-n").textContent, q: r.querySelector(".rbchat-q").firstChild.textContent, current: r.getAttribute("aria-current") === "true"
  })));
}
const menus = (p) => p.$$eval(".rbchat-menu", (m) => m.length);

test("helpNamesBackend: /help lists /backend where the tag names backends, and not where it does not", async () => {
  const { page: p, context } = await arrive("/");
  await type(p, "/help");
  await p.waitForSelector(".rbchat-help");
  assert.ok((await helpWords(p)).includes("/backend"));
  await context.close();
  const plain = await arrive("/plain");
  await type(plain.page, "/help");
  await plain.page.waitForSelector(".rbchat-help");
  assert.ok(!(await helpWords(plain.page)).includes("/backend"));
  await plain.context.close();
});

test("backendMenu: /backend offers the names, the tag's own first and current, and 2 picks azure for the next message", async () => {
  const { page: p, context } = await arrive("/");
  assert.doesNotMatch(await keys(p), /azure|google/);
  const n = await menus(p);
  await type(p, "/backend");
  assert.match(await p.$eval(".rbchat-log", (l) => l.textContent), /Choose a backend/);
  assert.deepEqual(await lastMenu(p, n + 1), [{ n: "1", q: "google", current: true }, { n: "2", q: "azure", current: false }]);
  await type(p, "2");
  await p.waitForFunction(() => /azure/.test(document.querySelector(".rbchat-keys").textContent));
  assert.equal(await kept(p), "azure");
  assert.equal(await p.$eval("section.rbchat textarea", (t) => t.value), "");
  await p.waitForTimeout(150);
  assert.equal(posted.length, 0, "choosing sends nothing");
  await ask(p, "Hello");
  assert.deepEqual(posted.map((x) => x.to), ["azure"]);
  await type(p, "/backend");
  assert.deepEqual((await lastMenu(p, n + 2)).map((r) => r.current), [false, true], "the pick is marked next time");
  await context.close();
});

test("keptAcrossPages: the choice holds on the next page, and 1 brings the tag's own host back", async () => {
  const { page: p, context } = await arrive("/");
  await type(p, "/backend"); await lastMenu(p, 1); await type(p, "2");
  await p.waitForFunction(() => /azure/.test(document.querySelector(".rbchat-keys").textContent));
  const q = await open(context, "/");
  assert.match(await keys(q), /azure/);
  await ask(q, "Still here?");
  assert.deepEqual(posted.map((x) => x.to), ["azure"]);
  const n = await menus(q);
  await type(q, "/backend"); await lastMenu(q, n + 1); await type(q, "1");
  await q.waitForFunction(() => !/azure/.test(document.querySelector(".rbchat-keys").textContent));
  assert.equal(await kept(q), "google");
  await ask(q, "And now?");
  assert.deepEqual(posted.map((x) => x.to), ["azure", "google"]);
  await context.close();
});

test("plainPage: without backends on the tag, /backend is a question like any other", async () => {
  const { page: p, context } = await arrive("/plain");
  await ask(p, "/backend");
  assert.equal(posted.length, 1);
  assert.equal(posted[0].body.messages.at(-1).content, "/backend");
  await context.close();
});

test("staleChoice: a kept name the tag no longer names falls back to the tag's own host, silently", async () => {
  posted.length = 0;
  const context = await browser.newContext();
  await context.addInitScript(() => { try { localStorage.setItem("chat-backend", "aws"); } catch (e) {} });
  const p = await open(context, "/");
  assert.doesNotMatch(await keys(p), /aws|azure/);
  await ask(p, "Hello");
  assert.deepEqual(posted.map((x) => x.to), ["google"]);
  await context.close();
});
