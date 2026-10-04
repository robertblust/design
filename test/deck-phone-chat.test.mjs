// The chat's button on a deck, in Chromium, at the widths the sites check the transport at: on
// a phone, or a screen taller than it is wide, the transport spans the bottom edge and the
// button has no place, so it is not shown; on a desk it stands beside the transport. deck.css
// comes before chat.css, as a deck links them, so the test also holds that the deck's rule
// wins over chat.css's own.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { assemble } from "../lib/assemble.mjs";

const PKG = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>${assemble("deck.css", { lockup: "one" })}</style>
<style>${fs.readFileSync(path.join(PKG, "assets", "chat.css"), "utf8")}</style></head>
<body><div class="chrome" id="chrome"><div class="transport"><button class="tbtn" id="tNext">▶</button></div></div>
<button class="rbchat-open">Ask the model</button></body></html>`;

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

async function shown(width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(PAGE);
  const display = await page.evaluate(() => getComputedStyle(document.querySelector(".rbchat-open")).display);
  await page.close();
  return display !== "none";
}

test("on every phone width the sites check, a deck shows no chat button", async () => {
  for (const width of [320, 350, 360, 390, 393, 414, 430])
    assert.equal(await shown(width, 844), false, `the chat button shows at ${width}px`);
});

test("on a screen taller than it is wide, a deck shows no chat button", async () => {
  assert.equal(await shown(900, 1200), false);
});

test("on a desk, a deck shows the chat button beside its transport", async () => {
  for (const [w, h] of [[1280, 720], [1440, 900]])
    assert.equal(await shown(w, h), true, `the chat button is hidden at ${w}×${h}`);
});
