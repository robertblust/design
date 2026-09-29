// What a page shows on its first paint, before its scripts have done their work, in Chromium: a
// page arriving with the chat open paints the panel's empty frame where the panel will stand, and
// a model page's stage keeps the height its history will take and says the graph is coming. Each
// is held to the thing it stands in for once that arrives, so nothing moves when it does.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { chromium } from "playwright";
import { modelPage, stageFiles } from "./fixtures/stage-page.mjs";

// What is slow on the next page, by address: the page's own scripts, as a revalidation or a large
// script before them would make them.
let slow = new Set(), server, base, browser;
before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    // The family's reset, as every site's page carries it: the panel's size includes its border.
    const files = { "/model/": ["text/html", modelPage({ chat: true, extra: "<style>*{box-sizing:border-box}</style>" })], ...stageFiles() };
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    const send = () => { res.writeHead(200, { "content-type": hit[0], "cache-control": "no-store" }); res.end(hit[1]); };
    if (slow.has(url)) setTimeout(send, 1500); else send();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

// A tab whose chat is kept open, as the page before this one left it.
async function tabWithChat(stored, size) {
  const context = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  await context.addInitScript(([stored, size]) => {
    if (stored) sessionStorage.setItem("chat", JSON.stringify(stored));
    if (size) sessionStorage.setItem("chat-size", JSON.stringify(size));
  }, [stored, size]);
  return { page: await context.newPage(), close: () => context.close() };
}
// The page as soon as its markup is parsed: domcontentloaded would wait for a deferred chat.js.
const arrive = async (page) => { await page.goto(base + "/model/", { waitUntil: "commit" }); await page.waitForSelector("#sitefooter", { state: "attached" }); };
const OPEN = { open: true, at: null, turns: [{ role: "user", content: "What is this?" }, { role: "assistant", content: "An answer.", cites: [], names: [] }] };
const frame = (page) => page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement, "::after"), w = document.documentElement.getAttribute("data-chat-waiting");
  return { waiting: w, content: cs.content, width: Math.round(parseFloat(cs.width)), height: Math.round(parseFloat(cs.height)), visible: cs.visibility };
});
const panel = (page) => page.$eval("section.rbchat", (p) => { const r = p.getBoundingClientRect(); return { width: Math.round(r.width), height: Math.round(r.height) }; });

test("a page arriving with the chat open paints the panel's frame before chat.js, where and as large as the panel, and lets it go once the panel stands", async () => {
  slow = new Set(["/chat.js"]);
  const { page, close } = await tabWithChat(OPEN);
  await arrive(page);
  const was = await frame(page);
  assert.equal(was.waiting, new URL(base).host);
  // The title the panel's bar will carry, `ask · <host>`.
  assert.ok(was.content.includes("ask · ") && was.content.includes(new URL(base).host), was.content);
  await page.waitForSelector("section.rbchat:not([hidden])");
  const is = await panel(page);
  assert.deepEqual({ width: was.width, height: was.height }, is, "the frame was not the panel's size");
  assert.equal(await page.evaluate(() => document.documentElement.hasAttribute("data-chat-waiting")), false, "the frame stayed once the panel stood");
  await close();
});

test("a panel sized by hand is framed at its size", async () => {
  slow = new Set(["/chat.js"]);
  const { page, close } = await tabWithChat(OPEN, { w: 600, h: 500 });
  await arrive(page);
  const was = await frame(page);
  assert.deepEqual({ width: was.width, height: was.height }, { width: 600, height: 500 });
  await page.waitForSelector("section.rbchat:not([hidden])");
  assert.deepEqual(await panel(page), { width: 600, height: 500 });
  await close();
});

test("a chat kept closed, or no chat at all, paints no frame", async () => {
  slow = new Set(["/chat.js"]);
  for (const stored of [{ ...OPEN, open: false }, null]) {
    const { page, close } = await tabWithChat(stored);
    await arrive(page);
    assert.equal((await frame(page)).waiting, null);
    await close();
  }
});

test("a frame whose chat.js never comes goes after a few seconds rather than covering the page", async () => {
  slow = new Set();
  const { page, close } = await tabWithChat(OPEN);
  await page.route("**/chat.js", (r) => r.abort());
  await page.goto(base + "/model/", { waitUntil: "domcontentloaded" });
  assert.equal((await frame(page)).visible, "visible");
  await page.waitForTimeout(4300);
  assert.equal((await frame(page)).visible, "hidden");
  await close();
});

test("the stage keeps its head row's height from the first paint and says it is coming until it has drawn", async () => {
  slow = new Set(["/model.json"]);
  const { page, close } = await tabWithChat(null);
  await page.goto(base + "/model/", { waitUntil: "domcontentloaded" });
  const early = await page.evaluate(() => ({
    head: document.getElementById("stagehead").getBoundingClientRect().height,
    top: document.getElementById("stage").getBoundingClientRect().top,
    drawn: document.getElementById("stage").classList.contains("drawn"),
    dots: getComputedStyle(document.querySelector("#stage .canvas"), "::after").content,
  }));
  assert.equal(early.drawn, false);
  assert.match(early.dots, /·/, "the empty canvas did not say the graph is coming");
  await page.waitForSelector("#fig g.n");
  const late = await page.evaluate(() => ({
    head: document.getElementById("stagehead").getBoundingClientRect().height,
    top: document.getElementById("stage").getBoundingClientRect().top,
    drawn: document.getElementById("stage").classList.contains("drawn"),
    dots: getComputedStyle(document.querySelector("#stage .canvas"), "::after").content,
  }));
  assert.equal(late.drawn, true);
  assert.equal(late.dots, "none");
  assert.equal(late.head, early.head, "the head row grew when the history arrived");
  assert.equal(late.top, early.top, "the stage moved when the history arrived");
  slow = new Set();
  await close();
});
