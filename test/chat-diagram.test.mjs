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
import { renderPicture } from "../lib/render/processes.mjs";
import { TERMINAL } from "./fixtures/terminal.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const asset = (f) => fs.readFileSync(path.join(PKG, "assets", f));
const PICTURES = JSON.parse(fs.readFileSync(path.join(PKG, "test", "fixtures", "diagrams.json"), "utf8"));

const PAGE = `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8"><style>
/* A real page links chat.css beside its own stylesheet, which carries the family's reset;
   this stands in for the one rule of it the dialog's own sizing depends on. */
*{box-sizing:border-box}
:root{--ground:#0C0E13;--raise:#171A21;--rule:#232833;--ink:#EFEDE8;--dim:#8A8B86;--c-mid:#7FA3D8;--press:#1b2231;--deck-drop:rgba(0,0,0,.4)}
:root[data-theme="light"]{--ground:#FAF9F5;--raise:#F2F0EA;--rule:#DFDCD3;--ink:#16181D;--dim:#5F6058;--c-mid:#3A6DA6;--press:#E7ECF4}
body{background:var(--ground);color:var(--ink)}
</style><style>${TERMINAL}</style><link rel="stylesheet" href="/chat.css"></head><body><p>A page.</p>
<script src="/chat.js" data-chat="/chat" data-model="/model/" defer></script></body></html>`;

// A page built with a picture of its own, as the Processes page is: the figure writeProcesses writes, far
// enough below the fold that it is out of sight, and a tag naming no chat.
const BUILT = PAGE.replace('<p>A page.</p>', `<p>A page.</p><div style="height:3000px"></div>\n${renderPicture(PICTURES.process)}`)
  .replace('<script src="/chat.js" data-chat="/chat" data-model="/model/" defer>', '<script src="/chat.js" data-model="/model/" defer>');

// What the next POST answers, and whether the vendored script is served at all.
const state = { events: [], mermaid: true };
const sse = (events) => events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join("");
let server, base, browser;

