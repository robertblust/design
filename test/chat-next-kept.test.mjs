// The questions offered after an answer, kept across a page, in Chromium: a visitor with the
// chat open follows the site's navigation, and the next page draws the conversation again. The
// three rows under the last answer come back with it, the same three and at once, rather than
// after the model file is read, where they would push the log up a moment after the page shows
// and change on every page.
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

const page = (body) => `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8">
<style>*{box-sizing:border-box} body{background:#0C0E13;color:#EFEDE8}</style>
<style>${TERMINAL}</style><link rel="stylesheet" href="/chat.css"></head><body>${body}
<script src="/chat.js" data-chat="/chat" data-model="/model/" data-questions="/model.json" defer></script></body></html>`;

// Enough questions that a fresh pick of three differs from the last one more often than not.
const QUESTIONS = Array.from({ length: 12 }, (_, i) => ({ id: `question/q${i}`, type: "question", name: `Question number ${i}?`, fields: {} }));
// Processes, so the intro's Try rows pick one, and a commit, so it draws its versions line.
const PROCESSES = Array.from({ length: 6 }, (_, i) => ({ id: `process/p${i}`, type: "process", name: `Process ${i}`, fields: {} }));
const MODEL = JSON.stringify({ entities: [...QUESTIONS, ...PROCESSES], edges: [], commit: "0123456789abcdef0123456789abcdef01234567", repo: "example/model", core: "0.1.0" });
const sse = (events) => events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("");
let slow = false, server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (req.method === "POST" && url === "/chat") {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.end(sse([["text", { text: "An answer." }], ["done", { model: null, spent: 1, dayLeft: 1 }]])); return;
    }
    if (url === "/model.json") {
      const send = () => { res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }); res.end(MODEL); };
      if (slow) setTimeout(send, 1500); else send();
      return;
    }
    const files = { "/": ["text/html", page("<p>A page.</p>")], "/other/": ["text/html", page("<p>Another page.</p>")],
      "/chat.js": ["text/javascript", asset("chat.js")], "/chat.css": ["text/css", asset("chat.css")] };
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": hit[0], "cache-control": "no-store" }); res.end(hit[1]);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

const rows = (p) => p.$$eval(".rbchat-next button", (b) => b.map((x) => x.textContent.replace(/^\s*\d+\s*/, "").trim()));

test("the questions offered after an answer come back with the conversation, the same three and at once", async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await context.newPage();
  slow = false;
  await p.goto(base + "/");
  await p.click(".rbchat-open");
  await p.fill(".rbchat-input, .rbchat textarea, .rbchat input", "What is this?");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".rbchat-next button");
  const offered = await rows(p);
  assert.equal(offered.length, 3);
  // The next page's model file is slow: rows drawn from it would not stand yet.
  slow = true;
  await p.goto(base + "/other/", { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => document.querySelector(".rbchat") && !document.querySelector(".rbchat").hidden);
  assert.deepEqual(await rows(p), offered, "the rows were not drawn with the conversation");
  // Once the model file lands, nothing is drawn twice.
  await p.waitForTimeout(1800);
  assert.equal(await p.$$eval(".rbchat-next", (n) => n.length), 1);
  assert.deepEqual(await rows(p), offered);
  await context.close();
});

const intro = (p) => p.$eval(".rbchat-intro", (i) => ({ rows: [...i.querySelectorAll("button")].map((b) => b.textContent.trim()), versions: !!i.querySelector(".rbchat-versions") }));

test("the intro comes back whole with the conversation, the same picks and nothing drawn late", async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await context.newPage();
  slow = false;
  await p.goto(base + "/");
  await p.click(".rbchat-open");
  await p.waitForSelector(".rbchat-intro .rbchat-versions");
  await p.fill(".rbchat textarea", "What is this?");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".rbchat-next button");
  const first = await intro(p);
  assert.equal(first.versions, true);
  slow = true;
  await p.goto(base + "/other/", { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => document.querySelector(".rbchat") && !document.querySelector(".rbchat").hidden);
  const height = await p.$eval(".rbchat-log", (l) => l.scrollHeight);
  assert.deepEqual(await intro(p), first, "the intro was not drawn whole with the conversation");
  // The slow model file lands, and the log does not move.
  await p.waitForTimeout(1800);
  assert.equal(await p.$eval(".rbchat-log", (l) => l.scrollHeight), height, "something was drawn into the log after the page showed");
  assert.deepEqual(await intro(p), first);
  await context.close();
});

test("a panel left open with no conversation, fresh or just reset, is open on the next page with the same intro", async () => {
  for (const reset of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p = await context.newPage();
    slow = false;
    await p.goto(base + "/");
    await p.click(".rbchat-open");
    await p.waitForSelector(".rbchat-intro .rbchat-versions");
    if (reset) {
      await p.fill(".rbchat textarea", "What is this?");
      await p.keyboard.press("Enter");
      await p.waitForSelector(".rbchat-next button");
      await p.click(".rbchat-new");
      await p.waitForSelector(".rbchat-intro .rbchat-versions");
    }
    const first = await intro(p);
    slow = true;
    await p.goto(base + "/other/", { waitUntil: "domcontentloaded" });
    assert.equal(await p.evaluate(() => !!document.querySelector(".rbchat") && !document.querySelector(".rbchat").hidden), true, reset ? "a reset conversation closed the panel" : "an empty open panel closed");
    assert.deepEqual(await intro(p), first);
    assert.equal(await p.$$eval(".rbchat-msg", (m) => m.length), 0, "a turn came back from nowhere");
    await context.close();
  }
});
