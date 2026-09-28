// The chat as a terminal, in Chromium: the window, the intro, a held answer, the menus and the
// command line, driven as a visitor drives them. The pure parts are in chat.test.mjs.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const asset = (f) => fs.readFileSync(path.join(PKG, "assets", f));

const BRAND = `<header><a class="brand" href="./"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"><rect x="2" y="6.75" width="10.5" height="10.5" rx="1.5"/><rect x="4.75" y="9.5" width="5" height="5" fill="currentColor" stroke="none"/><path d="M12.5 12 h4.5"/><rect x="17" y="9.5" width="5" height="5" fill="currentColor" stroke="none"/></svg><b>Company<span>Graph</span></b></a></header>`;
const page = (header) => `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><link rel="stylesheet" href="/chat.css"></head>
<body>${header}<p>A page.</p><script src="/chat.js" data-chat="/chat" data-model="/model/" data-questions="/model.json" defer></script></body></html>`;
const MODEL = { entities: [
  { id: "processes/answering", type: "process", name: "Answering" },
  { id: "kpis/a", type: "kpi", name: "A" }, { id: "kpis/b", type: "kpi", name: "B" }, { id: "kpis/c", type: "kpi", name: "C" },
  { id: "questions/owner", type: "question", name: "What is an owner?" },
  { id: "questions/chat", type: "question", name: "How does the chat answer a question?" },
  { id: "questions/rules", type: "question", name: "Which rules does every instance pass?" }
], edges: [] };
const sse = (events) => events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("");

