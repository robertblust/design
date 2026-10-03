// The answer check in Chromium: a `verdict` event with a threshold marks the claims it does not
// carry once the answer has finished, with the panel's own note and one line under the answer;
// with no threshold, or no event, the answer is as it always was.
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
const page = (lang) => `<!doctype html><html lang="${lang}" data-theme="dark"><head><meta charset="utf-8">
<style>${TERMINAL}</style><link rel="stylesheet" href="/chat.css"></head><body><p>A page.</p>
<script src="/chat.js" data-chat="/chat" data-model="/model/" data-questions="/model.json" defer></script></body></html>`;
const MODEL = JSON.stringify({ entities: [], edges: [] });
const sse = (events) => events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("");

// One answer of three claims: a supported one, a partial one that runs through a code span, and
// a contradicted one. The offsets count the Markdown, as the server's do.
const TEXT = "Experience is one dated period. It holds a `start` date and a title only. A writing rule is a numbered convention.";
const at = (s) => [TEXT.indexOf(s), TEXT.indexOf(s) + s.length];
const claim = (s, verdict, p) => { const [from, to] = at(s); return { from, to, ids: [], verdict, p }; };
const CLAIMS = [claim("Experience is one dated period.", "supported", 0.99), claim("It holds a `start` date and a title only.", "partial", 0.9), claim("A writing rule is a numbered convention.", "contradicted", 0.85)];
let stream = [];
const answer = (verdict) => [["text", { text: TEXT }], ...(verdict ? [["verdict", verdict]] : []), ["done", { model: null, spent: 1, dayLeft: 1 }]];

let server, base, browser;
before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (req.method === "POST" && url === "/chat") { req.resume(); req.on("end", () => { res.writeHead(200, { "content-type": "text/event-stream" }); res.end(sse(stream)); }); return; }
    const files = { "/en/": ["text/html", page("en")], "/de/": ["text/html", page("de")], "/model.json": ["application/json", MODEL], "/chat.js": ["text/javascript", asset("chat.js")], "/chat.css": ["text/css", asset("chat.css")] };
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": hit[0], "cache-control": "no-store" }); res.end(hit[1]);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

async function asked(path, events, { hover = true } = {}) {
  stream = events;
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, hasTouch: !hover });
  const p = await context.newPage();
  await p.goto(base + path);
  await p.click(".rbchat-open");
  await p.fill(".rbchat-form textarea", "What does experience hold?");
  await p.press(".rbchat-form textarea", "Enter");
  await p.waitForSelector(".rbchat-assistant .rbchat-done");
  return { p, context };
}
const marks = (p) => p.$$eval(".rbchat-assistant .rbchat-claim", (m) => m.map((x) => [x.className.replace("rbchat-claim", "").trim(), x.textContent]));

test("a threshold marks the claims it does not carry, each piece of one that runs through code, and says how many", async () => {
  const { p, context } = await asked("/en/", answer({ claims: CLAIMS, threshold: 0.8 }));
  assert.deepEqual(await marks(p), [["part", "It holds a "], ["part", "start"], ["part", " date and a title only."], ["off", "A writing rule is a numbered convention."]]);
  assert.equal(await p.$eval(".rbchat-claims", (e) => e.textContent), "2 statements here aren't fully backed by the model's pages.");
  await context.close();
});

test("a claim under the threshold, a supported one, and one outside the answer's text are not marked", async () => {
  const outside = { from: TEXT.length + 5, to: TEXT.length + 40, ids: [], verdict: "absent", p: 0.95 };
  const { p, context } = await asked("/en/", answer({ claims: [{ ...CLAIMS[1], p: 0.5 }, CLAIMS[0], outside], threshold: 0.8 }));
  assert.deepEqual(await marks(p), []);
  assert.equal(await p.$(".rbchat-claims"), null);
  await context.close();
});

test("with no threshold, or no verdict, the answer is drawn as it always was", async () => {
  for (const events of [answer({ claims: CLAIMS, threshold: null }), answer(null)]) {
    const { p, context } = await asked("/en/", events);
    assert.deepEqual(await marks(p), []);
    assert.equal(await p.$(".rbchat-claims"), null);
    await context.close();
  }
});

test("hover and keyboard focus show the panel's note with the verdict's name and line, Escape closes it, and a tap does not open it", async () => {
  const { p, context } = await asked("/en/", answer({ claims: CLAIMS, threshold: 0.8 }));
  await p.hover(".rbchat-claim.off");
  await p.waitForSelector(".rbchat-note.show");
  assert.equal(await p.$eval(".rbchat-note", (e) => e.textContent), "Contradicted The model's pages say otherwise.");
  // Seen, not only classed: the log scrolling under a resting pointer moves the note with its
  // claim, as the family's tooltip does, and never closes it.
  await p.$eval(".rbchat-log", (l) => { l.scrollTop = Math.max(0, l.scrollTop - 1); l.dispatchEvent(new Event("scroll")); });
  await p.waitForTimeout(250);
  assert.equal(await p.$eval(".rbchat-note", (e) => getComputedStyle(e).opacity), "1", "the note is visible after the log scrolls");
  await p.mouse.move(0, 0);
  await p.waitForSelector(".rbchat-note.show", { state: "detached" }).catch(() => {});
  assert.equal(await p.$(".rbchat-note.show"), null);
  await p.focus(".rbchat-form textarea");
  await p.keyboard.press("Shift+Tab");
  for (let i = 0; i < 40 && !(await p.evaluate(() => document.activeElement?.classList.contains("rbchat-claim"))); i++) await p.keyboard.press("Shift+Tab");
  await p.waitForSelector(".rbchat-note.show");
  assert.match(await p.$eval(".rbchat-note", (e) => e.textContent), /^(Partly backed|Contradicted) /);
  await p.keyboard.press("Escape");
  assert.equal(await p.$(".rbchat-note.show"), null);
  await context.close();
  const touch = await asked("/en/", answer({ claims: CLAIMS, threshold: 0.8 }), { hover: false });
  await touch.p.tap(".rbchat-claim.off");
  await touch.p.waitForTimeout(200);
  assert.equal(await touch.p.$(".rbchat-note.show"), null);
  await touch.context.close();
});

test("on a German page the note and the line are German", async () => {
  const { p, context } = await asked("/de/", answer({ claims: CLAIMS, threshold: 0.8 }));
  await p.hover(".rbchat-claim.off");
  await p.waitForSelector(".rbchat-note.show");
  assert.doesNotMatch(await p.$eval(".rbchat-note", (e) => e.textContent), /model's pages/);
  assert.doesNotMatch(await p.$eval(".rbchat-claims", (e) => e.textContent), /statement/);
  await context.close();
});

test("an answer that ended in an error is never marked", async () => {
  const { p, context } = await asked("/en/", [["text", { text: TEXT }], ["verdict", { claims: CLAIMS, threshold: 0.8 }], ["error", { error: { code: "host_down", message: "down" } }]]);
  assert.deepEqual(await marks(p), []);
  assert.equal(await p.$(".rbchat-claims"), null);
  await context.close();
});

test("a restored conversation marks its answer again", async () => {
  const { p, context } = await asked("/en/", answer({ claims: CLAIMS, threshold: 0.8 }));
  await p.reload();
  await p.waitForSelector(".rbchat-assistant .rbchat-body");
  assert.equal((await marks(p)).length, 4);
  assert.ok(await p.$(".rbchat-claims"));
  await context.close();
});
