// The widget drawing a picture, in Chromium: a page carrying chat.js is served with a chat
// endpoint that answers from a script, so what is tested is the widget and Mermaid, the real
// vendored file, and nothing of a chat host. The pure parts are in chat.test.mjs.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const asset = (f) => fs.readFileSync(path.join(PKG, "assets", f));
const PICTURES = JSON.parse(fs.readFileSync(path.join(PKG, "test", "fixtures", "diagrams.json"), "utf8"));

const PAGE = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><style>
:root{--ground:#0C0E13;--raise:#171A21;--rule:#232833;--ink:#EFEDE8;--dim:#8A8B86;--c-mid:#7FA3D8;--press:#1b2231;--deck-drop:rgba(0,0,0,.4)}
:root[data-theme="light"]{--ground:#FAF9F5;--raise:#F2F0EA;--rule:#DFDCD3;--ink:#16181D;--dim:#5F6058;--c-mid:#3A6DA6;--press:#E7ECF4}
body{background:var(--ground);color:var(--ink)}
</style><link rel="stylesheet" href="/chat.css"></head><body><p>A page.</p>
<script src="/chat.js" data-chat="/chat" data-model="/model/" defer></script></body></html>`;

// What the next POST answers, and whether the vendored script is served at all.
const state = { events: [], mermaid: true };
const sse = (events) => events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("");
let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (req.method === "POST" && url === "/chat") { res.writeHead(200, { "content-type": "text/event-stream" }); res.end(sse(state.events)); return; }
    const files = { "/": ["text/html", PAGE], "/chat.js": ["text/javascript", asset("chat.js")], "/chat.css": ["text/css", asset("chat.css")] };
    if (state.mermaid) files["/mermaid.min.js"] = ["text/javascript", asset("mermaid.min.js")];
    const hit = files[url];
    if (!hit) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": hit[0] }); res.end(hit[1]);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

// A fresh tab, the panel opened, one question asked and its answer finished.
async function asked(events, { mermaid = true } = {}) {
  state.events = [...events, ["done", { model: null, spent: 1, dayLeft: 1 }]];
  state.mermaid = mermaid;
  const page = await browser.newPage();
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(base + "/");
  await page.click(".rbchat-open");
  await page.fill(".rbchat-form textarea", "show me");
  await page.press(".rbchat-form textarea", "Enter");
  await page.waitForSelector(".rbchat-assistant[aria-live]");
  return { page, requests };
}
const nodeFill = (page) => page.$eval(".rbchat-diagram svg a", (a) => getComputedStyle(a.querySelector("rect, path, polygon")).fill);

test("a picture is drawn under its answer, captioned, each node a link to where it lives", async () => {
  const p = PICTURES.process;
  const { page, requests } = await asked([["diagram", p], ["text", { text: "Delivery runs in three phases." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  assert.equal(await page.textContent(".rbchat-diagram figcaption span"), "Process · Delivery");
  for (const n of p.nodes) {
    const href = await page.$eval(`.rbchat-diagram svg a[aria-label="${n.title}"]`, (a) => a.getAttribute("href"));
    assert.equal(href, `/model/?stage=expanded#${n.id}`);
  }
  assert.equal(requests.filter((u) => u.endsWith("/mermaid.min.js")).length, 1);
  assert.ok(requests.every((u) => u.startsWith(base)), `only the page's own origin: ${requests.filter((u) => !u.startsWith(base))}`);
  await page.close();
});

test("an answer with no picture never fetches Mermaid", async () => {
  const { page, requests } = await asked([["text", { text: "No picture." }]]);
  assert.equal(await page.$(".rbchat-diagram"), null);
  assert.ok(!requests.some((u) => u.endsWith("/mermaid.min.js")));
  await page.close();
});

