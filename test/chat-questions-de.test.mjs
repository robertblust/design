// The model's questions in the page's language, in Chromium: a German page whose tag names the
// site's reviewed German offers and sends it, an English page and a German page without the file
// offer the model's titles, and a question asked in German is not offered again.
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

const page = (lang, de) => `<!doctype html><html lang="${lang}" data-theme="dark"><head><meta charset="utf-8">
<style>${TERMINAL}</style><link rel="stylesheet" href="/chat.css"></head><body><p>A page.</p>
<script src="/chat.js" data-chat="/chat" data-model="/model/" data-questions="/model.json"${de ? ` data-questions-de="${de}"` : ""} defer></script></body></html>`;

const TITLES = ["What is it?", "Who answers?", "Can I trust it?"];
const GERMAN = { "What is it?": "Was ist es?", "Who answers?": "Wer antwortet?", "Can I trust it?": "Kann ich dem trauen?", };
const TOO_LONG = "Q".repeat(5000);
const MODEL = JSON.stringify({ entities: TITLES.map((name, i) => ({ id: `question/q${i}`, type: "question", name, fields: {} })), edges: [] });
const SERVED = JSON.stringify(TITLES.map((title) => ({ title, text: title === "Can I trust it?" ? TOO_LONG : GERMAN[title] })));
const sse = (events) => events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("");
let sent = [], slow = false, germanDown = false, server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (req.method === "POST" && url === "/chat") {
      let body = "";
      req.on("data", (c) => { body += c; });
      req.on("end", () => {
        sent.push(JSON.parse(body));
        res.writeHead(200, { "content-type": "text/event-stream" });
        res.end(sse([["text", { text: "An answer." }], ["done", { model: null, spent: 1, dayLeft: 1 }]]));
      });
      return;
    }
    const files = {
      "/de/": ["text/html", page("de", "/questions.de.json")], "/de/other/": ["text/html", page("de", "/questions.de.json")], "/en/": ["text/html", page("en", "/questions.de.json")],
      "/de-nofile/": ["text/html", page("de", "/missing.json")], "/de-noattr/": ["text/html", page("de", null)],
      "/model.json": ["application/json", MODEL], "/questions.de.json": ["application/json", SERVED],
      "/chat.js": ["text/javascript", asset("chat.js")], "/chat.css": ["text/css", asset("chat.css")],
    };
    const hit = files[url];
    if (!hit || (germanDown && url === "/questions.de.json")) { res.writeHead(404); res.end(); return; }
    const send = () => { res.writeHead(200, { "content-type": hit[0], "cache-control": "no-store" }); res.end(hit[1]); };
    // A slow model and German file stand for a page on which neither has been read yet.
    if (slow && (url === "/model.json" || url === "/questions.de.json")) setTimeout(send, 1500); else send();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

// The intro's model questions: every row text that is a title or a German of one.
const KNOWN = new Set([...TITLES, ...Object.values(GERMAN)]);
const introQuestions = (p) => p.$$eval(".rbchat-intro .rbchat-q", (q) => q.map((x) => x.textContent.trim())).then((t) => t.filter((x) => KNOWN.has(x)).sort());
const nextQuestions = (p) => p.$$eval(".rbchat-next .rbchat-q", (q) => q.map((x) => x.textContent.trim()));

async function opened(path) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await context.newPage();
  await p.goto(base + path);
  await p.click(".rbchat-open");
  await p.waitForFunction(() => document.querySelectorAll(".rbchat-intro .rbchat-q").length > 0);
  await p.waitForTimeout(300);
  return { p, context };
}

test("a German page offers the reviewed German, keeps a title whose German is too long, and sends what it shows", async () => {
  sent = [];
  const { p, context } = await opened("/de/");
  assert.deepEqual(await introQuestions(p), ["Can I trust it?", "Was ist es?", "Wer antwortet?"]);
  await p.click(".rbchat-intro .rbchat-q >> text=Was ist es?");
  await p.waitForSelector(".rbchat-next .rbchat-q");
  const last = sent.at(-1).messages.filter((m) => m.role === "user").at(-1);
  assert.equal(last.content, "Was ist es?");
  assert.equal(sent.at(-1).lang, "de");
  await context.close();
});

