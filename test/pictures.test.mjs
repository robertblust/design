// Pictures drawn when the site builds, in Chromium: drawPictures over a site root of its own,
// with the real chat.js and the vendored Mermaid, and a page carrying what it drew. The stamp,
// the token substitution and writeProcesses's inlining are in render.test.mjs.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { writeProcesses } from "../lib/render/processes.mjs";
import { drawPictures } from "../lib/pictures.mjs";
import { serve } from "../cards/export.mjs";
import { PROCESSES_FIXTURE, idAt } from "./fixtures/processes.mjs";
import { TERMINAL } from "./fixtures/terminal.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PICTURES = JSON.parse(fs.readFileSync(path.join(PKG, "test", "fixtures", "diagrams.json"), "utf8"));
const diagram = () => ({ ...PICTURES.process, title: "Doing" });
const TOKENS = `:root{--ground:#0C0E13;--raise:#171A21;--rule:#232833;--ink:#EFEDE8;--dim:#8A8B86;--c-mid:#7FA3D8;--press:#1b2231}
:root[data-theme="light"]{--ground:#FAF9F5;--raise:#F2F0EA;--rule:#DFDCD3;--ink:#16181D;--dim:#5F6058;--c-mid:#3A6DA6;--press:#E7ECF4}
*{box-sizing:border-box} body{background:var(--ground);color:var(--ink)}`;

// A site root: the Processes page with its two generated regions, the page's tokens, and the files
// the chat group ships, so the drawing runs the site's own copies as a site's would.
function site(extraStyle = "") {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rb-draw-"));
  fs.mkdirSync(path.join(dir, "processes"));
  fs.writeFileSync(path.join(dir, "processes/index.html"), `<!doctype html><html lang="en" data-theme="dark"><head><meta charset="utf-8">
<style>${TOKENS}${extraStyle}</style><style>${TERMINAL}</style><link rel="stylesheet" href="../chat.css"></head><body>
<p class="tagline">t</p>
<!-- processes-note:start -->
<!-- processes-note:end -->
<!-- processes:start -->
<!-- processes:end -->
<script src="../chat.js" data-model="../model/"></script></body></html>`);
  for (const f of ["chat.js", "chat.css", "mermaid.min.js", "modal.js", "modal.css"]) fs.copyFileSync(path.join(PKG, "assets", f), path.join(dir, f));
  return dir;
}
const quiet = async (fn) => { const was = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = was; } };
const pages = (dir, check = false) => quiet(() => writeProcesses(PROCESSES_FIXTURE, { root: dir, diagram, check }));

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

test("the site draws its pictures once, the page carries them, and the check agrees", async () => {
  const dir = site();
  await pages(dir);
  assert.deepEqual(await pages(dir, true), ["processes/index.html"], "a page without its pictures passed the check");
  const written = await drawPictures({ chromium, root: dir, log: () => {} });
  assert.deepEqual(written, ["processes/pictures/doing.svg"]);
  const svg = fs.readFileSync(path.join(dir, "processes/pictures/doing.svg"), "utf8");
  assert.ok(svg.includes("var(--raise)") && svg.includes("var(--ink)"), "the placeholders did not come back as tokens");
  assert.ok(!/rgba?\(10, ?1, ?[2-7]/.test(svg) && !/#0a010[2-7]/i.test(svg), "a placeholder was left in the picture");
  assert.ok(svg.includes('id="rbchat-picture-doing"'));
  await pages(dir);
  assert.deepEqual(await pages(dir, true), []);
  assert.ok(fs.readFileSync(path.join(dir, "processes/index.html"), "utf8").includes('<div class="rbchat-diagram-box" data-drawn><svg'));
  // Drawing again over a page that already carries its pictures draws them afresh, and the
  // page still agrees.
  await drawPictures({ chromium, root: dir, log: () => {} });
  assert.deepEqual(await pages(dir, true), []);
});

// The host names its nodes by id, a UUID once the instance has stable ids; the picture the site
// bakes links each by its address, as the renderer wrote it, so the committed SVG reads.
test("a picture baked from a model with stable ids links each node by its address", async () => {
  const dir = site();
  const phase = idAt(PROCESSES_FIXTURE, "processes/d/phases/one");
  const stable = () => ({ ...PICTURES.process, title: "Doing",
    nodes: PICTURES.process.nodes.map((n, i) => (i === 0 ? { ...n, id: phase } : n)) });
  await quiet(() => writeProcesses(PROCESSES_FIXTURE, { root: dir, diagram: stable }));
  await drawPictures({ chromium, root: dir, log: () => {} });
  const svg = fs.readFileSync(path.join(dir, "processes/pictures/doing.svg"), "utf8");
  assert.ok(svg.includes('href="../model/?stage=expanded#processes/d/phases/one"'), svg.slice(0, 400));
  assert.ok(!svg.includes(phase), "the node's UUID reached the baked link");
});

test("a picture that paints a color no token names is refused, and nothing is written", async () => {
  const dir = site(".rbchat-diagram-box svg rect{fill:#ff0000 !important}");
  await pages(dir);
  await assert.rejects(drawPictures({ chromium, root: dir, log: () => {} }), /paints a color that is no token[\s\S]*rect[\s\S]*fill rgb\(255, 0, 0\)/);
  assert.equal(fs.existsSync(path.join(dir, "processes/pictures/doing.svg")), false);
});

test("a picture drawn at build fetches no Mermaid, keeps its links, and takes the modal's colors without drawing", async () => {
  const dir = site();
  await pages(dir);
  await drawPictures({ chromium, root: dir, log: () => {} });
  await pages(dir);
  const srv = await serve(dir);
  try {
    const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });
    const mermaid = [];
    page.on("request", (r) => { if (r.url().endsWith("/mermaid.min.js")) mermaid.push(r.url()); });
    await page.goto(`http://127.0.0.1:${srv.address().port}/processes/`);
    await page.$eval("figure[data-diagram]", (f) => f.scrollIntoView());
    const hrefs = await page.$$eval("figure[data-diagram] svg a", (a) => a.map((x) => x.getAttribute("href")));
    assert.equal(hrefs.length, PICTURES.process.nodes.length);
    const fill = () => page.$eval("figure[data-diagram] svg .node rect, dialog.rbmodal svg .node rect", (r) => getComputedStyle(r).fill);
    const onPage = await fill();
    await page.evaluate(() => { window.__svg = document.querySelector("figure[data-diagram] svg"); });
    await page.click("figure[data-diagram] .rbchat-diagram-full");
    await page.waitForSelector("dialog.rbmodal[open] svg");
    await page.waitForTimeout(300);
    const inModal = await fill();
    assert.notEqual(inModal, onPage, "the modal's terminal colors did not reach the picture");
    assert.equal(await page.evaluate(() => document.querySelector("dialog.rbmodal[open] svg") === window.__svg), true, "the picture was drawn again for the modal");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog.rbmodal[open]"));
    // The page's own theme reaches it the same way.
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
    await page.waitForTimeout(300);
    assert.notEqual(await fill(), onPage, "the light theme did not reach the picture");
    assert.equal(await page.evaluate(() => document.querySelector("figure[data-diagram] svg") === window.__svg), true, "the picture was drawn again for the theme");
    assert.deepEqual(mermaid, [], "Mermaid was fetched for a picture already drawn");
    await page.close();
  } finally { srv.close(); }
});