test("a title holding markup and arrows is drawn as its text", async () => {
  const { page } = await asked([["diagram", PICTURES.odd], ["text", { text: "Loop." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  const text = await page.textContent('.rbchat-diagram svg a[aria-label="odd"]');
  assert.ok(text.includes('A "quoted" <b>bold</b> #1 --> [x]'), text);
  assert.equal(await page.$(".rbchat-diagram svg b"), null, "no element was made from a title");
  await page.close();
});

test("the picture is drawn again in the theme the page switches to", async () => {
  const { page } = await asked([["diagram", PICTURES.process], ["text", { text: "Delivery." }]]);
  await page.waitForSelector(".rbchat-diagram svg a");
  assert.equal(await nodeFill(page), "rgb(23, 26, 33)");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.waitForFunction(() => { const a = document.querySelector(".rbchat-diagram svg a"); return a && getComputedStyle(a.querySelector("rect, path, polygon")).fill === "rgb(242, 240, 234)"; });
  await page.close();
});

test("a caption and its control follow the page's language", async () => {
  const { page } = await asked([["diagram", PICTURES.process], ["text", { text: "Delivery." }]]);
  await page.evaluate(() => { document.documentElement.lang = "de"; });
  await page.waitForFunction(() => document.querySelector(".rbchat-diagram figcaption span").textContent === "Prozess · Delivery");
  assert.equal(await page.getAttribute(".rbchat-diagram-full", "aria-label"), "Im Vollbild öffnen");
  await page.close();
});

test("full screen opens and Escape closes it, leaving the panel open", async () => {
  const { page } = await asked([["diagram", PICTURES.concepts], ["text", { text: "Concepts." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  assert.equal(await page.textContent(".rbchat-diagram figcaption span"), "Concepts");
  await page.click(".rbchat-diagram-full");
  assert.ok(await page.$(".rbchat-diagram.rbchat-diagram-open"));
  await page.keyboard.press("Escape");
  assert.equal(await page.$(".rbchat-diagram.rbchat-diagram-open"), null);
  assert.equal(await page.$eval(".rbchat", (p) => p.hidden), false);
  await page.close();
});

test("a conversation read back from the tab draws its picture again", async () => {
  const { page } = await asked([["diagram", PICTURES.process], ["text", { text: "Delivery." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  await page.reload();
  await page.waitForSelector(".rbchat-diagram svg a");
  assert.equal(await page.textContent(".rbchat-diagram figcaption span"), "Process · Delivery");
  await page.close();
});

test("where Mermaid cannot be fetched, the source stands in with a sentence", async () => {
  const { page } = await asked([["diagram", PICTURES.process], ["text", { text: "Delivery." }]], { mermaid: false });
  await page.waitForSelector(".rbchat-diagram pre");
  assert.equal(await page.textContent(".rbchat-diagram pre"), PICTURES.process.mermaid);
  assert.match(await page.textContent(".rbchat-diagram-failed"), /could not be drawn/);
  await page.close();
});

// Spec §5's other failure case: Mermaid loads but the source it is given does not render. The
// same fallback runs, and drawFigure's catch cleans up the leftover element Mermaid leaves in
// the body outside the box — the id it was asked to render into, and that id with a leading
// `d`. Without that cleanup line the leftover stands loose in the body: this test fails if the
// cleanup line is removed (verified by hand, see the report).
const MALFORMED = { shape: "process", title: "Broken", mermaid: "flowchart LR\n  n0[[[ -->", nodes: [{ node: "n0", id: "concepts/broken", title: "Broken", type: "concept" }], omitted: 0 };

test("a source Mermaid cannot render falls back to it, with no leftover element in the body", async () => {
  const { page } = await asked([["diagram", MALFORMED], ["text", { text: "Broken." }]]);
  await page.waitForSelector(".rbchat-diagram-failed");
  assert.equal(await page.textContent(".rbchat-diagram pre"), MALFORMED.mermaid);
  const leftover = await page.$$eval("body > [id^='drbchat-diagram-'], body > [id^='rbchat-diagram-']", (els) => els.length);
  assert.equal(leftover, 0, "Mermaid's leftover error graphic was not cleaned up");
  await page.close();
});

test("the failure sentence follows the page's language too", async () => {
  const { page } = await asked([["diagram", MALFORMED], ["text", { text: "Broken." }]]);
  await page.waitForSelector(".rbchat-diagram-failed");
  await page.evaluate(() => { document.documentElement.lang = "de"; });
  await page.waitForFunction(() => document.querySelector(".rbchat-diagram-failed").textContent === "Das Diagramm konnte nicht gezeichnet werden; dies ist seine Quelle.");
  await page.close();
});

test("a null entry among a picture's nodes is skipped, and the real nodes still draw as links", async () => {
  const withNull = { ...PICTURES.process, nodes: [PICTURES.process.nodes[0], null, PICTURES.process.nodes[2]] };
  const { page } = await asked([["diagram", withNull], ["text", { text: "Delivery." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  for (const n of [PICTURES.process.nodes[0], PICTURES.process.nodes[2]]) {
    const href = await page.$eval(`.rbchat-diagram svg a[aria-label="${n.title}"]`, (a) => a.getAttribute("href"));
    assert.equal(href, `/model/?stage=expanded#${n.id}`);
  }
  const links = await page.$$eval(".rbchat-diagram svg a", (els) => els.length);
  assert.equal(links, 2, "only the two real nodes became links");
  await page.close();
});
