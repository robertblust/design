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

test("a CRLF page compares on content, not line endings, and a write keeps it CRLF", () => {
  const crlf = (s) => s.replace(/\n/g, "\r\n");

  // A CRLF page already carrying the shipped block must report "same" on the very first plan —
  // findFence joins a CRLF document's body with \r\n, and blockFor's \n-joined text must not be
  // compared against it byte-for-byte, or a page that is genuinely in sync reports "differs"
  // forever.
  const freshRoot = site({ "index.html": crlf(wrap(blockFor("design tokens", "page"))) });
  const fresh = planFences(freshRoot).find(e => e.fence === "design tokens");
  assert.equal(fresh.state, "same");

  // A CRLF page carrying a stale block: after applyFences, a re-plan must reach "same" (the
  // property design:check rests on), and the file on disk must still be CRLF — fixing the
  // comparison must not be done by silently converting the page to LF on write.
  const root = site({ "index.html": crlf(stale("page")) });
  applyFences(root, planFences(root));
  const second = planFences(root).find(e => e.fence === "design tokens");
  assert.equal(second.state, "same");
  const out = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(out.includes("\r\n"), "the page lost its CRLF line endings entirely");
  assert.ok(!/(?<!\r)\n/.test(out), "a bare LF crept into what must remain an all-CRLF file");
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

// A deck seeded from a prose page keeps the prose page's self-closing content but is still a
// deck: its own tokens and closing brace live after the end marker, outside the fence. Declaring
// "page" on that fence writes the page's block, which closes :root a second time before the
// deck's own content — the exact silent failure Finding 1 reproduced.
test("a deck's fence declaring page throws, because its block never closes :root", () => {
  // The deck's own block (unclosed :root) with the opening line's variant word swapped to "page"
  // — exactly what a deck seeded from a prose page produces.
  const root = site({
    "talks/t/index.html": wrap(blockFor("design tokens", "deck").replace(/· v(\d+) · deck/, "· v$1 · page")),
  });
  assert.throws(() => planFences(root), e =>
    e.name === "FenceError" && /declares "page".*does not close/.test(e.message));
});

test("a prose page's fence declaring deck throws, because its block already closes :root", () => {
  const root = site({
    "index.html": wrap(blockFor("design tokens", "page").replace(/· v(\d+) · page/, "· v$1 · deck")),
  });
  assert.throws(() => planFences(root), e =>
    e.name === "FenceError" && /declares "deck".*closes/.test(e.message));
});
