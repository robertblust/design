// Fence planning and application against throwaway sites.
//
// The property that matters most is the one the CI check rests on: a second run must reach
// "same" for everything. If it did not, design:check would fail on every run and the tripwire
// would be noise instead of signal.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { findPages, planFences, applyFences } from "../lib/sync.mjs";
import { blockFor } from "../lib/fences.mjs";

function site(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "design-fence-"));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
}

const wrap = (block) => ["<style>", "  body{color:red}", block, "  main{}", "</style>"].join("\n");
const stale = (variant) =>
  wrap(blockFor("design tokens", variant).replace(/· v\d+ ·/, "· v1 ·"));

test("findPages lists html and skips node_modules and .git", () => {
  const root = site({
    "index.html": "x", "talks/index.html": "x",
    "node_modules/p/index.html": "x", ".git/whatever.html": "x", "style.css": "x",
  });
  assert.deepEqual(findPages(root), ["index.html", "talks/index.html"]);
});

test("a page already carrying the shipped block reports same", () => {
  const root = site({ "index.html": wrap(blockFor("design tokens", "page")) });
  const e = planFences(root).find(x => x.fence === "design tokens");
  assert.equal(e.state, "same");
  assert.equal(e.variant, "page");
});

test("a page carrying an older version reports differs", () => {
  const root = site({ "index.html": stale("page") });
  assert.equal(planFences(root).find(x => x.fence === "design tokens").state, "differs");
});

test("the deck variant is read off the page, not guessed", () => {
  const root = site({ "talks/t/index.html": stale("deck") });
  const e = planFences(root).find(x => x.fence === "design tokens");
  assert.equal(e.variant, "deck");
});

test("applyFences rewrites only what differs and leaves the rest of the page alone", () => {
  const root = site({ "index.html": stale("page") });
  const written = applyFences(root, planFences(root));
  assert.deepEqual(written, ["index.html"]);
  const out = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(out.includes("  body{color:red}"), "content before the fence was disturbed");
  assert.ok(out.includes("  main{}"), "content after the fence was disturbed");
  assert.ok(out.includes(blockFor("design tokens", "page")));
});

test("applying the deck variant does not close the :root brace", () => {
  const root = site({ "talks/t/index.html": stale("deck") });
  applyFences(root, planFences(root));
  const out = fs.readFileSync(path.join(root, "talks/t/index.html"), "utf8");
  const lines = out.split("\n");
  const end = lines.findIndex(l => l.includes("end design tokens"));
  assert.notEqual(lines[end - 1].trim(), "}", "the deck gained a closing brace it must not have");
});

test("a second run writes nothing and reports every fence same", () => {
  const root = site({ "index.html": stale("page"), "talks/t/index.html": stale("deck") });
  applyFences(root, planFences(root));
  const second = planFences(root);
  assert.ok(second.length > 0, "the second plan found no fences at all");
  assert.ok(second.every(e => e.state === "same"), JSON.stringify(second));
  assert.deepEqual(applyFences(root, second), []);
});

test("a page with no fences produces no entries and is never rewritten", () => {
  const root = site({ "plain.html": "<style>  body{}</style>" });
  assert.deepEqual(planFences(root).filter(e => e.page === "plain.html"), []);
});

test("an unterminated fence throws rather than being silently skipped", () => {
  const root = site({
    "bad.html": "<style>\n  /* ─── design tokens · v3 · page ───\n  :root{}\n</style>",
  });
  assert.throws(() => planFences(root), e => e.name === "FenceError");
});
