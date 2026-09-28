// The chat opens the model's graph over the page, in Chromium: a name, a cite title or a
// picture's node opens the embedded model page in the chat's own dialog, a later open moves
// its focus by message, and nothing about it touches the chat page's address or history.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { modelPage, stageFiles } from "./fixtures/stage-page.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ID_A = "concepts/guest", ID_B = "concepts/merge";
const PICTURE = JSON.parse(fs.readFileSync(path.join(PKG, "test", "fixtures", "diagrams.json"), "utf8")).typed;
PICTURE.nodes[0].id = ID_A; PICTURE.nodes[0].title = "Guest";
const CHAT = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><link rel="stylesheet" href="/chat.css"></head>
<body><p>A page.</p><script src="/chat.js" data-chat="/chat" data-model="/model/" defer></script></body></html>`;
const sse = (events) => events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("");
const EVENTS = [["text", { text: "A Guest is resolved before any merge happens." }], ["names", { names: [{ id: ID_A, title: "Guest" }] }],
  ["cite", { id: ID_B, title: "Merge", url: "https://github.com/o/r/blob/abc1234def/concepts/merge.md" }], ["diagram", PICTURE], ["done", { spent: 1 }]];
let server, base, browser, slowModel = 0;

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (req.method === "POST" && url === "/chat") { res.writeHead(200, { "content-type": "text/event-stream" }); res.end(sse(EVENTS)); return; }
    const files = { "/": ["text/html", CHAT], "/model/": ["text/html", modelPage()], "/mermaid.min.js": ["text/javascript", fs.readFileSync(path.join(PKG, "assets", "mermaid.min.js"))], ...stageFiles() };
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    const send = () => { res.writeHead(200, { "content-type": hit[0], "cache-control": "no-store" }); res.end(hit[1]); };
    if (url === "/model.json" && slowModel < 0) { res.writeHead(500); res.end(); return; }
    if (url === "/model.json" && slowModel) setTimeout(send, slowModel); else send();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

async function answered() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await context.newPage();
  const loads = { n: 0 };
  // A load is a request for the model page as a document; the stage's own address updates are
  // same-document navigations and fetch nothing.
  p.on("request", (r) => { if (r.resourceType() === "document" && /\/model\//.test(r.url())) loads.n++; });
  await p.goto(base + "/");
  await p.click(".rbchat-open");
  await p.fill("section.rbchat textarea", "What is a guest?");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".rbchat-assistant[aria-live]");
  await p.waitForSelector('.rbchat-diagram svg a[aria-label="Guest"]');
  return { p, loads, close: () => context.close() };
}
const frame = (p) => p.frame({ url: /\/model\// });
const focusIs = (p, want) => p.waitForFunction((w) => { const f = [...document.querySelectorAll("iframe.rbchat-graph-frame")][0]; const d = f && f.contentDocument; return d && d.getElementById("path") && d.getElementById("path").textContent === w; }, want);
const nameLink = '.rbchat-assistant .rbchat-body a:text-is("Guest")';

test("a name in an answer opens the graph over the chat, focused on it, and the page does not change", async () => {
  const { p, close } = await answered();
  await p.click(nameLink);
  await p.waitForSelector("dialog.rbchat-graph[open]");
  assert.equal(await p.$eval(".rbchat-graph-title", (t) => t.textContent), "graph · Guest");
  await focusIs(p, "concepts / guest");
  assert.equal(await p.evaluate(() => location.pathname + location.search), "/");
  await close();
});

test("a cite title and a picture's node open it too, and a second open moves the focus without reloading", async () => {
  const { p, loads, close } = await answered();
  await p.click(nameLink);
  await focusIs(p, "concepts / guest");
  await p.click(".rbchat-graph-close");
  await p.click(".rbchat-cites a.rbchat-cite");
  await focusIs(p, "concepts / merge");
  assert.equal(loads.n, 1, "the frame loaded again");
  await p.click(".rbchat-graph-close");
  await p.click('.rbchat-diagram svg a[aria-label="Guest"]');
  await focusIs(p, "concepts / guest");
  assert.equal(loads.n, 1);
  await close();
});

test("the dialog's × and Escape in the graph close it, focus goes back to the link, and the chat page's history is untouched", async () => {
  const { p, close } = await answered();
  const before = await p.evaluate(() => history.length);
  await p.click(nameLink);
  await focusIs(p, "concepts / guest");
  const f = frame(p);
  for (let i = 0; i < 2; i++) {
    const was = await f.$eval("#path", (e) => e.textContent);
    await f.click("#fig g.n:not(.focus):not(.ancestor) >> nth=0");
    await f.waitForFunction((w) => document.getElementById("path").textContent !== w, was);
  }
  await p.click(".rbchat-graph-close");
  await p.waitForFunction(() => !document.querySelector("dialog.rbchat-graph").open);
  assert.equal(await p.evaluate(() => history.length), before, "the graph wrote to the chat page's history");
  assert.equal(await p.evaluate(() => document.activeElement && document.activeElement.textContent), "Guest", "the focus did not go back to the link");
  await p.click(nameLink);
  await p.waitForSelector("dialog.rbchat-graph[open]");
  // Escape where the visitor's focus is, in the graph itself: the stage asks the chat to close.
  await frame(p).focus("#stagemodal");
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => !document.querySelector("dialog.rbchat-graph").open);
  await close();
});

test("opened from the picture's full screen, the graph sits on top and closing it leaves the picture open", async () => {
  const { p, close } = await answered();
  await p.click(".rbchat-diagram-full");
  await p.waitForSelector("dialog.rbchat-modal[open]");
  await p.click('dialog.rbchat-modal svg a[aria-label="Guest"]');
  await p.waitForSelector("dialog.rbchat-graph[open]");
  await focusIs(p, "concepts / guest");
  assert.equal(await p.evaluate(() => { const g = document.querySelector("dialog.rbchat-graph").getBoundingClientRect(); const top = document.elementFromPoint(g.x + g.width / 2, g.y + 20); return !!(top && top.closest("dialog.rbchat-graph")); }), true, "the graph is not on top");
  await p.click(".rbchat-graph-close");
  await p.waitForFunction(() => !document.querySelector("dialog.rbchat-graph").open);
  assert.equal(await p.$eval("dialog.rbchat-modal", (d) => d.open), true, "closing the graph closed the picture");
  await close();
});

test("a second open before the frame is ready is not lost", async () => {
  const { p, close } = await answered();
  slowModel = 900;
  await p.evaluate(() => { document.querySelector('.rbchat-assistant .rbchat-body a').click(); document.querySelector(".rbchat-cites a.rbchat-cite").click(); });
  await focusIs(p, "concepts / merge");
  slowModel = 0;
  await close();
});

test("a switch of theme or language while the graph is open reaches it, and a close from another origin is ignored", async () => {
  const { p, close } = await answered();
  await p.click(nameLink);
  await focusIs(p, "concepts / guest");
  await p.evaluate(() => { document.documentElement.setAttribute("data-theme", "light"); document.documentElement.lang = "de"; });
  await frame(p).waitForFunction(() => document.documentElement.getAttribute("data-theme") === "light" && document.documentElement.lang === "de");
  await p.evaluate(() => window.dispatchEvent(new MessageEvent("message", { data: { type: "rb-graph-close" }, origin: "https://elsewhere.example" })));
  await p.waitForTimeout(250);
  assert.equal(await p.$eval("dialog.rbchat-graph", (d) => d.open), true);
  await close();
});

// ─── The final review's findings ─────────────────────────────────────────────────────────
test("a link on the graph's card leaves as the whole tab, never as the frame, and a card's own link moves the graph", async () => {
  const { p, close } = await answered();
  const before = await p.evaluate(() => history.length);
  await p.click(nameLink);
  await focusIs(p, "concepts / guest");
  const f = frame(p);
  // A card's link to another entity is a place in the graph: it moves the focus and writes
  // nothing to the tab's history.
  await f.click('#card a[href^="#"] >> nth=0');
  await p.waitForFunction(() => document.querySelector("iframe.rbchat-graph-frame").contentDocument.getElementById("path").textContent !== "concepts / guest");
  assert.equal(await p.evaluate(() => history.length), before, "a card's own link wrote to the tab's history");
  // A link out of the model follows the family's rule, the same tab: the whole tab goes, as any
  // link on these sites does, and the frame never shows a page that refuses to be framed.
  await p.route("https://github.com/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<p>GitHub</p>" }));
  await p.click(".rbchat-graph-close");
  await p.click(nameLink);
  await focusIs(p, "concepts / guest");
  await Promise.all([p.waitForURL(/^https:\/\/github\.com\//), frame(p).click("#cfootlink a")]);
  await close();
});

test("a model file that fails says so in the dialog rather than leaving it blank", { timeout: 40000 }, async () => {
  const { p, close } = await answered();
  slowModel = -1;
  await p.click(nameLink);
  await p.waitForSelector(".rbchat-graph-failed", { timeout: 20000 });
  assert.match(await p.$eval(".rbchat-graph-failed", (e) => e.textContent), /could not be drawn/);
  slowModel = 0;
  await close();
});

test("every open puts the keyboard in the graph, so its keys walk the trail", async () => {
  const { p, close } = await answered();
  await p.click(nameLink);
  await focusIs(p, "concepts / guest");
  await p.click(".rbchat-graph-close");
  await p.click(".rbchat-cites a.rbchat-cite");
  await focusIs(p, "concepts / merge");
  await p.keyboard.press("ArrowLeft");
  await focusIs(p, "concepts / guest");
  await close();
});

test("the dialog is named by its head, and the head follows the focus and the language", async () => {
  const { p, close } = await answered();
  await p.click(nameLink);
  await focusIs(p, "concepts / guest");
  const named = await p.evaluate(() => { const d = document.querySelector("dialog.rbchat-graph"), id = d.getAttribute("aria-labelledby"); return { byTitle: !!id && document.getElementById(id) === d.querySelector(".rbchat-graph-title"), frame: d.querySelector("iframe").getAttribute("title") }; });
  assert.deepEqual(named, { byTitle: true, frame: "graph · Guest" });
  const f = frame(p);
  await f.click("#fig g.n:not(.focus):not(.ancestor) >> nth=0");
  await p.waitForFunction(() => document.querySelector(".rbchat-graph-title").textContent !== "graph · Guest");
  const to = await p.$eval(".rbchat-graph-title", (t) => t.textContent);
  await p.evaluate(() => { document.documentElement.lang = "de"; });
  await p.waitForFunction((t) => document.querySelector(".rbchat-graph-title").textContent === t.replace(/^graph/, "Graph"), to);
  await close();
});
