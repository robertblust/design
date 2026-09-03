// exportDecks against a fake browser and a fake PDFDocument, never Playwright and never pdf-lib.
// The package has no dependencies and must not gain one for its own tests.
//
// Unlike cards/export.mjs, this module is not a union of three drifted copies: the three
// exporters it replaces were behaviorally identical. So these tests assert the contract the
// three shared — the viewport, the waits, the hide rule, the per-slide toggle, the output path —
// because that shared behavior is exactly what a shared harness can now quietly lose.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { exportDecks, validate } from "../decks/export.mjs";

const ROOT = "/tmp/a-site-that-is-never-read";
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function harness({ slides = 3 } = {}) {
  const calls = [];
  const logs = [];
  const written = [];
  let inFlight = null;
  const record = async (...entry) => {
    if (inFlight) throw new Error(`${entry[0]} began while ${inFlight} was still in flight — a missing await`);
    inFlight = entry[0];
    await tick();
    inFlight = null;
    calls.push(entry);
  };
  // Every method that returns a value must `await record(...)` before returning it. Returning a
  // value beside an un-awaited record leaves `inFlight` set into the next call, and the guard
  // then reports a missing await that is not there — the fake failing, not the code.
  const page = {
    goto: (u, o) => record("goto", u, o),
    evaluate: async (f, arg) => { await record("eval", String(f), arg); return slides; },
    addStyleTag: (o) => record("style", o.content),
    waitForTimeout: (ms) => record("wait", ms),
    screenshot: async (o) => { await record("shot", o); return Buffer.from("png"); },
    close: () => record("closePage"),
  };
  const browser = {
    newPage: async (o) => { await record("newPage", o); return page; },
    close: () => record("closeBrowser"),
  };
  const chromium = { launch: async () => { await record("launch"); return browser; } };
  const PDFDocument = {
    create: async () => {
      const pages = [];
      return {
        embedPng: async (buf) => ({ png: buf.toString() }),
        addPage: (size) => { const p = { size, drawn: null }; pages.push(p);
                             return { drawImage: (img, box) => { p.drawn = { img, box }; } }; },
        save: async () => { written.push(pages); return Buffer.from(`pdf:${pages.length}`); },
      };
    },
  };
  const files = [];
  return { calls, logs, written, files, chromium, PDFDocument,
           log: (m) => logs.push(m), write: (file, buf) => files.push({ file, buf }) };
}

test("a deck with an unknown key is rejected rather than silently ignored", () => {
  assert.throws(() => validate([{ dir: "talks/intro", slug: "intro", scale: 2 }]),
                /unknown key "scale"/);
});

test("a deck missing dir or slug is rejected", () => {
  assert.throws(() => validate([{ dir: "talks/intro" }]), /missing "slug"/);
  assert.throws(() => validate([{ slug: "intro" }]), /missing "dir"/);
});

test("one deck, two languages: the page is opened once and a PDF written per language", async () => {
  const h = harness({ slides: 3 });
  const written = await exportDecks({
    chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
    decks: [{ dir: "talks/intro", slug: "guestgraph" }], log: h.log, write: h.write,
  });
  assert.deepEqual(written.map((w) => path.relative(ROOT, w.file)),
                   ["talks/intro/guestgraph-de.pdf", "talks/intro/guestgraph-en.pdf"]);
  assert.deepEqual(written.map((w) => w.pages), [3, 3]);
  assert.equal(h.calls.filter((c) => c[0] === "newPage").length, 1);
});

test("the frame is 1280x720 at deviceScaleFactor 2, and the clip matches it", async () => {
  const h = harness({ slides: 1 });
  await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
                      decks: [{ dir: "talks/intro", slug: "g" }], log: h.log, write: h.write });
  const [, opts] = h.calls.find((c) => c[0] === "newPage");
  assert.deepEqual(opts, { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const [, clip] = h.calls.find((c) => c[0] === "shot");
  assert.deepEqual(clip, { type: "png", clip: { x: 0, y: 0, width: 1280, height: 720 } });
});

test("the deck is loaded from file:// under root, by dir and not by slug", async () => {
  const h = harness({ slides: 1 });
  await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
                      decks: [{ dir: "talks/intro", slug: "guestgraph" }], log: h.log, write: h.write });
  const [, url, opts] = h.calls.find((c) => c[0] === "goto");
  assert.equal(url, pathToFileURL(path.join(ROOT, "talks/intro", "index.html")).href);
  assert.deepEqual(opts, { waitUntil: "networkidle" });
});

test("the hide rule hides the transport, the bar and the notes, and nothing else", async () => {
  const h = harness({ slides: 1 });
  await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
                      decks: [{ dir: "talks/intro", slug: "g" }], log: h.log, write: h.write });
  const [, css] = h.calls.find((c) => c[0] === "style");
  assert.ok(css.includes(".transport,.bar,.notes{display:none!important}"));
  assert.ok(css.includes(".slide.active > *{animation:none!important}"));
  // .chrome and .name are deliberately absent: hiding the whole bar took the byline off every
  // printed page, and that regression is invisible in a PDF nobody opens.
  assert.ok(!css.includes(".chrome"));
  assert.ok(!css.includes(".name"));
});

test("400ms settles the language switch and 500ms settles each slide", async () => {
  const h = harness({ slides: 2 });
  await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
                      decks: [{ dir: "talks/intro", slug: "g" }], log: h.log, write: h.write });
  const waits = h.calls.filter((c) => c[0] === "wait").map((c) => c[1]);
  // per language: one 400 after the toggle, then one 500 per slide
  assert.deepEqual(waits, [400, 500, 500, 400, 500, 500]);
});

test("two decks are walked in order, each on its own page, and the browser closes once", async () => {
  const h = harness({ slides: 1 });
  const written = await exportDecks({
    chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
    decks: [{ dir: "talks/mental-model", slug: "mental-model" },
            { dir: "talks/essential-complexity", slug: "essential-complexity" }],
    log: h.log, write: h.write,
  });
  assert.deepEqual(written.map((w) => path.relative(ROOT, w.file)), [
    "talks/mental-model/mental-model-de.pdf",
    "talks/mental-model/mental-model-en.pdf",
    "talks/essential-complexity/essential-complexity-de.pdf",
    "talks/essential-complexity/essential-complexity-en.pdf",
  ]);
  assert.equal(h.calls.filter((c) => c[0] === "newPage").length, 2);
  assert.equal(h.calls.filter((c) => c[0] === "closePage").length, 2);
  assert.equal(h.calls.filter((c) => c[0] === "closeBrowser").length, 1);
});

test("every page drawn is the full frame at the origin", async () => {
  const h = harness({ slides: 2 });
  await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
                      decks: [{ dir: "talks/intro", slug: "g" }], log: h.log, write: h.write });
  for (const pages of h.written) {
    assert.equal(pages.length, 2);
    for (const p of pages) {
      assert.deepEqual(p.size, [1280, 720]);
      assert.deepEqual(p.drawn.box, { x: 0, y: 0, width: 1280, height: 720 });
    }
  }
});

test("each written file is logged with its slide count", async () => {
  const h = harness({ slides: 4 });
  await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
                      decks: [{ dir: "talks/intro", slug: "g" }], log: h.log, write: h.write });
  assert.deepEqual(h.logs, ["  ✓ talks/intro/g-de.pdf  (4 slides)",
                            "  ✓ talks/intro/g-en.pdf  (4 slides)"]);
});
