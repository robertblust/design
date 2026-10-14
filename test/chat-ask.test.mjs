// A link that asks the chat a question, in Chromium: a page carrying chat.js is loaded with
// ?ask=, the panel opens with the question waiting after the prompt line, and nothing reaches the
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
// A page whose model fills both of the intro's menus, as a site's does.
const MODEL = { commit: "ffb11a52dc8a5ff2a46cbbd43ab8be8930797f6f", repo: "companygraph/mental-model", entities: [
  { id: "processes/answering", type: "process", name: "Answering" },
  ...["A", "B", "C"].map((n) => ({ id: "kpis/" + n, type: "kpi", name: n })),
  ...["What is an owner?", "How does the chat answer a question?", "Which rules does every instance pass?"].map((n, i) => ({ id: "questions/" + i, type: "question", name: n }))
], edges: [] };

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
    const files = { "/": ["text/html", PAGE], "/full": ["text/html", PAGE.replace(" defer>", ' data-questions="/model.json" defer>')], "/model.json": ["application/json", JSON.stringify(MODEL)], "/chat.js": ["text/javascript", asset("chat.js")], "/chat.css": ["text/css", asset("chat.css")] };
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
const link = (q, before = "", at = "/") => `${at}${before ? before + "&" : "?"}ask=${encodeURIComponent(q)}`;

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
    order: kids.filter((k) => ["rbchat-notice", "rbchat-ask", "rbchat-groups", "rbchat-prompt-line"].includes(k)),
    focused: document.activeElement && document.activeElement.className,
    address: location.pathname + location.search + location.hash,
  };
});

test("a link with ?ask= opens the panel with the question waiting after the prompt line, sends nothing, and drops it from the address", async () => {
  const { page, context } = await arrive(link(Q));
  await page.waitForSelector(".rbchat-ask");
  const s = await card(page);
  assert.deepEqual([s.open, s.shown, s.question], [true, true, Q]);
  assert.deepEqual(s.order, ["rbchat-notice", "rbchat-groups", "rbchat-prompt-line", "rbchat-ask"], "after the prompt line, where a typed question would stand");
  assert.equal(s.address, "/");
  assert.match(s.focused, /rbchat-ask-go/, "on a desk Send has the focus, so Enter sends");
  await page.waitForTimeout(300);
  assert.equal(posted.length, 0, "nothing is sent on arrival");
  await page.reload();
  await page.waitForSelector(".rbchat-open", { state: "attached" });
  assert.equal(await page.$(".rbchat-ask"), null, "a reload does not ask again");
  await context.close();
});

test("the question stands after the prompt line once the menus are drawn above it, and in view", async () => {
  const { page, context } = await arrive(link(Q, "", "/full"));
  await page.waitForSelector(".rbchat-intro.rbchat-still .rbchat-row");
  await page.waitForSelector(".rbchat-ask");
  const s = await page.evaluate(() => {
    const intro = document.querySelector(".rbchat-intro"), c = document.querySelector(".rbchat-ask").getBoundingClientRect(), l = document.querySelector(".rbchat-log").getBoundingClientRect();
    return { rows: intro.querySelectorAll(".rbchat-row").length, last: intro.lastElementChild.className.split(" ")[0], before: intro.lastElementChild.previousElementSibling.className.split(" ")[0], inView: c.top >= l.top - 1 && c.bottom <= l.bottom + 1 };
  });
  assert.ok(s.rows >= 4, `both menus drawn: ${s.rows}`);
  assert.deepEqual([s.before, s.last], ["rbchat-prompt-line", "rbchat-ask"]);
  assert.equal(s.inView, true, "the menus drawn above the card pushed it out of sight");
  await context.close();
});

test("a language switch redraws the card and leaves the focus where it was: on Send on a desk, nowhere on a phone", async () => {
  const german = async (page) => {
    await page.evaluate(() => { document.documentElement.lang = "de"; });
    await page.waitForFunction(() => /^Der Link/.test(document.querySelector(".rbchat-ask-from").textContent));
    return page.evaluate(() => { const a = document.activeElement; return a === document.querySelector(".rbchat-ask-go") ? "send" : a.tagName; });
  };
  const desk = await arrive(link(Q));
  await desk.page.waitForSelector(".rbchat-ask");
  assert.equal(await german(desk.page), "send", "the redrawn card lost the focus, so Enter no longer sends");
  await desk.page.keyboard.press("Enter");
  await desk.page.waitForSelector(".rbchat-assistant");
  assert.deepEqual(posted.map((x) => x.messages), [[{ role: "user", content: Q }]]);
  await desk.context.close();
  const phone = await arrive(link(Q), { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  await phone.page.waitForSelector(".rbchat-ask");
  assert.equal(await german(phone.page), "BODY");
  await phone.context.close();
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
