// exportDecks against a fake browser and a fake PDFDocument, never Playwright and never pdf-lib.
// The package has no dependencies; what these tests assert is the calls made, which a fake records.
//
// Unlike cards/export.mjs, this module is not a union of three drifted copies: the three
// exporters it replaces were behaviorally identical. So these tests assert the contract the
// three shared — the viewport, the waits, the hide rule, the per-slide toggle, the output path —
// because that shared behavior is exactly what a shared harness can now quietly lose.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import http from "node:http";
import { pathToFileURL } from "node:url";

import { exportDecks, validate, annotation } from "../decks/export.mjs";

const ROOT = "/tmp/a-site-that-is-never-read";
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function harness({ slides = 3, links = [] } = {}) {
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
    // linksOnSlide is the one evaluate called with an object carrying the slide's number;
    // it answers with the links, every other evaluate with the slide count.
    evaluate: async (f, arg) => { await record("eval", String(f), arg);
                                  return arg && typeof arg === "object" && "n" in arg ? links : slides; },
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
        addPage: (size) => { const p = { size, drawn: null, annots: [] }; pages.push(p);
                             return { drawImage: (img, box) => { p.drawn = { img, box }; },
                                      node: { addAnnot: (ref) => p.annots.push(ref) } }; },
        context: { obj: (o) => o, register: (o) => ({ ref: o }) },
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

test("given a base, the deck is opened as <base>/<dir>/, by dir and not by slug", async () => {
  const h = harness({ slides: 1 });
  await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
                      decks: [{ dir: "talks/intro", slug: "guestgraph" }],
                      base: "http://x.test", log: h.log, write: h.write });
  const [, url, opts] = h.calls.find((c) => c[0] === "goto");
  assert.equal(url, "http://x.test/talks/intro/");
  assert.deepEqual(opts, { waitUntil: "networkidle" });
});

test("a file:// base is refused, naming this change", async () => {
  const h = harness({ slides: 1 });
  await assert.rejects(
    exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
                  decks: [{ dir: "talks/intro", slug: "g" }],
                  base: pathToFileURL(ROOT).href, log: h.log, write: h.write }),
    /serves.*over http|no longer opens from file:\/\//i);
  // Nothing was launched at all: the refusal happens before the browser or the deck loop.
  assert.equal(h.calls.length, 0);
});

test("with no base at all, the exporter serves root itself and closes the server once done", async () => {
  const h = harness({ slides: 1 });
  await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
                      decks: [{ dir: "talks/intro", slug: "guestgraph" }], log: h.log, write: h.write });
  const [, url] = h.calls.find((c) => c[0] === "goto");
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/talks\/intro\/$/.exec(url);
  assert.ok(m, `expected a served base, got ${JSON.stringify(url)}`);
  // The server this run started must not still be listening once exportDecks has returned —
  // a leaked one is invisible here (this run's page never really connects; it's a fake) and
  // was exactly how cards/export.mjs used to hang a run after the last card printed.
  const port = Number(m[1]);
  await assert.rejects(
    new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${port}/`, resolve);
      req.on("error", reject);
    }),
    /ECONNREFUSED/);
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

const FakeString = { of: (s) => ({ str: s }) };

test("without PDFString the slides are not asked for links and no page carries one", async () => {
  const h = harness({ slides: 2, links: [{ x: 0, y: 0, w: 10, h: 10, url: "https://blust.ch/" }] });
  await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, root: ROOT,
                      decks: [{ dir: "talks/intro", slug: "g" }], log: h.log, write: h.write });
  assert.equal(h.calls.filter((c) => c[0] === "eval" && c[2] && typeof c[2] === "object").length, 0);
  for (const pages of h.written) for (const p of pages) assert.deepEqual(p.annots, []);
});

test("with PDFString each page carries one link per link its slide reported, asked before the shot", async () => {
  const links = [{ x: 100, y: 50, w: 200, h: 20, url: "https://companygraph.io/?lang=en" },
                 { x: 1200, y: 680, w: 40, h: 30, url: "https://companygraph.io/talks/x/?chat=open&lang=en" }];
  const h = harness({ slides: 2, links });
  await exportDecks({ chromium: h.chromium, PDFDocument: h.PDFDocument, PDFString: FakeString, root: ROOT,
                      decks: [{ dir: "talks/intro", slug: "g" }], log: h.log, write: h.write });
  const asks = h.calls.filter((c) => c[0] === "eval" && c[2] && typeof c[2] === "object");
  assert.deepEqual(asks.map((c) => [c[2].n, c[2].lang]), [[0, "de"], [1, "de"], [0, "en"], [1, "en"]]);
  const order = h.calls.map((c) => c[0]).filter((k) => k === "eval" || k === "shot");
  assert.equal(order.at(-1), "shot", "the links are read before the screenshot, not after");
  for (const pages of h.written) for (const p of pages) {
    assert.deepEqual(p.annots.map((a) => a.ref.A.URI.str), links.map((l) => l.url));
  }
});

test("an annotation is the reported rectangle turned over into PDF coordinates, borderless", () => {
  const a = annotation({ x: 100, y: 50, w: 200, h: 20, url: "https://blust.ch/" }, FakeString);
  assert.deepEqual(a, {
    Type: "Annot", Subtype: "Link", Rect: [100, 650, 300, 670], Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: { str: "https://blust.ch/" } },
  });
});
