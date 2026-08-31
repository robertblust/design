// planFences reading the consuming site's own config.
//
// Everything the tool substituted before this came from the package. This is the first value it
// has to go and fetch from the site, which means a new way to be misconfigured — and the one that
// matters is a page carrying the fence while the config carries no key. Writing an empty key would
// throw nowhere and would silently give every visitor of that site the same nameless storage slot.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { readConfig, planFences, applyFences } from "../lib/sync.mjs";
import { blockFor } from "../lib/fences.mjs";

function site(config, pages = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "design-params-"));
  fs.writeFileSync(path.join(root, "design.config.json"), JSON.stringify(config));
  for (const [rel, body] of Object.entries(pages)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
}
const wrap = (b) => ["<script>", "  // before", b, "  // after", "</script>"].join("\n");

test("readConfig returns langKey when the site declares one", () => {
  const root = site({ groups: ["fonts"], langKey: "rb-lang" });
  assert.equal(readConfig(root).langKey, "rb-lang");
});

test("readConfig leaves langKey undefined when the site has none", () => {
  const root = site({ groups: ["fonts"] });
  assert.equal(readConfig(root).langKey, undefined);
});

test("a page carrying the shipped block reports same", () => {
  const root = site({ groups: ["fonts"], langKey: "rb-lang" },
    { "index.html": wrap(blockFor("language", "page", { langKey: "rb-lang" })) });
  const e = planFences(root).find(x => x.fence === "language");
  assert.equal(e.state, "same");
});

test("the site's own key is what gets written, not the package's", () => {
  const stale = blockFor("language", "page", { langKey: "gg-lang" }).replace(/· v\d+ ·/, "· v0 ·");
  const root = site({ groups: ["fonts"], langKey: "gg-lang" }, { "index.html": wrap(stale) });
  applyFences(root, planFences(root));
  const out = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(out, /var LANG_KEY = "gg-lang";/);
  assert.ok(!out.includes("rb-lang"), "another site's key was written in");
});

test("a fenced page with no langKey in the config throws, naming the file and the key", () => {
  const root = site({ groups: ["fonts"] },
    { "index.html": wrap(blockFor("language", "page", { langKey: "rb-lang" })) });
  assert.throws(() => planFences(root), (e) =>
    /langKey/.test(e.message) && /design\.config\.json/.test(e.message));
});

test("a site with no language fence needs no langKey", () => {
  const root = site({ groups: ["fonts"] }, { "index.html": "<script>  // nothing</script>" });
  assert.deepEqual(planFences(root).filter(e => e.fence === "language"), []);
});

test("a second run reports same and writes nothing", () => {
  const stale = blockFor("language", "deck", { langKey: "cg-lang" }).replace(/· v\d+ ·/, "· v0 ·");
  const root = site({ groups: ["fonts"], langKey: "cg-lang" },
    { "talks/t/index.html": wrap(stale) });
  applyFences(root, planFences(root));
  const second = planFences(root);
  assert.ok(second.every(e => e.state === "same"), JSON.stringify(second));
  assert.deepEqual(applyFences(root, second), []);
});
