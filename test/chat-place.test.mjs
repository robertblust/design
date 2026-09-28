// The back button returning to where the conversation was being read, in Chromium: a visitor
// scrolls up into an earlier answer, follows its link to the model page, and comes back. The
// page is drawn again from the tab's copy, and the log has to stand where it stood, not at its
// end. The pure parts, place() and placed(), are in chat.test.mjs.
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
const PICTURES = JSON.parse(fs.readFileSync(path.join(PKG, "test", "fixtures", "diagrams.json"), "utf8"));

const page = (body) => `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8">
<style>*{box-sizing:border-box} body{background:#0C0E13;color:#EFEDE8}</style>
<style>${TERMINAL}</style><link rel="stylesheet" href="/chat.css"></head><body>${body}
<script src="/chat.js" data-chat="/chat" data-model="/model/" defer></script></body></html>`;

// Each answer long enough that the log scrolls well inside it, the first with a picture, so a
// place counted in pixels from the top would miss once the picture draws again.
const long = (n) => Array.from({ length: 30 }, (_, i) => `Answer ${n}, line ${i + 1}: Delivery runs in three phases.`).join("\n\n");
const sse = (events) => events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("");
let asked = 0, server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (req.method === "POST" && url === "/chat") {
      asked++;
      const events = [...(asked === 1 ? [["diagram", PICTURES.process]] : []), ["text", { text: long(asked) }], ["done", { model: null, spent: 1, dayLeft: 1 }]];
      res.writeHead(200, { "content-type": "text/event-stream" }); res.end(sse(events)); return;
    }
    const files = { "/": ["text/html", page("<p>A page.</p>")], "/model/": ["text/html", page("<p>The model.</p>")],
      "/chat.js": ["text/javascript", asset("chat.js")], "/chat.css": ["text/css", asset("chat.css")], "/mermaid.min.js": ["text/javascript", asset("mermaid.min.js")] };
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": hit[0], "cache-control": "no-store" }); res.end(hit[1]);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

// Which bubble the log's top edge stands in, counted in the order the log draws them, and how
// far into it, read in the page by the bubbles' classes alone.
const where = (p) => p.$eval(".rbchat-log", (log) => {
  const box = log.getBoundingClientRect().top, bubbles = [...log.querySelectorAll(".rbchat-user, .rbchat-assistant")];
  const end = log.scrollHeight - log.scrollTop - log.clientHeight < 2;
  for (const [i, b] of bubbles.entries()) {
    const r = b.getBoundingClientRect();
    if (r.bottom - box > 0) return { turn: String(i), by: Math.round(box - r.top), end };
  }
  return { turn: null, by: 0, end };
});

test("the back button returns the log to the answer being read, not to its end", async () => {
  const tab = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await tab.goto(base + "/");
  await tab.click(".rbchat-open");
  for (const q of ["first", "second"]) {
    await tab.fill(".rbchat-form textarea", q);
    await tab.press(".rbchat-form textarea", "Enter");
    await tab.waitForFunction((n) => document.querySelectorAll(".rbchat-assistant[aria-live]").length === n, q === "first" ? 1 : 2);
  }
  await tab.waitForSelector(".rbchat-diagram svg");
  // Into the first answer, below its picture, as a visitor's wheel would take it.
  await tab.hover(".rbchat-log");
  await tab.$eval(".rbchat-log", (log) => { const a = log.querySelectorAll(".rbchat-user, .rbchat-assistant")[1].getBoundingClientRect(); log.scrollTop += a.bottom - log.getBoundingClientRect().top - 300; });
  await tab.mouse.wheel(0, -1);
  await tab.waitForTimeout(100);
  const was = await where(tab);
  assert.equal(was.turn, "1");
  assert.equal(was.end, false);

  await tab.goto(base + "/model/");
  await tab.goBack();
  await tab.waitForSelector(".rbchat-diagram svg");
  await tab.waitForTimeout(300);
  const is = await where(tab);
  assert.equal(is.turn, was.turn, "the log came back in another turn");
  assert.ok(Math.abs(is.by - was.by) <= 2, `the log came back ${is.by - was.by}px away from where it was read`);
  await tab.close();
});

test("a log read to its end comes back at its end", async () => {
  asked = 0;
  const tab = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await tab.goto(base + "/");
  await tab.click(".rbchat-open");
  await tab.fill(".rbchat-form textarea", "first");
  await tab.press(".rbchat-form textarea", "Enter");
  await tab.waitForSelector(".rbchat-assistant[aria-live]");
  await tab.waitForSelector(".rbchat-diagram svg");
  await tab.$eval(".rbchat-log", (log) => { log.scrollTop = log.scrollHeight; });
  await tab.goto(base + "/model/");
  await tab.goBack();
  await tab.waitForSelector(".rbchat-diagram svg");
  await tab.waitForTimeout(300);
  assert.equal((await where(tab)).end, true);
  await tab.close();
});
