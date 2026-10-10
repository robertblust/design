// A link that asks the chat a question, in Chromium: a page carrying chat.js is loaded with
// ?ask=, the panel opens with the question waiting under the notice, and nothing reaches the
// chat endpoint until the visitor sends it. The pure part, linkQuestion(), is in chat.test.mjs.
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

// What each POST to the chat carried, so a test can say nothing was sent, or exactly what was.
const posted = [];
let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (url === "/chat" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => { body += c; });
      req.on("end", () => {
        posted.push(JSON.parse(body));
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.end('event: text\ndata: {"text":"An answer."}\n\nevent: done\ndata: {"model":null,"spent":1,"dayLeft":1}\n\n');
      });
      return;
    }
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

const Q = "show me the organization of CompanyGraph";
const link = (q, before = "") => `/${before ? before + "&" : "?"}ask=${encodeURIComponent(q)}`;

async function arrive(address, options = {}) {
  posted.length = 0;
  const context = await browser.newContext(options);
  const page = await context.newPage();
  await page.goto(base + address);
  await page.waitForSelector(".rbchat-open", { state: "attached" });
  return { page, context };
}
const card = (page) => page.evaluate(() => {
  const c = document.querySelector(".rbchat-ask"), panel = document.querySelector("section.rbchat");
  const intro = document.querySelector(".rbchat-intro");
  const kids = intro ? [...intro.children].map((e) => e.className.split(" ")[0]) : [];
  return {
    open: !!panel && !panel.hidden,
    shown: !!c,
    question: c ? c.querySelector(".rbchat-ask-q").textContent : null,
    order: kids.filter((k) => ["rbchat-notice", "rbchat-ask", "rbchat-groups"].includes(k)),
    focused: document.activeElement && document.activeElement.className,
    address: location.pathname + location.search + location.hash,
  };
});

test("a link with ?ask= opens the panel with the question waiting under the notice, sends nothing, and drops it from the address", async () => {
  const { page, context } = await arrive(link(Q));
  await page.waitForSelector(".rbchat-ask");
  const s = await card(page);
  assert.deepEqual([s.open, s.shown, s.question], [true, true, Q]);
  assert.deepEqual(s.order, ["rbchat-notice", "rbchat-ask", "rbchat-groups"], "under the notice that says nothing is sent, above what the panel offers");
  assert.equal(s.address, "/");
  assert.match(s.focused, /rbchat-ask-go/, "on a desk Send has the focus, so Enter sends");
  await page.waitForTimeout(300);
  assert.equal(posted.length, 0, "nothing is sent on arrival");
  await page.reload();
  await page.waitForSelector(".rbchat-open", { state: "attached" });
  assert.equal(await page.$(".rbchat-ask"), null, "a reload does not ask again");
  await context.close();
});

test("the question keeps the address's other parameters, with or without ?chat=open", async () => {
  for (const [address, rest] of [[link(Q, "?lang=de") + "#x", "/?lang=de#x"], [`/?chat=open&ask=${encodeURIComponent(Q)}&theme=dark`, "/?theme=dark"]]) {
    const { page, context } = await arrive(address);
    await page.waitForSelector(".rbchat-ask");
    assert.equal((await card(page)).address, rest, address);
    await context.close();
  }
});

test("Send sends the question once, as the visitor's message, and the card is gone", async () => {
  const { page, context } = await arrive(link(Q));
  await page.click(".rbchat-ask-go");
  await page.waitForSelector(".rbchat-assistant");
  assert.equal(posted.length, 1);
  assert.deepEqual(posted[0].messages, [{ role: "user", content: Q }]);
  assert.equal(await page.$(".rbchat-ask"), null);
  assert.equal(await page.$eval(".rbchat-user", (u) => u.textContent), Q);
  await context.close();
});

test("Edit puts the question in the input to change, Discard drops it, and neither sends", async () => {
  let { page, context } = await arrive(link(Q));
  await page.click(".rbchat-ask [data-ask='edit']");
  assert.equal(await page.$eval(".rbchat-form textarea", (t) => t.value), Q);
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector(".rbchat-form textarea")), true);
  assert.equal(await page.$(".rbchat-ask"), null);
  await context.close();
  ({ page, context } = await arrive(link(Q)));
  await page.click(".rbchat-ask [data-ask='discard']");
  assert.equal(await page.$eval(".rbchat-form textarea", (t) => t.value), "");
  assert.equal(await page.$(".rbchat-ask"), null);
  await page.waitForTimeout(300);
  assert.equal(posted.length, 0);
  await context.close();
});

test("the question is shown as text, never as markup", async () => {
  const bad = '<img src=x onerror="window.pwned=1">';
  const { page, context } = await arrive(link(bad));
  await page.waitForSelector(".rbchat-ask");
  assert.equal((await card(page)).question, bad);
  assert.equal(await page.$(".rbchat-ask img"), null);
  assert.equal(await page.evaluate(() => window.pwned), undefined);
  await context.close();
});

test("an empty or too long question opens the panel without a card", async () => {
  for (const address of ["/?ask=%20", link("a".repeat(1001))]) {
    const { page, context } = await arrive(address);
    await page.waitForSelector("section.rbchat:not([hidden])");
    const s = await card(page);
    assert.deepEqual([s.open, s.shown, s.address], [true, false, "/"], address.slice(0, 20));
    await context.close();
  }
});

test("a tab that already holds a conversation gets the card at the end of the log", async () => {
  const { page, context } = await arrive("/?chat=open");
  await page.fill(".rbchat-form textarea", "an earlier question");
  await page.press(".rbchat-form textarea", "Enter");
  await page.waitForSelector(".rbchat-assistant");
  await page.goto(base + link(Q));
  await page.waitForSelector(".rbchat-ask");
  const last = await page.evaluate(() => { const log = document.querySelector(".rbchat-log"); return log.lastElementChild.className; });
  assert.match(last, /rbchat-ask/);
  await context.close();
});

test("on a phone the card waits without raising the keyboard", async () => {
  const { page, context } = await arrive(link(Q), { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  await page.waitForSelector(".rbchat-ask");
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector(".rbchat-form textarea")), false);
  await context.close();
});