test("a question asked in German is not offered again after the answer", async () => {
  const { p, context } = await opened("/de/");
  await p.click(".rbchat-intro .rbchat-q >> text=Was ist es?");
  await p.waitForSelector(".rbchat-next .rbchat-q");
  const next = await nextQuestions(p);
  assert.ok(next.length > 0);
  assert.ok(!next.includes("Was ist es?") && !next.includes("What is it?"), next.join(" | "));
  await context.close();
});

test("the follow-ups come back in German with the conversation on the next page, before the files are read", async () => {
  slow = false;
  const { p, context } = await opened("/de/");
  await p.click(".rbchat-intro .rbchat-q >> text=Was ist es?");
  await p.waitForSelector(".rbchat-next .rbchat-q");
  const next = await nextQuestions(p);
  // Every chip is German but the one whose German is too long, which the fixture keeps English on purpose.
  assert.ok(next.every((q) => Object.values(GERMAN).includes(q) || q === "Can I trust it?") && next.some((q) => Object.values(GERMAN).includes(q)), next.join(" | "));
  slow = true;
  await p.goto(base + "/de/other/", { waitUntil: "domcontentloaded" });
  await p.waitForFunction(() => document.querySelector(".rbchat") && !document.querySelector(".rbchat").hidden);
  assert.deepEqual(await nextQuestions(p), next, "the chips were not drawn in German from the kept list");
  slow = false;
  await context.close();
});

test("an English page, a German page whose file is missing and one without the attribute offer the titles", async () => {
  for (const path of ["/en/", "/de-nofile/", "/de-noattr/"]) {
    const { p, context } = await opened(path);
    assert.deepEqual(await introQuestions(p), [...TITLES].sort(), path);
    await context.close();
  }
});

// A German file that failed once is not the tab's answer for good: the list made without it is
// not kept, so the next page reads both files again and offers the German.
test("a German file that failed to load is read again on the next page", async () => {
  germanDown = true;
  const { p, context } = await opened("/de/");
  assert.deepEqual(await introQuestions(p), [...TITLES].sort(), "the failed read offers the titles");
  germanDown = false;
  await p.goto(base + "/de/other/");
  await p.waitForFunction(() => document.querySelector(".rbchat") && !document.querySelector(".rbchat").hidden);
  await p.waitForFunction(() => [...document.querySelectorAll(".rbchat-intro .rbchat-q")].some((q) => q.textContent.trim() === "Was ist es?"));
  assert.deepEqual(await introQuestions(p), ["Can I trust it?", "Was ist es?", "Wer antwortet?"]);
  await context.close();
});

// The follow-ups standing under an answer follow the page's language when it is switched, as the
// intro does, so a number key sends what the row now shows.
test("the follow-ups standing under an answer switch language with the page", async () => {
  const { p, context } = await opened("/de/");
  await p.click(".rbchat-intro .rbchat-q >> text=Was ist es?");
  await p.waitForSelector(".rbchat-next .rbchat-q");
  const german = await nextQuestions(p);
  assert.ok(german.some((q) => Object.values(GERMAN).includes(q)), german.join(" | "));
  await p.evaluate(() => { document.documentElement.lang = "en"; });
  await p.waitForFunction(() => [...document.querySelectorAll(".rbchat-next .rbchat-q")].every((q) => !["Was ist es?", "Wer antwortet?"].includes(q.textContent.trim())));
  const english = await nextQuestions(p);
  assert.equal(english.length, german.length);
  assert.ok(english.every((q) => TITLES.includes(q)), english.join(" | "));
  assert.equal(await p.$$eval(".rbchat-next", (n) => n.length), 1, "the chips were drawn twice");
  await context.close();
});