// What the stub /chat answers: set per test. `delay` holds the whole body back, `split` sends the
// first event at once and the rest after `delay`, as a slow stream does; `fail` drops the socket
// after the first event.
export const reply = { events: [], delay: 0, split: false, fail: false, asked: [] };
let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (req.method === "POST" && url === "/chat") {
      let body = ""; req.on("data", (c) => body += c); req.on("end", () => {
        reply.asked.push(JSON.parse(body));
        res.writeHead(200, { "content-type": "text/event-stream" });
        const all = sse(reply.events), first = sse(reply.events.slice(0, 1)), rest = sse(reply.events.slice(1));
        if (reply.fail) { res.write(first); setTimeout(() => res.destroy(), reply.delay); return; }
        if (reply.split) { res.write(first); setTimeout(() => res.end(rest), reply.delay); return; }
        setTimeout(() => res.end(all), reply.delay);
      });
      return;
    }
    const files = { "/": ["text/html", page(BRAND)], "/bare": ["text/html", page("")], "/model.json": ["application/json", JSON.stringify(MODEL)],
      "/broken": ["text/html", page(BRAND).replace("/model.json", "/missing.json")],
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

export async function tab(address = "/", options = {}){
  const context = await browser.newContext(options);
  const p = await context.newPage();
  await p.goto(base + address);
  await p.waitForSelector(".rbchat-open", { state: "attached" });
  return { p, close: () => context.close() };
}
export async function open(p){ await p.click(".rbchat-open"); await p.waitForSelector("section.rbchat:not([hidden])"); }

test("the panel is a terminal window: three dots, the host in the bar, a prompt and the keys under it", async () => {
  const { p, close } = await tab();
  await open(p);
  const s = await p.evaluate(() => {
    const panel = document.querySelector("section.rbchat");
    return {
      dots: panel.querySelectorAll(".rbchat-head .rbchat-dots i").length,
      bar: panel.querySelector("#rbchat-title").textContent,
      label: panel.getAttribute("aria-label"),
      prompt: panel.querySelector(".rbchat-form .rbchat-p").textContent,
      keys: panel.querySelector(".rbchat-keys").textContent,
      mono: getComputedStyle(panel).fontFamily,
      send: getComputedStyle(panel.querySelector(".rbchat-send")).display
    };
  });
  assert.equal(s.dots, 3);
  assert.equal(s.bar, "ask · 127.0.0.1:" + new URL(base).port);
  assert.equal(s.label, "Ask the model");
  assert.equal(s.prompt, "›");
  assert.match(s.keys, /enter send/);
  assert.match(s.keys, /\/help/);
  assert.match(s.mono, /Plex Mono/);
  assert.equal(s.send, "none", "the send button shows on a fine pointer");
  await close();
});

test("a touch screen keeps a send button beside the prompt", async () => {
  const { p, close } = await tab("/", { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
  await open(p);
  assert.notEqual(await p.$eval(".rbchat-send", (b) => getComputedStyle(b).display), "none");
  await close();
});

test("a fresh conversation opens on the lockup, the hello, the notice and six numbered rows", async () => {
  const { p, close } = await tab();
  await open(p);
  await p.waitForFunction(() => document.querySelectorAll(".rbchat-intro.rbchat-still .rbchat-row").length === 6);
  const s = await p.evaluate(() => {
    const i = document.querySelector(".rbchat-log > .rbchat-intro");
    return {
      first: document.querySelector(".rbchat-log").firstElementChild === i,
      mark: !!i.querySelector(".rbchat-lock svg"),
      name: i.querySelector(".rbchat-lock .rbchat-name").textContent,
      hello: i.querySelector(".rbchat-hello").textContent,
      notice: i.querySelector(".rbchat-notice").textContent,
      rows: [...i.querySelectorAll(".rbchat-row")].map((r) => r.querySelector(".rbchat-n").textContent + " " + r.querySelector(".rbchat-q").textContent),
      gets: i.querySelectorAll(".rbchat-row .rbchat-g").length,
      keys: document.querySelector(".rbchat-keys").textContent
    };
  });
  assert.equal(s.first, true);
  assert.equal(s.mark, true);
  assert.equal(s.name, "CompanyGraph");
  assert.match(s.hello, /^Hello\. I answer from CompanyGraph’s model/);
  assert.match(s.notice, /Nothing is sent until you press send/);
  assert.deepEqual(s.rows.slice(0, 3), ["1 Show me the meta-model", "2 Walk me through the Answering process", "3 List the KPIs as a table"]);
  assert.equal(s.gets, 3, "only the Try rows say what comes back");
  assert.deepEqual(s.rows.slice(3).map((r) => r.slice(0, 2)), ["4 ", "5 ", "6 "]);
  assert.match(s.keys, /1-6 pick/);
  await close();
});

test("the intro plays in about a second, and a key finishes it at once", async () => {
  const { p, close } = await tab();
  await open(p);
  const early = await p.$eval(".rbchat-intro", (i) => i.classList.contains("rbchat-still"));
  assert.equal(early, false, "the intro did not play");
  await p.keyboard.press("a");
  assert.equal(await p.$eval(".rbchat-intro", (i) => i.classList.contains("rbchat-still")), true, "a key did not finish it");
  await close();
  const again = await tab();
  await open(again.p);
  await again.p.waitForFunction(() => document.querySelector(".rbchat-intro.rbchat-still"), null, { timeout: 2000 });
  await again.close();
});

test("reduced motion shows the intro finished from the start", async () => {
  const { p, close } = await tab("/", { reducedMotion: "reduce" });
  await open(p);
  assert.equal(await p.$eval(".rbchat-intro", (i) => i.classList.contains("rbchat-still")), true);
  await close();
});

test("a page without a brand names its host, and a failed model file leaves the meta-model row alone", async () => {
  const bare = await tab("/bare");
  await open(bare.p);
  await bare.p.waitForSelector(".rbchat-intro.rbchat-still, .rbchat-intro");
  assert.equal(await bare.p.$(".rbchat-lock"), null);
  assert.match(await bare.p.$eval(".rbchat-hello", (h) => h.textContent), /the model of 127\.0\.0\.1/);
  await bare.close();
  const broken = await tab("/broken");
  await open(broken.p);
  await broken.p.waitForFunction(() => document.querySelectorAll(".rbchat-intro .rbchat-row").length >= 1);
  assert.deepEqual(await broken.p.$$eval(".rbchat-intro .rbchat-row .rbchat-q", (q) => q.map((x) => x.textContent)), ["Show me the meta-model"]);
  await broken.close();
});

test("the intro follows a language switch, rows and keys included", async () => {
  const { p, close } = await tab();
  await open(p);
  await p.waitForFunction(() => document.querySelectorAll(".rbchat-intro .rbchat-row").length === 6);
  await p.evaluate(() => { document.documentElement.lang = "de"; });
  await p.waitForFunction(() => /^Hallo/.test(document.querySelector(".rbchat-hello").textContent));
  assert.equal(await p.$eval(".rbchat-intro .rbchat-row .rbchat-q", (q) => q.textContent), "Zeig mir das Meta-Modell");
  assert.match(await p.$eval(".rbchat-keys", (k) => k.textContent), /1-6 wählen/);
  await close();
});

const ANSWER = [["text", { text: "An **owner** is the entity another is nested under.\n\n- one\n- two\n\n| Owner | Owns |\n| --- | --- |\n| process | step |" }],
  ["cite", { id: "concepts/owner", title: "owner", url: "https://github.com/o/r/blob/3f2a1c9e0b/concepts/owner.md" }],
  ["done", { model: null, spent: 1, dayLeft: 1 }]];

test("a slow answer shows only the spinner, counting, until the stream ends, then the whole answer at once", async () => {
  Object.assign(reply, { events: ANSWER, delay: 2600, split: true, fail: false });
  const { p, close } = await tab();
  await open(p);
  await p.fill("section.rbchat textarea", "What is an owner?");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".rbchat-spin");
  await p.waitForTimeout(1300);
  const mid = await p.evaluate(() => ({
    answer: document.querySelectorAll(".rbchat-assistant").length,
    secs: document.querySelector(".rbchat-spin .rbchat-secs").textContent,
    you: document.querySelector(".rbchat-user").textContent
  }));
  assert.equal(mid.answer, 0, "some of the answer showed before the stream ended");
  assert.equal(mid.secs, "1s");
  assert.equal(mid.you, "What is an owner?");
  await p.waitForSelector(".rbchat-assistant[aria-live]");
  const done = await p.evaluate(() => {
    const a = document.querySelector(".rbchat-assistant");
    return {
      spin: document.querySelectorAll(".rbchat-spin").length,
      head: a.querySelector(".rbchat-done").textContent,
      strong: !!a.querySelector(".rbchat-body strong"),
      list: a.querySelectorAll(".rbchat-body ul li").length,
      table: !!a.querySelector(".rbchat-body table"),
      cite: a.querySelector(".rbchat-cites a.rbchat-cite").textContent,
      model: a.querySelector(".rbchat-model").textContent,
      animations: document.getAnimations().filter((x) => a.contains(x.effect && x.effect.target)).length,
      face: getComputedStyle(a.querySelector(".rbchat-body p")).fontFamily,
      tableFace: getComputedStyle(a.querySelector(".rbchat-body table")).fontFamily
    };
  });
  assert.equal(done.spin, 0, "the spinner stayed");
  assert.equal(done.head, "✓ answered");
  assert.equal(done.strong, true);
  assert.equal(done.list, 2);
  assert.equal(done.table, true);
  assert.equal(done.cite, "owner");
  assert.match(done.model, /^model 3f2a1c9 · \d+s$/);
  assert.equal(done.animations, 0, "the answer animates");
  assert.match(done.face, /Instrument Sans/, "the answer's text is not in today's face");
  assert.match(done.tableFace, /Plex Mono/, "a table is not in mono");
  await close();
});

test("a stream that drops after some text leaves no answer, no spinner, and a ✗ network line", async () => {
  Object.assign(reply, { events: ANSWER, delay: 300, split: false, fail: true });
  const { p, close } = await tab();
  await open(p);
  await p.fill("section.rbchat textarea", "What is an owner?");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".rbchat-refusal");
  const s = await p.evaluate(() => ({
    refusal: document.querySelector(".rbchat-refusal").textContent,
    answer: document.querySelectorAll(".rbchat-assistant").length,
    spin: document.querySelectorAll(".rbchat-spin").length,
    enabled: !document.querySelector("section.rbchat textarea").disabled
  }));
  assert.match(s.refusal, /^✗ The chat could not be reached/);
  assert.equal(s.answer, 0);
  assert.equal(s.spin, 0);
  assert.equal(s.enabled, true);
  await close();
});

test("the next questions are a numbered menu, and the intro's menu dims once a question is sent", async () => {
  Object.assign(reply, { events: ANSWER, delay: 0, split: false, fail: false });
  const { p, close } = await tab();
  await open(p);
  await p.waitForFunction(() => document.querySelectorAll(".rbchat-intro .rbchat-row").length === 6);
  await p.click(".rbchat-intro .rbchat-row");
  await p.waitForSelector(".rbchat-assistant[aria-live]");
  await p.waitForSelector(".rbchat-next .rbchat-row");
  const s = await p.evaluate(() => ({
    spent: document.querySelectorAll(".rbchat-intro .rbchat-menu.rbchat-spent").length,
    next: [...document.querySelectorAll(".rbchat-next .rbchat-n")].map((n) => n.textContent),
    sent: document.querySelector(".rbchat-user").textContent
  }));
  assert.ok(s.spent >= 1, "the intro's menu did not dim");
  assert.deepEqual(s.next, ["1", "2", "3"]);
  assert.equal(s.sent, "Show me the meta-model");
  await close();
});

test("a bare number sends its row, /help prints the keys, /new starts over, and none of them is sent as typed", async () => {
  Object.assign(reply, { events: ANSWER, delay: 0, split: false, fail: false, asked: [] });
  const { p, close } = await tab();
  await open(p);
  await p.waitForFunction(() => document.querySelectorAll(".rbchat-intro .rbchat-row").length === 6);
  await p.fill("section.rbchat textarea", "/help");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".rbchat-help");
  assert.equal(reply.asked.length, 0, "/help reached the host");
  assert.match(await p.$eval(".rbchat-help", (h) => h.textContent), /\/new/);
  await p.fill("section.rbchat textarea", "1");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".rbchat-assistant[aria-live]");
  assert.equal(reply.asked.length, 1);
  assert.equal(reply.asked[0].messages.at(-1).content, "Show me the meta-model", "the number was sent instead of its row");
  await p.fill("section.rbchat textarea", "/new");
  await p.keyboard.press("Enter");
  await p.waitForFunction(() => !document.querySelector(".rbchat-user") && document.querySelector(".rbchat-intro"));
  assert.equal(reply.asked.length, 1, "/new reached the host");
  await close();
});

test("a number with no such row is sent as typed, and ↑ brings back the last question", async () => {
  Object.assign(reply, { events: ANSWER, delay: 0, split: false, fail: false, asked: [] });
  const { p, close } = await tab();
  await open(p);
  await p.waitForFunction(() => document.querySelectorAll(".rbchat-intro .rbchat-row").length === 6);
  await p.fill("section.rbchat textarea", "9");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".rbchat-assistant[aria-live]");
  assert.equal(reply.asked[0].messages.at(-1).content, "9");
  await p.focus("section.rbchat textarea");
  await p.keyboard.press("ArrowUp");
  assert.equal(await p.$eval("section.rbchat textarea", (t) => t.value), "9");
  await close();
});
