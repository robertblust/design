// storageKeys opens the chat and then hands the page back to the suite with storage empty. A
// page that saves its state as it unloads — the chat does, so that following a link keeps the
// conversation — must not write that state back during the reload, or every later check meets
// the chat panel open over the page.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { chromium } from "playwright";
import { pageChecks } from "../verify/pages.mjs";

const PAGE = `<!doctype html><title>start</title>
<link rel="preload" as="fetch" href="/model.json" data-stage>
<button class="rbchat-open" onclick="window.opened = true; sessionStorage.setItem('chat','open')">chat</button>
<button id="lde" onclick="localStorage.setItem('lang','de')">DE</button><button id="len" onclick="localStorage.setItem('lang','en')">EN</button>
<script>
  if (sessionStorage.getItem("chat")) document.title = "reopened";
  // As the chat does: its state lives in memory and is written as the page unloads.
  addEventListener("pagehide", () => { if (window.opened) sessionStorage.setItem("chat", "open"); });
</script>`;
const MODEL = { entities: [
  { type: "stored-item", name: "chat", fields: { mechanism: "session-storage" } },
  { type: "stored-item", name: "lang", fields: { mechanism: "local-storage" } },
] };

test("after storageKeys the page reloads with storage empty, even where it saves state as it unloads", async () => {
  const server = http.createServer((req, res) => {
    if (req.url.startsWith("/model.json")) { res.setHeader("content-type", "application/json"); res.end(JSON.stringify(MODEL)); return; }
    res.setHeader("content-type", "text/html"); res.end(PAGE);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const r = await pageChecks({ SITE: base, BASE: base }).storageKeys(page, { absolute: base + "/" });
    assert.equal(r, null);
    assert.equal(await page.title(), "start", "the chat state was written back during the reload");
    assert.equal(await page.evaluate(() => sessionStorage.length + localStorage.length), 0);
  } finally { await browser.close(); server.close(); }
});
