// A link that asks for the chat open, in Chromium: a page carrying chat.js is loaded with
// ?chat=open, as a post linking to the chat does, and the panel is open on arrival with the
// parameter gone from the address. The pure part, asked(), is in chat.test.mjs.
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

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${TERMINAL}</style><link rel="stylesheet" href="/chat.css"></head>
<body><p>A page.</p><script src="/chat.js" data-chat="/chat" data-model="/model/" defer></script></body></html>`;

let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    const files = { "/": ["text/html", PAGE], "/chat.js": ["text/javascript", asset("chat.js")], "/chat.css": ["text/css", asset("chat.css")] };
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": hit[0] }); res.end(hit[1]);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

async function arrive(address, options = {}) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(base + address);
  await page.waitForSelector(".rbchat-open", { state: "attached" });
  const state = await page.evaluate(() => {
    const panel = document.querySelector("section.rbchat");
    return {
      open: !!panel && !panel.hidden,
      button: !document.querySelector(".rbchat-open").hidden,
      focused: !!panel && document.activeElement === panel.querySelector("textarea"),
      address: location.pathname + location.search + location.hash,
    };
  });
  await context.close();
  return state;
}

test("an address with ?chat=open opens the panel and drops the parameter", async () => {
  const s = await arrive("/?chat=open");
  assert.equal(s.open, true, "the panel is not open");
  assert.equal(s.button, false, "the button still shows beside an open panel");
  assert.equal(s.address, "/", "the parameter stays in the address");
});

test("the other parameters and the hash stay where they were", async () => {
  assert.equal((await arrive("/?lang=de&chat=open#x")).address, "/?lang=de#x");
  assert.equal((await arrive("/?chat=open&theme=dark")).address, "/?theme=dark");
});

test("an address that does not ask leaves the panel closed", async () => {
  const s = await arrive("/?chatter=open");
  assert.equal(s.open, false);
  assert.equal(s.button, true);
  assert.equal(s.address, "/?chatter=open");
});

test("a fine pointer gets the cursor in the input, a touch screen keeps its keyboard closed", async () => {
  assert.equal((await arrive("/?chat=open")).focused, true, "a desktop arrival does not focus the input");
  const phone = await arrive("/?chat=open", { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  assert.equal(phone.open, true, "a phone arrival does not open the panel");
  assert.equal(phone.focused, false, "a phone arrival opens the keyboard");
});