before(async () => {
  server = http.createServer((req, res) => {
    const url = req.url.split("?")[0];
    if (req.method === "POST" && url === "/chat") { res.writeHead(200, { "content-type": "text/event-stream" }); res.end(sse(state.events)); return; }
    const files = { "/": ["text/html", PAGE], "/built": ["text/html", BUILT], "/chat.js": ["text/javascript", asset("chat.js")], "/modal.js": ["text/javascript", asset("modal.js")], "/modal.css": ["text/css", asset("modal.css")], "/chat.css": ["text/css", asset("chat.css")] };
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
async function asked(events, { mermaid = true, viewport } = {}) {
  state.events = [...events, ["done", { model: null, spent: 1, dayLeft: 1 }]];
  state.mermaid = mermaid;
  const page = await browser.newPage(viewport ? { viewport } : {});
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

test("an answer bringing two pictures draws both, in order, each fitted and each opening full screen on a click", async () => {
  const { page } = await asked([["diagram", PICTURES.context], ["diagram", PICTURES.aggregate], ["text", { text: "Quoting conforms to Catalog." }]], { viewport: { width: 1280, height: 900 } });
  await page.waitForFunction(() => document.querySelectorAll(".rbchat-diagram svg").length === 2);
  assert.deepEqual(await page.$$eval(".rbchat-diagram figcaption span", (els) => els.map((e) => e.textContent)), ["Context map · Quoting", "Aggregate · Quote"]);
  assert.deepEqual(await page.$$eval(".rbchat-diagram", (els) => els.map((f) => f.classList.contains("rbchat-diagram-fit"))), [true, true]);
  for (const f of await page.$$(".rbchat-diagram")) {
    const size = await f.$eval(".rbchat-diagram-box", (box) => ({ svg: box.querySelector("svg").getBoundingClientRect().width, box: box.clientWidth }));
    assert.ok(size.svg <= size.box + 0.5, JSON.stringify(size));
  }
  assert.match(await page.textContent(".rbchat-diagram:nth-of-type(1) .rbchat-diagram-reading"), /upstream/);
  const r = await page.$eval(".rbchat-diagram:nth-of-type(2) .rbchat-diagram-box svg", (svg) => { svg.scrollIntoView({ block: "center" }); const b = svg.getBoundingClientRect(); return { x: b.left + 2, y: b.top + 2 }; });
  await page.mouse.click(r.x, r.y);
  await page.waitForSelector("dialog.rbmodal[open] svg");
  assert.match(await page.textContent("dialog.rbmodal[open]"), /Aggregate · Quote/);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelectorAll(".rbchat-diagram .rbchat-diagram-box svg").length === 2 && !document.querySelector("dialog.rbmodal[open]"));
  const back = await page.$eval(".rbchat-diagram:nth-of-type(2)", (f) => {
    const box = f.querySelector(".rbchat-diagram-box"), svg = box.querySelector("svg"), reading = f.querySelector(".rbchat-diagram-reading");
    return { width: svg.style.width, svg: svg.getBoundingClientRect().width, box: box.clientWidth, before: !!(box.compareDocumentPosition(reading) & Node.DOCUMENT_POSITION_FOLLOWING) };
  });
  assert.equal(back.width, "");
  assert.ok(back.svg <= back.box + 0.5, JSON.stringify(back));
  assert.ok(back.before, "the box comes before the reading line again");
  await page.close();
});

test("an answer bringing one picture draws it as before, at its own size, with no reading line for an older shape", async () => {
  const { page } = await asked([["diagram", PICTURES.process], ["text", { text: "Delivery." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  assert.equal(await page.$$eval(".rbchat-diagram-fit", (els) => els.length), 0);
  assert.equal(await page.$$eval(".rbchat-diagram-reading", (els) => els.length), 0);
  await page.close();
});

test("a picture whose shape names a property of the widget's own words gets no reading line", async () => {
  const { page } = await asked([["diagram", { ...PICTURES.process, shape: "toString" }], ["text", { text: "Delivery." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  assert.equal(await page.$$eval(".rbchat-diagram-reading", (els) => els.length), 0);
  await page.close();
});

test("a language switch relabels every picture's caption and reading line", async () => {
  const { page } = await asked([["diagram", PICTURES.context], ["diagram", PICTURES.aggregate], ["text", { text: "Quoting." }]]);
  await page.waitForFunction(() => document.querySelectorAll(".rbchat-diagram svg").length === 2);
  await page.evaluate(() => document.documentElement.setAttribute("lang", "de"));
  await page.waitForFunction(() => [...document.querySelectorAll(".rbchat-diagram figcaption span")].map((e) => e.textContent).join("|") === "Context Map · Quoting|Aggregat · Quote");
  assert.match(await page.textContent(".rbchat-diagram:nth-of-type(1) .rbchat-diagram-reading"), /Pfeile/);
  assert.match(await page.textContent(".rbchat-diagram:nth-of-type(2) .rbchat-diagram-reading"), /Rauten/);
  assert.deepEqual(await page.$$eval(".rbchat-diagram figcaption span", (els) => els.map((e) => e.textContent)), ["Context Map · Quoting", "Aggregat · Quote"]);
  await page.close();
});

test("a second picture Mermaid cannot render falls back alone, and the first stays drawn", async () => {
  const broken = { ...PICTURES.aggregate, mermaid: "classDiagram\n  class n0[\"Quote\"] {\n    <<aggregate root>>\n" };
  const { page } = await asked([["diagram", PICTURES.context], ["diagram", broken], ["text", { text: "Quoting." }]]);
  await page.waitForSelector(".rbchat-diagram-failed");
  assert.equal(await page.$$eval(".rbchat-diagram:nth-of-type(1) svg", (els) => els.length), 1);
  assert.equal(await page.$$eval(".rbchat-diagram:nth-of-type(2) .rbchat-diagram-failed", (els) => els.length), 1);
  await page.close();
});

test("a conversation read back draws every picture again, and a turn kept with one picture under the old key too", async () => {
  const { page } = await asked([["diagram", PICTURES.context], ["diagram", PICTURES.aggregate], ["text", { text: "Quoting." }]]);
  await page.waitForFunction(() => document.querySelectorAll(".rbchat-diagram svg").length === 2);
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll(".rbchat-diagram svg a").length > 0 && document.querySelectorAll(".rbchat-diagram").length === 2);
  assert.deepEqual(await page.$$eval(".rbchat-diagram figcaption span", (els) => els.map((e) => e.textContent)), ["Context map · Quoting", "Aggregate · Quote"]);
  // Leaving the page keeps the conversation again, so the old shape is written by a script that
  // runs on the next load, before the widget reads the tab's storage.
  await page.addInitScript(() => {
    const raw = sessionStorage.getItem("chat");
    const kept = raw && JSON.parse(raw);
    const t = kept && kept.turns.find((x) => x.role === "assistant" && x.diagrams);
    if (!t) return;
    t.diagram = t.diagrams[0]; delete t.diagrams;
    sessionStorage.setItem("chat", JSON.stringify(kept));
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll(".rbchat-diagram").length === 1 && document.querySelector(".rbchat-diagram svg"));
  assert.equal(await page.textContent(".rbchat-diagram figcaption span"), "Context map · Quoting");
  await page.close();
});

test("a picture of the schemas links each type to its schema's file and is captioned as the meta-model", async () => {
  const p = PICTURES.schema;
  const { page } = await asked([["diagram", p], ["text", { text: "A phase is nested in a process." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  assert.equal(await page.textContent(".rbchat-diagram figcaption span"), "Meta-model · phase");
  for (const n of p.nodes) {
    const href = await page.$eval(`.rbchat-diagram svg a[aria-label="${n.title}"]`, (a) => a.getAttribute("href"));
    assert.equal(href, n.url);
  }
  // A type reads as a link like any node, and a multiplicity is an edge label, dim like the field.
  assert.equal(await page.$eval(".rbchat-diagram svg a .nodeLabel", (el) => getComputedStyle(el).color), "rgb(127, 163, 216)");
  const many = await page.$$eval(".rbchat-diagram svg .edgeLabel p", (els) => els.filter((el) => /^\d/.test(el.textContent.trim())).map((el) => getComputedStyle(el).color));
  assert.ok(many.length > 0 && many.every((c) => c === "rgb(135, 147, 163)"), String(many));
  await page.close();
});

test("an answer with no picture never fetches Mermaid", async () => {
  const { page, requests } = await asked([["text", { text: "No picture." }]]);
  assert.equal(await page.$(".rbchat-diagram"), null);
  assert.ok(!requests.some((u) => u.endsWith("/mermaid.min.js")));
  await page.close();
});

test("a linked node's name is the link color, its type line quiet and smaller, in both themes", async () => {
  const { page } = await asked([["diagram", PICTURES.typed], ["text", { text: "Neighborhood." }]]);
  await page.waitForSelector(".rbchat-diagram svg a .nodeLabel small");
  const read = () => page.$eval(".rbchat-diagram svg a .nodeLabel", (el) => {
    const small = el.querySelector("small");
    return { color: getComputedStyle(el).color, titleSize: parseFloat(getComputedStyle(el).fontSize), smallColor: getComputedStyle(small).color, smallSize: parseFloat(getComputedStyle(small).fontSize) };
  });
  const dark = await read();
  assert.equal(dark.color, "rgb(127, 163, 216)", "the node's name is --c-mid");
  assert.equal(dark.smallColor, "rgb(135, 147, 163)", "the type line is the terminal's dim");
  assert.ok(dark.smallSize < dark.titleSize, `the type line is smaller: ${dark.smallSize} vs ${dark.titleSize}`);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".rbchat-diagram svg a .nodeLabel")).color === "rgb(58, 109, 166)");
  const light = await read();
  assert.equal(light.smallColor, "rgb(103, 97, 82)", "the type line follows the light terminal's dim too");
  await page.close();
});

test("hovering or focusing a node underlines its name alone, never its type line", async () => {
  const { page } = await asked([["diagram", PICTURES.typed], ["text", { text: "Neighborhood." }]]);
  await page.waitForSelector(".rbchat-diagram svg a .rbchat-node-name");
  const read = () => page.$eval(".rbchat-diagram svg a", (a) => ({
    name: getComputedStyle(a.querySelector(".rbchat-node-name")).textDecorationLine,
    label: getComputedStyle(a.querySelector(".nodeLabel")).textDecorationLine
  }));
  const before = await read();
  assert.equal(await page.$eval(".rbchat-diagram svg a .rbchat-node-name", (el) => getComputedStyle(el).color), "rgb(127, 163, 216)", "the wrapped name is --c-mid, not Mermaid's span color");
  assert.equal(before.name, "none");
  assert.equal(before.label, "none");
  await page.hover(".rbchat-diagram svg a");
  const hovered = await read();
  assert.equal(hovered.name, "underline");
  assert.equal(hovered.label, "none", "the label itself, and so the type line inside it, is not under a propagated underline");
  await page.close();
});

test("a node's name span holds the title alone, never the type line above it", async () => {
  const { page } = await asked([["diagram", PICTURES.typed], ["text", { text: "Neighborhood." }]]);
  await page.waitForSelector(".rbchat-diagram svg a .rbchat-node-name");
  const text = await page.$eval(".rbchat-diagram svg a .rbchat-node-name", (el) => el.textContent);
  assert.equal(text, "Concept A");
  await page.close();
});

test("a class diagram's node, with no type line, gets one name span around its whole title", async () => {
  const { page } = await asked([["diagram", PICTURES.concepts], ["text", { text: "Concepts." }]]);
  await page.waitForSelector(".rbchat-diagram svg a .rbchat-node-name");
  const text = await page.$eval(".rbchat-diagram svg a .rbchat-node-name", (el) => el.textContent);
  assert.equal(text, "Billing period");
  await page.close();
});

test("an edge label's text is dim and its background is off the panel's own ground", async () => {
  const { page } = await asked([["diagram", PICTURES.typed], ["text", { text: "Neighborhood." }]]);
  await page.waitForSelector(".rbchat-diagram svg .edgeLabel");
  const edge = await page.$eval(".rbchat-diagram svg span.edgeLabel", (el) => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor }));
  assert.equal(edge.color, "rgb(135, 147, 163)", "the edge label's text is the terminal's dim");
  assert.notEqual(edge.background, "rgb(12, 14, 19)", "no longer the old ground the label sat on");
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
  assert.equal(await nodeFill(page), "rgb(22, 30, 41)");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.waitForFunction(() => { const a = document.querySelector(".rbchat-diagram svg a"); return a && getComputedStyle(a.querySelector("rect, path, polygon")).fill === "rgb(239, 236, 229)"; });
  await page.close();
});

test("a caption and its control follow the page's language", async () => {
  const { page } = await asked([["diagram", PICTURES.process], ["text", { text: "Delivery." }]]);
  await page.evaluate(() => { document.documentElement.lang = "de"; });
  await page.waitForFunction(() => document.querySelector(".rbchat-diagram figcaption span").textContent === "Prozess · Delivery");
  assert.equal(await page.getAttribute(".rbchat-diagram-full", "aria-label"), "Im Vollbild öffnen");
  await page.close();
});

test("Expand opens a dialog modal holding the picture, its node links intact", async () => {
  const p = PICTURES.typed;
  const { page } = await asked([["diagram", p], ["text", { text: "Neighborhood." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  await page.click(".rbchat-diagram-full");
  await page.waitForSelector("dialog.rbmodal[open] svg");
  for (const n of p.nodes) {
    const href = await page.$eval(`dialog.rbmodal svg a[aria-label="${n.title}"]`, (a) => a.getAttribute("href"));
    assert.equal(href, `/model/?stage=expanded#${n.id}`);
  }
  const label = await page.$eval("dialog.rbmodal svg a .nodeLabel", (el) => ({ color: getComputedStyle(el).color, smallColor: getComputedStyle(el.querySelector("small")).color }));
  assert.equal(label.color, "rgb(127, 163, 216)", "the node's name is still --c-mid in the moved box");
  assert.equal(label.smallColor, "rgb(135, 147, 163)", "its type line is still the terminal's dim in the moved box");
  await page.close();
});

test("the dialog names itself by the caption it holds", async () => {
  const p = PICTURES.process;
  const { page } = await asked([["diagram", p], ["text", { text: "Delivery." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  await page.click(".rbchat-diagram-full");
  await page.waitForSelector("dialog.rbmodal[open]");
  const labelledby = await page.getAttribute("dialog.rbmodal", "aria-labelledby");
  assert.ok(labelledby, "the dialog carries aria-labelledby");
  assert.equal(await page.$eval(`#${labelledby}`, (el) => el.textContent), "Process · Delivery");
  await page.close();
});

test("the ×'s note names the key that also closes the dialog", async () => {
  const { page } = await asked([["diagram", PICTURES.process], ["text", { text: "Delivery." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  await page.click(".rbchat-diagram-full");
  await page.waitForSelector("dialog.rbmodal[open]");
  assert.match(await page.getAttribute(".rbmodal-close", "data-tip"), /Esc/);
  await page.close();
});

test("on a phone the dialog fills the screen, borderless", async () => {
  const p = PICTURES.process;
  const { page } = await asked([["diagram", p], ["text", { text: "Delivery." }]], { viewport: { width: 390, height: 844 } });
  await page.waitForSelector(".rbchat-diagram svg");
  await page.click(".rbchat-diagram-full");
  await page.waitForSelector("dialog.rbmodal[open]");
  const box = await page.$eval("dialog.rbmodal", (d) => {
    const r = d.getBoundingClientRect();
    return { width: r.width, height: r.height, border: parseFloat(getComputedStyle(d).borderWidth) };
  });
  assert.ok(Math.abs(box.width - 390) <= 1, `width ${box.width}`);
  assert.ok(Math.abs(box.height - 844) <= 1, `height ${box.height}`);
  assert.equal(box.border, 0);
  await page.close();
});

test("Escape closes the dialog, the panel stays open and the picture is back in the figure", async () => {
  const { page } = await asked([["diagram", PICTURES.concepts], ["text", { text: "Concepts." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  await page.click(".rbchat-diagram-full");
  await page.waitForSelector("dialog.rbmodal[open]");
  await page.keyboard.press("Escape");
  // The dialog's "close" event is queued rather than fired inline with the attribute's removal,
  // so the wait is for the box actually being back, not merely for [open] to be gone.
  await page.waitForFunction(() => document.querySelector(".rbchat-diagram svg") && !document.querySelector("dialog.rbmodal[open]"));
  assert.equal(await page.$eval(".rbchat", (p) => p.hidden), false);
  assert.ok(await page.$(".rbchat-diagram svg"), "the svg is back inside the figure");
  await page.close();
});

test("Escape leaves the panel open while a dialog of another kind is open on the page", async () => {
  const { page } = await asked([["text", { text: "No picture." }]]);
  // A stand-in for the stage's own dialog.modal — any modal dialog, not this widget's — since
  // the guard has to hold on a page that carries both, not only on this one's own.
  await page.evaluate(() => {
    const d = document.createElement("dialog");
    d.id = "other-modal";
    document.body.appendChild(d);
    d.showModal();
  });
  await page.keyboard.press("Escape");
  assert.equal(await page.$eval(".rbchat", (p) => p.hidden), false, "the panel closed behind the other dialog");
  await page.close();
});

test("the dialog's × closes it", async () => {
  const { page } = await asked([["diagram", PICTURES.concepts], ["text", { text: "Concepts." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  await page.click(".rbchat-diagram-full");
  await page.waitForSelector("dialog.rbmodal[open]");
  await page.click(".rbmodal-close");
  assert.equal(await page.$("dialog.rbmodal[open]"), null);
  await page.close();
});

test("a click on the backdrop closes the dialog", async () => {
  const { page } = await asked([["diagram", PICTURES.concepts], ["text", { text: "Concepts." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  await page.click(".rbchat-diagram-full");
  await page.waitForSelector("dialog.rbmodal[open]");
  // Near the viewport's corner: the dialog is centered and inset from every edge, so this
  // point is always on the backdrop and never on the box it holds.
  await page.mouse.click(2, 2);
  assert.equal(await page.$("dialog.rbmodal[open]"), null);
  await page.close();
});

test("a theme change while the dialog is open redraws the picture inside it", async () => {
  const { page } = await asked([["diagram", PICTURES.process], ["text", { text: "Delivery." }]]);
  await page.waitForSelector(".rbchat-diagram svg a");
  await page.click(".rbchat-diagram-full");
  await page.waitForSelector("dialog.rbmodal[open] svg a");
  const fill = () => page.$eval("dialog.rbmodal svg a", (a) => getComputedStyle(a.querySelector("rect, path, polygon")).fill);
  assert.equal(await fill(), "rgb(22, 30, 41)");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.waitForFunction(() => { const a = document.querySelector("dialog.rbmodal svg a"); return a && getComputedStyle(a.querySelector("rect, path, polygon")).fill === "rgb(239, 236, 229)"; });
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

// ── a page's own picture ──────────────────────────────────────────────────────────────────

async function built(viewport) {
  const page = await browser.newPage(viewport ? { viewport } : {});
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto(base + "/built");
  return { page, requests };
}

test("a page's own picture is drawn once it nears the screen, with no chat on the tag, each node a link", async () => {
  state.mermaid = true;
  const { page, requests } = await built();
  await page.waitForTimeout(300);
  assert.equal(requests.filter((u) => u.endsWith("/mermaid.min.js")).length, 0, "not fetched while out of sight");
  assert.equal(await page.$(".rbchat-open"), null, "no chat button on a tag that names no chat");
  await page.$eval("figure[data-diagram]", (f) => f.scrollIntoView());
  await page.waitForSelector("figure[data-diagram] svg");
  assert.equal(await page.textContent("figure[data-diagram] figcaption span"), "Process · Delivery");
  for (const n of PICTURES.process.nodes) {
    const href = await page.$eval(`figure[data-diagram] svg a[aria-label="${n.title}"]`, (a) => a.getAttribute("href"));
    assert.equal(href, `../model/?stage=expanded#${n.id}`, "relative, as the page check asks of a page's own links");
  }
  await page.close();
});

test("a page's picture follows the page's language, and Expand draws one not yet scrolled to", async () => {
  state.mermaid = true;
  const { page } = await built();
  await page.evaluate(() => { document.documentElement.lang = "de"; });
  await page.waitForFunction(() => document.querySelector("figure[data-diagram] figcaption span").textContent === "Prozess · Delivery");
  await page.$eval(".rbchat-diagram-full", (b) => b.click());
  await page.waitForSelector("dialog.rbmodal[open] svg");
  assert.equal(await page.getAttribute(".rbchat-modal-fit", "aria-label"), "Auf den Bildschirm einpassen");
  await page.close();
});

// ── the zoom ──────────────────────────────────────────────────────────────────────────────

const scaleOf = (page) => page.$eval("dialog.rbmodal svg", (svg) => new DOMMatrix(getComputedStyle(svg).transform).a);
const shiftOf = (page) => page.$eval("dialog.rbmodal svg", (svg) => { const m = new DOMMatrix(getComputedStyle(svg).transform); return { x: m.e, y: m.f }; });
async function expanded(viewport) {
  const { page } = await asked([["diagram", PICTURES.process], ["text", { text: "Delivery." }]], viewport ? { viewport } : {});
  await page.waitForSelector(".rbchat-diagram svg");
  await page.click(".rbchat-diagram-full");
  await page.waitForSelector("dialog.rbmodal[open] svg");
  return page;
}

test("Expand opens the picture fitted to the sheet and centered", async () => {
  const page = await expanded();
  const fit = await page.evaluate(() => {
    const box = document.querySelector("dialog.rbmodal .rbchat-diagram-box").getBoundingClientRect();
    const svg = document.querySelector("dialog.rbmodal svg").getBoundingClientRect();
    return { box: [box.left, box.top, box.right, box.bottom], svg: [svg.left, svg.top, svg.right, svg.bottom] };
  });
  const [bl, bt, br, bb] = fit.box, [sl, st, sr, sb] = fit.svg;
  assert.ok(sl >= bl - 1 && sr <= br + 1 && st >= bt - 1 && sb <= bb + 1, `inside the box: ${JSON.stringify(fit)}`);
  assert.ok(Math.abs((sl - bl) - (br - sr)) <= 2, "centered across");
  assert.ok(Math.abs(sr - sl - (br - bl)) <= 2 || Math.abs(sb - st - (bb - bt)) <= 2 || await scaleOf(page) === 2, "touches two sides, or is at the cap");
  await page.close();
});

test("+, − and Fit zoom and fit again, from the buttons and from the keys", async () => {
  const page = await expanded();
  const fitted = await scaleOf(page);
  await page.click(".rbchat-modal-zoom button:nth-child(2)");
  assert.ok(Math.abs(await scaleOf(page) - fitted * 1.25) < 1e-3, `${fitted} then ${await scaleOf(page)}`);
  await page.click(".rbchat-modal-zoom button:nth-child(1)");
  assert.ok(Math.abs(await scaleOf(page) - fitted) < 1e-3);
  await page.keyboard.press("+"); await page.keyboard.press("+");
  assert.ok(Math.abs(await scaleOf(page) - fitted * 1.5625) < 1e-3);
  await page.keyboard.press("0");
  assert.ok(Math.abs(await scaleOf(page) - fitted) < 1e-3);
  await page.click(".rbchat-modal-fit");
  assert.ok(Math.abs(await scaleOf(page) - fitted) < 1e-3);
  assert.match(await page.getAttribute(".rbchat-modal-zoom button:nth-child(2)", "data-tip"), /Zoom in · \+/);
  await page.close();
});

test("Ctrl and the wheel zoom about the pointer, and the plain wheel moves the picture", async () => {
  const page = await expanded();
  const fitted = await scaleOf(page);
  const center = () => page.$eval('dialog.rbmodal svg a[aria-label="Build"]', (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  // A mouse event reports whole pixels, so the zoom is anchored where the pointer truly is: on
  // the center rounded to a pixel. A pointer left between pixels would anchor the zoom up to a
  // pixel away from the point compared, and the zoom multiplies that gap.
  const c = await center();
  const a = { x: Math.round(c.x), y: Math.round(c.y) };
  await page.mouse.move(a.x, a.y);
  const nudge = { x: c.x - a.x, y: c.y - a.y };
  await page.keyboard.down("Control"); await page.mouse.wheel(0, -100); await page.keyboard.up("Control");
  assert.ok(await scaleOf(page) > fitted, "zoomed in");
  const b = await page.$eval('dialog.rbmodal svg a[aria-label="Build"]', (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  // The point under the pointer stays; the node's center, a fraction off it, moves by that
  // fraction scaled, which stays well inside the tolerance.
  assert.ok(Math.abs(c.x - b.x) < 1.5 && Math.abs(c.y - b.y) < 1.5, `the point under the pointer stays: ${JSON.stringify([c, b, nudge])}`);
  const before = await shiftOf(page);
  await page.mouse.wheel(0, 50);
  const after = await shiftOf(page);
  assert.ok(Math.abs(after.y - (before.y - 50)) < 0.01 && Math.abs(after.x - before.x) < 0.01, "the plain wheel pans");
  await page.close();
});

test("a drag moves the picture and follows no link; a still press on a node opens the graph on it", async () => {
  const page = await expanded();
  const node = await page.$eval('dialog.rbmodal svg a[aria-label="Build"]', (el) => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  const before = await shiftOf(page);
  await page.mouse.move(node.x, node.y); await page.mouse.down();
  await page.mouse.move(node.x + 40, node.y + 30, { steps: 5 }); await page.mouse.up();
  const after = await shiftOf(page);
  assert.ok(Math.abs(after.x - before.x - 40) < 1.5 && Math.abs(after.y - before.y - 30) < 1.5, JSON.stringify([before, after]));
  assert.equal(new URL(page.url()).pathname, "/", "the drag followed no link");
  await page.$eval("dialog.rbmodal svg", () => {});
  // A still press is a click on the node's link, and a link into the model from the chat opens
  // the graph over the page rather than leaving it.
  await page.mouse.click(node.x + 40, node.y + 30);
  await page.waitForSelector("dialog.rbmodal-graph[open]");
  assert.equal(new URL(page.url()).pathname, "/", "the press left the page");
  assert.match(await page.$eval("iframe.rbchat-graph-frame", (f) => f.getAttribute("src")), /\/model\/\?stage=expanded&embed#processes\/delivery\/phases\/build$/);
  await page.close();
});

test("two fingers pinch the picture on a phone", async () => {
  const page = await expanded({ width: 390, height: 844 });
  const fitted = await scaleOf(page);
  await page.$eval("dialog.rbmodal .rbchat-diagram-box", (box) => {
    const r = box.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ev = (type, id, x) => box.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: x, clientY: cy, bubbles: true, isPrimary: id === 1 }));
    ev("pointerdown", 1, cx - 20); ev("pointerdown", 2, cx + 20);
    ev("pointermove", 1, cx - 40); ev("pointermove", 2, cx + 40);
    ev("pointerup", 1, cx - 40); ev("pointerup", 2, cx + 40);
  });
  const k = await scaleOf(page);
  assert.ok(k > fitted * 1.5, `pinched out: ${fitted} to ${k}`);
  await page.close();
});

test("closing gives the page its picture back as it was, unzoomed and scrolling", async () => {
  const page = await expanded();
  await page.keyboard.press("+");
  await page.keyboard.press("Escape");
  // The close event is queued, so the wait is for the box being back in its figure.
  await page.waitForFunction(() => document.querySelector(".rbchat-diagram .rbchat-diagram-box svg") && !document.querySelector("dialog.rbmodal[open]"));
  const back = await page.$eval(".rbchat-diagram .rbchat-diagram-box", (box) => ({ cls: box.className, transform: box.querySelector("svg").style.transform, overflow: getComputedStyle(box).overflow }));
  assert.deepEqual(back, { cls: "rbchat-diagram-box", transform: "", overflow: "auto" });
  await page.close();
});

test("a theme change while zoomed keeps the view the visitor left", async () => {
  const page = await expanded();
  await page.keyboard.press("+");
  const k = await scaleOf(page);
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
  await page.waitForFunction(() => getComputedStyle(document.querySelector("dialog.rbmodal svg a rect, dialog.rbmodal svg a path, dialog.rbmodal svg a polygon")).fill !== "rgb(22, 30, 41)");
  await page.waitForFunction((want) => Math.abs(new DOMMatrix(getComputedStyle(document.querySelector("dialog.rbmodal svg")).transform).a - want) < 1e-3, k);
  await page.close();
});

test("a page's picture is fitted to its column, and a click on it outside a node opens it to be read", async () => {
  state.mermaid = true;
  const { page } = await built({ width: 700, height: 800 });
  await page.$eval("figure[data-diagram]", (f) => f.scrollIntoView());
  await page.waitForSelector("figure[data-diagram] svg");
  const size = await page.$eval("figure[data-diagram] .rbchat-diagram-box", (box) => ({ box: box.clientWidth, svg: box.querySelector("svg").getBoundingClientRect().width, scroll: box.scrollWidth }));
  assert.ok(size.svg <= size.box + 0.5 && size.scroll <= size.box, JSON.stringify(size));
  const r = await page.$eval("figure[data-diagram] .rbchat-diagram-box svg", (svg) => { svg.scrollIntoView({ block: "center" }); const b = svg.getBoundingClientRect(); return { x: b.left + 2, y: b.top + 2 }; });
  await page.mouse.click(r.x, r.y);
  await page.waitForSelector("dialog.rbmodal[open] svg");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("figure[data-diagram] .rbchat-diagram-box svg") && !document.querySelector("dialog.rbmodal[open]"));
  const back = await page.$eval("figure[data-diagram] .rbchat-diagram-box", (box) => ({ w: box.querySelector("svg").style.width, fits: box.querySelector("svg").getBoundingClientRect().width <= box.clientWidth + 0.5 }));
  assert.deepEqual(back, { w: "", fits: true });
  await page.close();
});

test("a page's own picture opened full screen is drawn in the terminal's colors, and given back in the page's", async () => {
  state.mermaid = true;
  const { page } = await built({ width: 1200, height: 900 });
  await page.$eval("figure[data-diagram]", (f) => f.scrollIntoView());
  await page.waitForSelector("figure[data-diagram] svg a");
  const fill = (sel) => page.$eval(sel, (a) => getComputedStyle(a.querySelector("rect, path, polygon")).fill);
  const onPage = await fill("figure[data-diagram] svg a");
  await page.click("figure[data-diagram] .rbchat-diagram-full");
  await page.waitForFunction(() => { const a = document.querySelector("dialog.rbmodal[open] svg a"); return a && getComputedStyle(a.querySelector("rect, path, polygon")).fill === "rgb(22, 30, 41)"; });
  await page.keyboard.press("Escape");
  await page.waitForFunction((was) => { const a = document.querySelector("figure[data-diagram] svg a"); return a && getComputedStyle(a.querySelector("rect, path, polygon")).fill === was; }, onPage);
  await page.close();
});

test("a second Expand while the modal is still on its way opens one modal, not two", async () => {
  const page = await browser.newPage();
  await page.route("**/modal.js", async (r) => { await new Promise((w) => setTimeout(w, 700)); await r.continue(); });
  state.mermaid = true;
  await page.goto(base + "/built");
  await page.waitForSelector(".rbchat-diagram-full", { state: "attached" });
  await page.evaluate(() => { const b = document.querySelector(".rbchat-diagram-full"); b.click(); b.click(); });
  await page.waitForSelector("dialog.rbmodal[open]");
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => document.querySelectorAll("dialog.rbmodal").length), 1);
  assert.equal(await page.evaluate(() => document.querySelectorAll("dialog.rbmodal[open] .rbmodal-controls button").length > 0), true, "the open modal has its zoom");
  await page.close();
});

test("a modal another script has loaded is used only once its stylesheet has arrived", async () => {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.rbModal = { labels() {}, ready: new Promise((r) => { window.readyNow = r; }),
      open() { window.opened = (window.opened || 0) + 1; const d = document.createElement("dialog"); document.body.appendChild(d); return { el: d, title() {}, close() {} }; } };
  });
  state.mermaid = true;
  await page.goto(base + "/built");
  await page.waitForSelector(".rbchat-diagram-full", { state: "attached" });
  await page.$eval(".rbchat-diagram-full", (b) => b.click());
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.opened || 0), 0, "opened before the stylesheet arrived");
  await page.evaluate(() => window.readyNow());
  await page.waitForFunction(() => window.opened === 1);
  await page.close();
});

test("an answer bringing a context, an aggregate, a flow and a lifecycle draws four fitted figures in order, each opening full screen", async () => {
  const four = [PICTURES.context, PICTURES.aggregate, PICTURES.flow, PICTURES.lifecycle];
  const { page } = await asked([...four.map((p) => ["diagram", p]), ["text", { text: "Quoting." }]], { viewport: { width: 1280, height: 900 } });
  await page.waitForFunction(() => document.querySelectorAll(".rbchat-diagram svg").length === 4);
  assert.deepEqual(await page.$$eval(".rbchat-diagram figcaption span", (els) => els.map((e) => e.textContent)), ["Context map · Quoting", "Aggregate · Quote", "Flow · Quote", "Lifecycle · Quote"]);
  assert.deepEqual(await page.$$eval(".rbchat-diagram", (els) => els.map((f) => f.classList.contains("rbchat-diagram-fit"))), [true, true, true, true]);
  assert.equal(await page.$$eval(".rbchat-diagram-failed", (els) => els.length), 0);
  const figures = await page.$$(".rbchat-diagram");
  assert.match(await figures[2].$eval(".rbchat-diagram-reading", (e) => e.textContent), /commands/);
  assert.match(await figures[3].$eval(".rbchat-diagram-reading", (e) => e.textContent), /state/);
  for (const [fig, caption] of [[figures[2], "Flow · Quote"], [figures[3], "Lifecycle · Quote"]]) {
    const r = await fig.$eval(".rbchat-diagram-box svg", (svg) => { svg.scrollIntoView({ block: "center" }); const b = svg.getBoundingClientRect(); return { x: b.left + 2, y: b.top + 2 }; });
    await page.mouse.click(r.x, r.y);
    await page.waitForSelector("dialog.rbmodal[open] svg");
    assert.match(await page.textContent("dialog.rbmodal[open]"), new RegExp(caption));
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog.rbmodal[open]"));
  }
  await page.close();
});

test("a flow and a lifecycle draw as SVG in both themes, with no fallback source", async () => {
  const { page } = await asked([["diagram", PICTURES.flow], ["diagram", PICTURES.lifecycle], ["text", { text: "Quote." }]]);
  await page.waitForFunction(() => document.querySelectorAll(".rbchat-diagram svg").length === 2);
  const read = () => page.$$eval(".rbchat-diagram svg", (svgs) => svgs.map((svg, i) => {
    const shape = svg.querySelector(i === 0 ? "rect.actor" : "g.node rect");
    return { note: i === 0 ? getComputedStyle(svg.querySelector("rect.note")).fill : null, text: [...svg.querySelectorAll("text, foreignObject")].map((t) => t.textContent).join(" "), fill: getComputedStyle(shape).fill };
  }));
  const dark = await read();
  assert.match(dark[0].text, /Send quote/);
  assert.match(dark[0].text, /expired/, "a branch's condition is drawn");
  assert.match(dark[0].text, /—/, "a branch that emits nothing shows a dash");
  assert.equal(dark[0].note, "rgb(22, 30, 41)", "a note is the panel's raise, not Mermaid's yellow");
  assert.match(dark[1].text, /Accepted/);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.waitForFunction((was) => [...document.querySelectorAll(".rbchat-diagram svg")].length === 2 && [...document.querySelectorAll(".rbchat-diagram svg")].every((svg, i) => getComputedStyle(svg.querySelector(i === 0 ? "rect.actor" : "g.node rect")).fill !== was[i]), dark.map((d) => d.fill));
  const light = await read();
  assert.equal(light[0].note, "rgb(239, 236, 229)", "a note is the panel's raise in the light theme too");
  assert.match(light[0].text, /Quote accepted/);
  assert.match(light[1].text, /Expired/);
  assert.equal(await page.$$eval(".rbchat-diagram-failed, .rbchat-diagram pre", (els) => els.length), 0);
  await page.close();
});

test("an organization draws each person's mark inside their box, outside the underlined name, in its nature's color", async () => {
  const { page } = await asked([["diagram", PICTURES.organization], ["text", { text: "Billing Run Team." }]]);
  await page.waitForSelector(".rbchat-diagram svg .label-icon");
  const boxes = await page.$$eval(".rbchat-diagram svg g.node", (gs) => gs.map((g) => {
    const icon = g.querySelector(".label-icon"), mark = g.querySelector(".rbchat-mark"), name = g.querySelector(".rbchat-node-name");
    const box = g.querySelector("rect").getBoundingClientRect(), label = g.querySelector(".nodeLabel").getBoundingClientRect();
    return {
      nature: mark && mark.getAttribute("class"), color: mark && getComputedStyle(mark).color, inName: !!(name && icon && name.contains(icon)),
      name: name && name.textContent.trim(), fits: label.width <= box.width && icon.getBoundingClientRect().right <= box.right,
    };
  }));
  assert.deepEqual(boxes.map((b) => [b.nature, b.name, b.inName, b.fits]), [["rbchat-mark human", "Mira Halvorsen", false, true], ["rbchat-mark agent", "AI Agent", false, true]]);
  assert.notEqual(boxes[0].color, boxes[1].color, "a person's mark and an agent's are two brightnesses");
  const [frame, agents] = await page.$$eval(".rbchat-diagram svg .cluster rect", (rs) => rs.map((r) => getComputedStyle(r).fill));
  assert.notEqual(agents, frame, "the agents' frame is shaded apart from its group's");
  assert.equal(agents, await page.$eval(".rbchat-diagram-box", (b) => { const t = document.createElement("i"); t.style.color = "var(--press)"; b.appendChild(t); const c = getComputedStyle(t).color; t.remove(); return c; }), "with the panel's press color");
  assert.equal(await page.$eval(".rbchat-diagram figcaption span", (s) => s.textContent), "Organization · Billing Run Team");
  assert.match(await page.$eval(".rbchat-diagram-reading", (p) => p.textContent), /agents stand in the shaded frame/);
  await page.close();
});

test("an organization's agents stand side by side in their frame, in the order listed", async () => {
  const { page } = await asked([["diagram", PICTURES.agents], ["text", { text: "Billing Run Team." }]]);
  await page.waitForSelector(".rbchat-diagram svg .label-icon");
  const agents = await page.$$eval(".rbchat-diagram svg g.node", (gs) => gs.filter((g) => g.querySelector(".rbchat-mark.agent")).map((g) => {
    const r = g.querySelector("rect").getBoundingClientRect();
    return { name: g.querySelector(".nodeLabel b").textContent.trim(), left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  }));
  assert.equal(agents.length, 2);
  const [first, second] = agents.sort((a, b) => a.left - b.left);
  assert.deepEqual([first.name, second.name], ["AI Agent", "Review Agent"], "the order the host listed them in");
  assert.ok(first.top < second.bottom && second.top < first.bottom, `the two boxes share a row: ${JSON.stringify(agents)}`);
  assert.ok(first.right <= second.left, `and do not overlap sideways: ${JSON.stringify(agents)}`);
  await page.close();
});

test("the company's org chart draws its open positions as dashed, unfilled boxes, and no fallback source", async () => {
  const { page } = await asked([["diagram", PICTURES.company], ["text", { text: "Beacon." }]]);
  await page.waitForSelector(".rbchat-diagram svg g.node.open");
  const open = await page.$$eval(".rbchat-diagram svg g.node.open", (gs) => gs.map((g) => { const r = g.querySelector("rect"); return [getComputedStyle(r).strokeDasharray, getComputedStyle(r).fill]; }));
  assert.equal(open.length, 3);
  for (const [dash, fill] of open) { assert.notEqual(dash, "none"); assert.equal(fill, "none"); }
  assert.equal(await page.$$eval(".rbchat-diagram svg .label-icon", (els) => els.length), 4, "four people, four marks; an opening has none");
  assert.equal(await page.$$eval(".rbchat-diagram-failed, .rbchat-diagram pre", (els) => els.length), 0);
  await page.close();
});
