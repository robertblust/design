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
  assert.doesNotMatch(s.keys, /pick/, "the pick key shows with no menu standing");
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
