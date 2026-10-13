// What the lineage's lines are drawn in. A wire at rest is the candidate color, as the stage's
// resting edge is: in --rule, which draws the boxes, it was a hairline lost on the dark ground.
// The page's tokens are stand-ins here, one distinct color each, so a computed color names the
// token it came from.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { writePrivacy } from "../lib/render/privacy.mjs";
import { PRIVACY_FIXTURE } from "./fixtures/privacy.mjs";

const RULE = "rgb(10, 10, 10)", WEAK = "rgb(20, 20, 20)", PATH = "rgb(30, 30, 30)";
const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), "utf8");

// A privacy path, the lineage's markup with both kinds of group, under the block's own rules.
function pageHtml() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lines-"));
  fs.mkdirSync(path.join(dir, "privacy"));
  fs.writeFileSync(path.join(dir, "privacy/index.html"), "<!-- privacy:start -->\n<!-- privacy:end -->");
  writePrivacy(PRIVACY_FIXTURE, { root: dir, site: "x" });
  const region = fs.readFileSync(path.join(dir, "privacy/index.html"), "utf8");
  return `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
    <style>:root{--rule:${RULE}; --c-weak:${WEAK}; --c-path:${PATH}; --c-firm:rgb(40, 40, 40); --c-mid:rgb(50, 50, 50)}</style>
    <style>${read("../blocks/surfaces.css")}</style>${region}
    <div id="lnpanel" hidden><div class="cbody"></div><div class="cfoot"><span></span></div></div><p id="lnhint"></p>
    <a id="srclink" data-src="model"></a><span id="srccommit"></span>
    <script>window.rbCard = { data(){}, render(){} }; var STAGE_PAGE = "../";</script><script>${read("../blocks/surfaces.js")}</script>`;
}

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser.close(); });

test("a wire at rest is drawn in the candidate color, and the chosen path in the path color", async () => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setContent(pageHtml());
  const strokes = () => page.$$eval("#wires path", (ps) => ps.map((p) => [p.classList.contains("on"), getComputedStyle(p).stroke]));
  const resting = await strokes();
  assert.ok(resting.length > 0, "the wires were drawn");
  assert.deepEqual([...new Set(resting.map(([, s]) => s))], [WEAK], "every wire at rest");
  await page.click(".ln-s");
  const chosen = await strokes();
  assert.ok(chosen.some(([on]) => on), "choosing an entry lights its path");
  for (const [on, stroke] of chosen) assert.equal(stroke, on ? PATH : WEAK);
  await page.close();
});

test("on a narrow screen the tree's rules are that color too", async () => {
  const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
  await page.setContent(pageHtml());
  assert.equal(await page.$eval("#wires", (s) => getComputedStyle(s).display), "none", "the wires give way to rules");
  for (const sel of [".ln-groups", ".ln-surfaces"])
    assert.equal(await page.$eval(sel, (el) => getComputedStyle(el).borderLeftColor), WEAK, sel);
  await page.close();
});

test("a box of the lineage is still drawn in the rule color", async () => {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.setContent(pageHtml());
  assert.equal(await page.$eval(".ln-s", (el) => getComputedStyle(el).borderTopColor), RULE);
  await page.close();
});
