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
/* A real page links chat.css beside its own stylesheet, which carries the family's reset;
   this stands in for the one rule of it the dialog's own sizing depends on. */
*{box-sizing:border-box}
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
  assert.ok(many.length > 0 && many.every((c) => c === "rgb(138, 139, 134)"), String(many));
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
  assert.equal(dark.smallColor, "rgb(138, 139, 134)", "the type line is --dim");
  assert.ok(dark.smallSize < dark.titleSize, `the type line is smaller: ${dark.smallSize} vs ${dark.titleSize}`);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".rbchat-diagram svg a .nodeLabel")).color === "rgb(58, 109, 166)");
  const light = await read();
  assert.equal(light.smallColor, "rgb(95, 96, 88)", "the type line follows the light theme's dim too");
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
  assert.equal(edge.color, "rgb(138, 139, 134)", "the edge label's text is --dim");
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

test("Expand opens a dialog modal holding the picture, its node links intact", async () => {
  const p = PICTURES.typed;
  const { page } = await asked([["diagram", p], ["text", { text: "Neighborhood." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  await page.click(".rbchat-diagram-full");
  await page.waitForSelector("dialog.rbchat-modal[open] svg");
  for (const n of p.nodes) {
    const href = await page.$eval(`dialog.rbchat-modal svg a[aria-label="${n.title}"]`, (a) => a.getAttribute("href"));
    assert.equal(href, `/model/?stage=expanded#${n.id}`);
  }
  const label = await page.$eval("dialog.rbchat-modal svg a .nodeLabel", (el) => ({ color: getComputedStyle(el).color, smallColor: getComputedStyle(el.querySelector("small")).color }));
  assert.equal(label.color, "rgb(127, 163, 216)", "the node's name is still --c-mid in the moved box");
  assert.equal(label.smallColor, "rgb(138, 139, 134)", "its type line is still --dim in the moved box");
  await page.close();
});

test("the dialog names itself by the caption it holds", async () => {
  const p = PICTURES.process;
  const { page } = await asked([["diagram", p], ["text", { text: "Delivery." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  await page.click(".rbchat-diagram-full");
  await page.waitForSelector("dialog.rbchat-modal[open]");
  const labelledby = await page.getAttribute("dialog.rbchat-modal", "aria-labelledby");
  assert.ok(labelledby, "the dialog carries aria-labelledby");
  assert.equal(await page.$eval(`#${labelledby}`, (el) => el.textContent), "Process · Delivery");
  await page.close();
});

test("the ×'s note names the key that also closes the dialog", async () => {
  const { page } = await asked([["diagram", PICTURES.process], ["text", { text: "Delivery." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  await page.click(".rbchat-diagram-full");
  await page.waitForSelector("dialog.rbchat-modal[open]");
  assert.match(await page.getAttribute(".rbchat-modal-close", "data-tip"), /Esc/);
  await page.close();
});

test("on a phone the dialog fills the screen, borderless", async () => {
  const p = PICTURES.process;
  const { page } = await asked([["diagram", p], ["text", { text: "Delivery." }]], { viewport: { width: 390, height: 844 } });
  await page.waitForSelector(".rbchat-diagram svg");
  await page.click(".rbchat-diagram-full");
  await page.waitForSelector("dialog.rbchat-modal[open]");
  const box = await page.$eval("dialog.rbchat-modal", (d) => {
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
  await page.waitForSelector("dialog.rbchat-modal[open]");
  await page.keyboard.press("Escape");
  // The dialog's "close" event is queued rather than fired inline with the attribute's removal,
  // so the wait is for the box actually being back, not merely for [open] to be gone.
  await page.waitForFunction(() => document.querySelector(".rbchat-diagram svg") && !document.querySelector("dialog.rbchat-modal[open]"));
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
  await page.waitForSelector("dialog.rbchat-modal[open]");
  await page.click(".rbchat-modal-close");
  assert.equal(await page.$("dialog.rbchat-modal[open]"), null);
  await page.close();
});

test("a click on the backdrop closes the dialog", async () => {
  const { page } = await asked([["diagram", PICTURES.concepts], ["text", { text: "Concepts." }]]);
  await page.waitForSelector(".rbchat-diagram svg");
  await page.click(".rbchat-diagram-full");
  await page.waitForSelector("dialog.rbchat-modal[open]");
  // Near the viewport's corner: the dialog is centered and inset from every edge, so this
  // point is always on the backdrop and never on the box it holds.
  await page.mouse.click(2, 2);
  assert.equal(await page.$("dialog.rbchat-modal[open]"), null);
  await page.close();
});

test("a theme change while the dialog is open redraws the picture inside it", async () => {
  const { page } = await asked([["diagram", PICTURES.process], ["text", { text: "Delivery." }]]);
  await page.waitForSelector(".rbchat-diagram svg a");
  await page.click(".rbchat-diagram-full");
  await page.waitForSelector("dialog.rbchat-modal[open] svg a");
  const fill = () => page.$eval("dialog.rbchat-modal svg a", (a) => getComputedStyle(a.querySelector("rect, path, polygon")).fill);
  assert.equal(await fill(), "rgb(23, 26, 33)");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await page.waitForFunction(() => { const a = document.querySelector("dialog.rbchat-modal svg a"); return a && getComputedStyle(a.querySelector("rect, path, polygon")).fill === "rgb(242, 240, 234)"; });
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
