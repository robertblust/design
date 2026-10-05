// The lineage block draws a group's wires dashed when the group is a hand group, whatever its
// data-maker says: /surfaces/ marks its hand group with data-maker="hand", the privacy path its
// storage groups with their mechanism, and both carry the .ln-group.hand class the block reads.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { writePrivacy } from "../lib/render/privacy.mjs";
import { PRIVACY_FIXTURE } from "./fixtures/privacy.mjs";

test("the storage groups' wires are drawn dashed, the activities' solid", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hand-"));
  fs.mkdirSync(path.join(dir, "privacy"));
  fs.writeFileSync(path.join(dir, "privacy/index.html"), "<!-- privacy:start -->\n<!-- privacy:end -->");
  writePrivacy(PRIVACY_FIXTURE, { root: dir, site: "x" });
  const region = fs.readFileSync(path.join(dir, "privacy/index.html"), "utf8");
  const block = fs.readFileSync(new URL("../blocks/surfaces.js", import.meta.url), "utf8");
  const html = `<!doctype html><style>.lineage{position:relative;display:grid;grid-template-columns:13rem 1fr}</style>${region}
    <div id="lnpanel" hidden><div class="cbody"></div><div class="cfoot"><span></span></div></div><p id="lnhint"></p>
    <a id="srclink" data-src="model"></a><span id="srccommit"></span>
    <script>window.rbCard = { data(){}, render(){} }; var STAGE_PAGE = "../";</script><script>${block}</script>`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html);
    const wires = await page.$$eval("#wires path", (ps) => ps.map((p) => p.getAttribute("class") || ""));
    const hand = wires.filter((c) => c.split(" ").includes("hand")).length;
    // Root to two storage groups, and each to its keys: 2 + 2 + 1 dashed; the two activities and their three rows solid.
    assert.equal(hand, 5, `classes were ${JSON.stringify(wires)}`);
    assert.equal(wires.length - hand, 5);
  } finally { await browser.close(); }
});
