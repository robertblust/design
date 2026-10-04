// Where a deck's links are, in Chromium: linksOnSlide runs in a page laid out like a deck, with a
// canonical, two slides, a lockup and a chat button, and what it reports is checked against what
// a reader of the PDF should reach. The PDF side, the annotation each entry becomes, is in
// decks-export.test.mjs.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { linksOnSlide } from "../decks/export.mjs";

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<link rel="canonical" href="https://companygraph.io/talks/what-stays/">
<style>body{margin:0} .slide{display:none} .slide.active{display:block}
.transport{display:none} .rbchat-open{position:fixed; right:20px; bottom:20px; width:40px; height:30px}</style></head>
<body>
<section class="slide"><a href="../../?stage=expanded#abc">first slide's model link</a></section>
<section class="slide active"><a href="../../?stage=expanded#def">rests on</a> <a href="https://example.org/x">outside</a> <a href="javascript:void 0">script</a></section>
<a class="name" href="../">Talks</a>
<div class="transport"><a href="#">hidden control</a></div>
<button class="rbchat-open">Ask the model</button>
</body></html>`;

let browser, page;
before(async () => {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.setContent(PAGE);
});
after(async () => { await browser.close(); });

test("a slide reports its own links and the chrome's, resolved against the canonical", async () => {
  const got = await page.evaluate(linksOnSlide, { n: 1, lang: "de", W: 1280, H: 720 });
  assert.deepEqual(got.map((l) => l.url), [
    "https://companygraph.io/?stage=expanded&lang=de#def",
    "https://example.org/x",
    "https://companygraph.io/talks/?lang=de",
    "https://companygraph.io/talks/what-stays/?chat=open&lang=de#01",
  ]);
});

test("every rectangle has a size and sits inside the page", async () => {
  const got = await page.evaluate(linksOnSlide, { n: 1, lang: "en", W: 1280, H: 720 });
  for (const l of got) {
    assert.ok(l.w > 0 && l.h > 0, JSON.stringify(l));
    assert.ok(l.x >= 0 && l.y >= 0 && l.x + l.w <= 1280 && l.y + l.h <= 720, JSON.stringify(l));
  }
  const chat = got.at(-1);
  assert.deepEqual([chat.x, chat.y, chat.w, chat.h], [1220, 670, 40, 30]);
});

test("the title slide's chat link opens the deck at its plain address", async () => {
  const got = await page.evaluate(linksOnSlide, { n: 0, lang: "en", W: 1280, H: 720 });
  assert.equal(got.at(-1).url, "https://companygraph.io/talks/what-stays/?chat=open&lang=en");
});
