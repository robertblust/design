// A surface's card in the lineage block, in Chromium: a name holding a host longer than the
// column, such as chat.azure.companygraph.io, wraps inside the card rather than widening the
// page. The surfaces page of companygraph.io scrolled sideways by five pixels at 800px the day
// the model named its Azure surfaces (2026-11-07), which the shared page check refuses.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CSS = fs.readFileSync(path.join(PKG, "blocks", "surfaces.css"), "utf8");
// The card as lib/render/surfaces.mjs writes it, in a column as narrow as the lineage grid gives
// it at 800px, set near the right edge so an overflow leaves the viewport.
const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${CSS}</style></head>
<body><div style="width:152px;margin-left:300px"><ul class="ln-surfaces"><li>
<button class="ln-s" type="button"><span class="nm">chat.azure.companygraph.io chat</span><span class="host">chat.azure.companygraph.io</span></button>
</li></ul></div></body></html>`;

let server, base, browser;
before(async () => {
  server = http.createServer((req, res) => { res.writeHead(200, { "content-type": "text/html" }); res.end(PAGE); });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
});
after(async () => { await browser.close(); await new Promise((r) => server.close(r)); });

test("a surface whose name holds a host longer than its column wraps inside the card", async () => {
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  await page.goto(base + "/");
  const r = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth, name: document.querySelector(".ln-s .nm").getBoundingClientRect().right, lines: Math.round(document.querySelector(".ln-s .nm").getBoundingClientRect().height / parseFloat(getComputedStyle(document.querySelector(".ln-s .nm")).lineHeight)) }));
  assert.ok(r.scroll <= r.inner, `the page scrolls sideways: ${r.scroll} > ${r.inner}`);
  assert.ok(r.name <= 400, `the name sticks out to ${r.name}`);
  assert.ok(r.lines >= 2, "the name wrapped onto a second line");
  await page.close();
});
