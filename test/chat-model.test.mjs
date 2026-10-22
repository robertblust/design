// Choosing the model and the effort from the chat's command line, in Chromium, signed in at the
// stand-in for ZITADEL (fixtures/issuer.mjs): /model offers Sonnet 5 and what the reader's roles
// grant on this site, /effort the five efforts, a number picks one, and the next message carries
// both; the answer names which model and effort spoke. A visitor sends neither, and a message
// above `low` goes to the service's own address where the tag names one.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { TERMINAL } from "./fixtures/terminal.mjs";
import { startIssuer } from "./fixtures/issuer.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const asset = (f) => fs.readFileSync(path.join(PKG, "assets", f));
const page = (attrs) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${TERMINAL}</style><link rel="stylesheet" href="/chat.css"></head>
<body><p>A page.</p><script src="/chat.js" data-chat="/chat" data-model="/model/"${attrs} defer></script></body></html>`;
const DIRECT = "https://direct.example.test/chat";
const OPUS = { opus: { "org-1": "example.test" } };
const STREAM = 'event: text\ndata: {"text":"An answer."}\n\nevent: done\ndata: {"model":null,"spent":1,"dayLeft":1}\n\n';

// What each POST to the chat carried and where it went; `answer` is what the next one gets, a
// refusal ({ status, body }) or a stream of its own ({ stream }).
const posted = [];
let answer = null;
let server, base, browser, issuer;

function reply(res, cors) {
  const a = answer; answer = null;
  if (a && a.status) { res.writeHead(a.status, { ...cors, "content-type": "application/json" }); res.end(JSON.stringify(a.body)); return; }
  res.writeHead(200, { ...cors, "content-type": "text/event-stream" });
  res.end(a && a.stream ? a.stream : STREAM);
}

before(async () => {
  issuer = await startIssuer();
  const signIn = ` data-issuer="${issuer.url}" data-client="client-1" data-org="org-1" data-project="project-1"`;
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (url === "/chat" && req.method === "POST") {
      let body = "";
      req.on("data", (c) => { body += c; });
      req.on("end", () => { posted.push({ to: "chat", body: JSON.parse(body), authorization: req.headers.authorization || null }); reply(res, {}); });
      return;
    }
    const files = { "/": ["text/html", page(signIn)], "/direct": ["text/html", page(signIn + ` data-chat-direct="${DIRECT}"`)], "/plain": ["text/html", page("")], "/chat.js": ["text/javascript", asset("chat.js")], "/chat.css": ["text/css", asset("chat.css")] };
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": hit[0] }); res.end(hit[1]);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); await issuer.close(); });

async function arrive(address, roles) {
  posted.length = 0; answer = null; issuer.reset();
  if (roles) issuer.set({ roles });
  const context = await browser.newContext();
  // The service's own address, which no test reaches: it answers here, across origins, as Cloud
  // Run answers a site that CHAT_HOSTS admits.
  await context.route(DIRECT, async (route) => {
    const r = route.request();
    const cors = { "access-control-allow-origin": base, "access-control-allow-headers": "content-type, x-chat, authorization", "access-control-allow-methods": "POST" };
    if (r.method() === "OPTIONS") { await route.fulfill({ status: 204, headers: cors }); return; }
    posted.push({ to: "direct", body: JSON.parse(r.postData()), authorization: r.headers().authorization || null });
    await route.fulfill({ status: 200, headers: { ...cors, "content-type": "text/event-stream" }, body: STREAM });
  });
  const p = await context.newPage();
  await p.goto(base + address);
  await p.waitForSelector(".rbchat-open", { state: "attached" });
  if (await p.$("section.rbchat:not([hidden])") === null) await p.click(".rbchat-open");
  await p.waitForSelector("section.rbchat:not([hidden]) textarea");
  return { page: p, context };
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
const choice = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("chat-choice") || "null"));
async function login(p) {
  await type(p, "/login");
  await p.waitForFunction(() => /Tëst Reader/.test((document.querySelector(".rbchat-keys") || {}).textContent || ""), null, { timeout: 10000 });
}
// The rows of the menu standing last: each number, its words, and whether it is the current one.
async function lastMenu(p, count) {
  await p.waitForFunction((n) => document.querySelectorAll(".rbchat-menu").length >= n, count);
  return p.$$eval(".rbchat-menu", (ms) => [...ms.at(-1).querySelectorAll(".rbchat-row")].map((r) => ({
    n: r.querySelector(".rbchat-n").textContent,
    q: r.querySelector(".rbchat-q").firstChild.textContent,
    current: r.getAttribute("aria-current") === "true",
    marked: !!r.querySelector(".rbchat-tick")
  })));
}
// Each menu /model or /effort draws is counted from the menus already in the log.
const menus = (p) => p.$$eval(".rbchat-menu", (m) => m.length);

test("modelMenuShowsGranted: /model offers Sonnet 5 and what the roles grant, the current one marked, and a number picks", async () => {
  const { page: p, context } = await arrive("/", OPUS);
  await login(p);
  assert.match(await keys(p), /Tëst Reader {2}· {2}Sonnet 5 · low/);
  const n = await menus(p);
  await type(p, "/model");
  assert.match(await p.$eval(".rbchat-log", (l) => l.textContent), /Choose a model/);
  assert.deepEqual(await lastMenu(p, n + 1), [
    { n: "1", q: "Sonnet 5", current: true, marked: true },
    { n: "2", q: "Opus 5.5", current: false, marked: false }
  ]);
  assert.match(await keys(p), /1-2 pick/);
  await type(p, "2");
  await p.waitForFunction(() => /Opus 5\.5 · low/.test(document.querySelector(".rbchat-keys").textContent));
  assert.deepEqual(await choice(p), { model: "claude-opus-5-5", effort: "low" });
  assert.equal(await p.$eval("section.rbchat textarea", (t) => t.value), "");
  await type(p, "/model");
  assert.deepEqual((await lastMenu(p, n + 2)).map((r) => r.current), [false, true], "the pick is marked next time");
  await p.waitForTimeout(150);
  assert.equal(posted.length, 0, "choosing sends nothing");
  await context.close();
});

test("effortMenu: /effort offers the five efforts and 3 picks high", async () => {
  const { page: p, context } = await arrive("/");
  await login(p);
  const n = await menus(p);
  await type(p, "/effort");
  assert.match(await p.$eval(".rbchat-log", (l) => l.textContent), /Choose an effort/);
  assert.deepEqual((await lastMenu(p, n + 1)).map((r) => [r.n, r.q, r.current]), [["1", "low", true], ["2", "medium", false], ["3", "high", false], ["4", "xhigh", false], ["5", "max", false]]);
  await type(p, "3");
  await p.waitForFunction(() => /Sonnet 5 · high/.test(document.querySelector(".rbchat-keys").textContent));
  assert.deepEqual(await choice(p), { model: "claude-sonnet-5", effort: "high" });
  // A click picks too, and sends nothing.
  await type(p, "/effort"); await lastMenu(p, n + 2);
  await p.$$eval(".rbchat-menu", (ms) => ms.at(-1).querySelectorAll(".rbchat-row")[1].click());
  await p.waitForFunction(() => /Sonnet 5 · medium/.test(document.querySelector(".rbchat-keys").textContent));
  await p.waitForTimeout(150);
  assert.equal(posted.length, 0);
  await context.close();
});

test("postCarriesChoice: the next message carries the model and the effort chosen", async () => {
  const { page: p, context } = await arrive("/", OPUS);
  await login(p);
  let n = await menus(p);
  await type(p, "/model"); await lastMenu(p, ++n); await type(p, "2");
  await type(p, "/effort"); await lastMenu(p, ++n); await type(p, "3");
  await p.waitForFunction(() => /Opus 5\.5 · high/.test(document.querySelector(".rbchat-keys").textContent));
  await ask(p, "What is an owner?");
  assert.equal(posted.length, 1);
  assert.equal(posted[0].body.model, "claude-opus-5-5");
  assert.equal(posted[0].body.effort, "high");
  assert.deepEqual(posted[0].body.messages, [{ role: "user", content: "What is an owner?" }]);
  await context.close();
});

test("visitorSendsNoChoice: a visitor's body has no model or effort, whatever the browser remembers", async () => {
  for (const address of ["/", "/plain"]) {
    const { page: p, context } = await arrive(address);
    await p.evaluate(() => localStorage.setItem("chat-choice", JSON.stringify({ model: "claude-opus-5-5", effort: "max" })));
    await ask(p, "What is an owner?");
    assert.equal(posted.length, 1, address);
    assert.ok(!("model" in posted[0].body) && !("effort" in posted[0].body), address + ": " + JSON.stringify(posted[0].body));
    assert.equal(posted[0].to, "chat");
    assert.doesNotMatch(await keys(p), /Sonnet 5|Opus/, address);
    await context.close();
  }
});

test("visitorModelSaysLogin: signed out, /model and /effort say to sign in and draw no menu", async () => {
  const { page: p, context } = await arrive("/");
  const n = await menus(p);
  await type(p, "/model");
  await type(p, "/effort");
  await p.waitForFunction(() => document.querySelectorAll(".rbchat-hint").length === 2);
  assert.deepEqual(await p.$$eval(".rbchat-hint", (h) => h.map((x) => x.textContent)), ["Sign in with /login to choose a model.", "Sign in with /login to choose a model."]);
  assert.equal(await menus(p), n);
  await p.waitForTimeout(150);
  assert.equal(posted.length, 0);
  await context.close();
});

test("revokedChoiceFallsBack: a remembered model the sign-in no longer grants goes as Sonnet 5, and an unknown effort as low", async () => {
  const { page: p, context } = await arrive("/");
  await login(p);
  await p.evaluate(() => localStorage.setItem("chat-choice", JSON.stringify({ model: "claude-fable-5-1", effort: "medium" })));
  await ask(p, "What is an owner?");
  assert.equal(posted[0].body.model, "claude-sonnet-5");
  assert.equal(posted[0].body.effort, "medium");
  assert.deepEqual(await choice(p), { model: "claude-sonnet-5", effort: "medium" }, "the remembered choice is corrected");
  await p.evaluate(() => localStorage.setItem("chat-choice", JSON.stringify({ model: "claude-sonnet-5", effort: "huge" })));
  await ask(p, "And who leads it?");
  assert.equal(posted[1].body.effort, "low");
  assert.deepEqual(await choice(p), { model: "claude-sonnet-5", effort: "low" });
  await context.close();
});

test("byLineShown: done.by puts the model and effort that answered beside the cite line, and none without it", async () => {
  const { page: p, context } = await arrive("/", OPUS);
  await login(p);
  const cite = 'event: cite\ndata: {"id":"owner","title":"Owner","type":"concept"}\n\n';
  answer = { stream: 'event: text\ndata: {"text":"An answer."}\n\n' + cite + 'event: done\ndata: {"model":null,"by":{"model":"claude-opus-5-5","effort":"high"}}\n\n' };
  await ask(p, "What is an owner?");
  const line = await p.$eval(".rbchat-assistant .rbchat-cites", (c) => c.textContent);
  assert.match(line, /Owner/);
  assert.match(line, /Opus 5\.5 · high$/);
  answer = { stream: 'event: text\ndata: {"text":"Another."}\n\n' + cite + 'event: done\ndata: {"model":null}\n\n' };
  await ask(p, "And who leads it?");
  const lines = await p.$$eval(".rbchat-assistant", (a) => a.map((x) => x.textContent));
  assert.doesNotMatch(lines[1], /Opus|Sonnet|· high|· low/);
  assert.equal(await p.$$eval(".rbchat-by", (b) => b.length), 1);
  // The tab keeps it with the answer, so the next page names it too.
  await p.reload();
  await p.waitForSelector("section.rbchat:not([hidden]) .rbchat-assistant");
  assert.deepEqual(await p.$$eval(".rbchat-by", (b) => b.map((x) => x.textContent)), ["Opus 5.5 · high"]);
  await context.close();
});

test("notGrantedRefused: a 403 not_granted says so and keeps the question in the line", async () => {
  const { page: p, context } = await arrive("/", OPUS);
  await login(p);
  answer = { status: 403, body: { error: { code: "not_granted" } } };
  await ask(p, "What is an owner?");
  assert.match(await p.$eval(".rbchat-refusal", (r) => r.textContent), /Your sign-in does not grant that model\./);
  assert.equal(await p.$eval("section.rbchat textarea", (t) => t.value), "What is an owner?");
  assert.equal(await p.$$eval(".rbchat-user[data-turn]", (u) => u.length), 0, "the question is no turn");
  assert.equal(await p.$eval("section.rbchat textarea", (t) => t.disabled), false);
  await context.close();
});

test("directForHighEffort: with data-chat-direct a message above low posts there, one at low to data-chat", async () => {
  const { page: p, context } = await arrive("/direct");
  await login(p);
  let n = await menus(p);
  await type(p, "/effort"); await lastMenu(p, ++n); await type(p, "3");
  await ask(p, "What is an owner?");
  await type(p, "/effort"); await lastMenu(p, ++n); await type(p, "1");
  await ask(p, "And who leads it?");
  assert.deepEqual(posted.map((x) => [x.to, x.body.effort]), [["direct", "high"], ["chat", "low"]]);
  assert.equal(posted[0].authorization, "Bearer " + (await p.evaluate(() => JSON.parse(localStorage.getItem("chat-signin")).access)));
  await context.close();
});
