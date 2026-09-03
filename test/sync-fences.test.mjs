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

import { findPages, planFences, applyFences, otherVariantMatch } from "../lib/sync.mjs";
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

// The defect this catches: `findFence` used to whitelist "page" and "deck" and silently turn
// any other word into `null` — so a fence declaring a real, wrong word (here "loyal" on a fence
// that only knows "credit"/"plain") was reported to this function as no variant at all, and the
// old message ("declares no variant") flatly contradicted the page's own opening line. This is
// the assertion that would have caught it before it shipped; there was none.
test("a fence's opening line naming a word outside its own variants is rejected, naming both", () => {
  const root = site({
    "index.html": wrap(blockFor("prose footer", "credit").replace("· credit ", "· loyal ")),
  });
  assert.throws(() => planFences(root), e =>
    e.name === "FenceError" && /"loyal"/.test(e.message) && /credit, plain/.test(e.message));
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

// planFences wires the general guard to `FENCES[fence].variants` alone — nothing in the wiring
// checks `closes` — so it runs for "language" (`closes: null`) exactly as it does for "design
// tokens". What it finds when it runs is a separate question, tested below on the comparison
// itself: today's fences cannot demonstrate a `closes: null` fence whose variants genuinely
// differ, because the only thing that currently makes two variants differ by more than their
// label is the brace logic gated on `closes` — that capability arrives with a future fence. So
// the mismatch case is proved directly against `otherVariantMatch`, with fabricated content
// standing in for that fence, rather than through a `closes: null` fence that does not exist yet.

// The declared word is "a", but the content past the opening line is word-for-word "b"'s —
// exactly what a deck-footer lockup written in the wrong form would look like once a future
// fence has two variants that emit different bytes with no brace involved.
test("otherVariantMatch catches a mislabeled body when the variants genuinely differ", () => {
  const candidates = {
    a: ["/* ─── lockup · v1 · a ───", "  nine lines of the short form", "/* ─── end lockup ───"].join("\n"),
    b: ["/* ─── lockup · v1 · b ───", "  thirty-one lines of the long form", "/* ─── end lockup ───"].join("\n"),
  };
  const mislabeled = ["/* ─── lockup · v1 · a ───", "  thirty-one lines of the long form", "/* ─── end lockup ───"].join("\n");
  assert.equal(otherVariantMatch("a", mislabeled, candidates), "b");
});

// A body correctly labeled "a" must never be flagged against "b", even if unrelated stray edits
// mean neither candidate matches exactly — proves the check does not fire on ordinary "differs".
test("otherVariantMatch does not fire when the body simply differs from every candidate", () => {
  const candidates = {
    a: ["/* ─── lockup · v1 · a ───", "  nine lines", "/* ─── end lockup ───"].join("\n"),
    b: ["/* ─── lockup · v1 · b ───", "  thirty-one lines", "/* ─── end lockup ───"].join("\n"),
  };
  const edited = ["/* ─── lockup · v1 · a ───", "  someone's hand-edited line", "/* ─── end lockup ───"].join("\n");
  assert.equal(otherVariantMatch("a", edited, candidates), null);
});

// The companion fact, exercised through the real pipeline this time: when a fence's variants
// emit identical bytes outside the label — true of "language" — the general guard runs (it is
// wired unconditionally for any fence with `variants`) and correctly finds nothing to catch.
test("the general variant guard finds nothing for a fence whose variants are byte-identical", () => {
  const root = site({
    "index.html": ["<script>", "  // before",
      blockFor("language", "page", { langKey: "rb-lang" }), "  // after", "</script>"].join("\n"),
  });
  fs.writeFileSync(path.join(root, "design.config.json"),
    JSON.stringify({ groups: ["fonts"], langKey: "rb-lang" }));
  const e = planFences(root).find(x => x.fence === "language");
  assert.equal(e.state, "same");
});
