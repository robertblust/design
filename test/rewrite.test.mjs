// The fence parser, against documents built by hand rather than against the real sites — so
// these tests still mean something after every page changes.
//
// What it must never do is as important as what it must do. It edits pages that a deck opens
// from file:// with no network, and a parser that silently matched the wrong region would
// rewrite live CSS. So every failure mode here is a throw, not a best guess.
import { test } from "node:test";
import assert from "node:assert/strict";

import { findFence, replaceFence, FenceError } from "../lib/rewrite.mjs";

const doc = (...lines) => lines.join("\n");

const PAGE = doc(
  "<style>",
  "  body{color:red}",
  "  /* ─── design tokens · v3 · page ───────────────────────────────────",
  "     some prose about the block",
  "  */",
  "  :root{",
  "    --ground:#0C0E13;",
  "  }",
  "  /* ─── end design tokens ─────────────────────────────────────────── */",
  "  main{display:block}",
  "</style>",
);

test("finds a fence and reports its line span, inclusive of both markers", () => {
  const f = findFence(PAGE, "design tokens");
  assert.equal(f.start, 2);
  assert.equal(f.end, 8);
});

test("reads the version and the variant off the opening line", () => {
  const f = findFence(PAGE, "design tokens");
  assert.equal(f.version, "v3");
  assert.equal(f.variant, "page");
});

test("reports variant null when the opening line carries prose instead", () => {
  const p = PAGE.replace("· page ───", "· keep in step across every repository ───");
  assert.equal(findFence(p, "design tokens").variant, null);
});

test("the body excludes neither marker — it is the whole block", () => {
  const f = findFence(PAGE, "design tokens");
  assert.ok(f.body.startsWith("  /* ─── design tokens"));
  assert.ok(f.body.trimEnd().endsWith("*/"));
  assert.ok(f.body.includes("--ground:#0C0E13;"));
});

test("returns null for a fence the page does not carry", () => {
  assert.equal(findFence(PAGE, "header contract"), null);
});

test("does not confuse one fence for another with a shared prefix", () => {
  const two = doc(
    "  /* ─── stage contract · v1 · x ───",
    "  .a{}",
    "  /* ─── end stage contract ─── */",
    "  /* ─── stage · v1 · x ───",
    "  .b{}",
    "  /* ─── end stage ─── */",
  );
  assert.equal(findFence(two, "stage").start, 3);
  assert.equal(findFence(two, "stage contract").start, 0);
});

test("replaceFence swaps the whole block and leaves every other line alone", () => {
  const out = replaceFence(PAGE, "design tokens", doc(
    "  /* ─── design tokens · v4 · page ───",
    "  */",
    "  :root{ --ground:#000; }",
    "  /* ─── end design tokens ─── */",
  ));
  assert.ok(out.includes("  body{color:red}"), "content before the fence was disturbed");
  assert.ok(out.includes("  main{display:block}"), "content after the fence was disturbed");
  assert.ok(out.includes("--ground:#000;"));
  assert.ok(!out.includes("--ground:#0C0E13;"));
});

test("replaceFence is idempotent — replacing with what is already there changes nothing", () => {
  const f = findFence(PAGE, "design tokens");
  assert.equal(replaceFence(PAGE, "design tokens", f.body), PAGE);
});

test("an opening marker with no closing marker throws rather than guessing", () => {
  const broken = doc(
    "  /* ─── design tokens · v3 · page ───",
    "  :root{ --ground:#0C0E13; }",
    "</style>",
  );
  assert.throws(() => findFence(broken, "design tokens"),
    e => e.name === "FenceError" && /end design tokens/.test(e.message));
});

test("replacing a fence the page does not carry throws", () => {
  assert.throws(() => replaceFence(PAGE, "header contract", "x"),
    e => e.name === "FenceError" && /header contract/.test(e.message));
});

test("a document with CRLF line endings round-trips without corrupting them", () => {
  const crlf = PAGE.replace(/\n/g, "\r\n");
  const f = findFence(crlf, "design tokens");
  assert.equal(replaceFence(crlf, "design tokens", f.body), crlf);
});
