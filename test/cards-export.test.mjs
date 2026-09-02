// exportCards against a fake browser, never Playwright. The package has no dependencies and
// must not gain one for its own tests — so the browser is an object that records the calls made
// to it, and every assertion below is about that record.
//
// Each test here names a capability that one of the three exporters this module replaces had and
// the other two had lost. That is the whole point of the file: a renderer consolidated onto any
// single copy still renders cards that look right, so nothing but an assertion per capability
// says which behaviour went missing.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { exportCards, validate } from "../cards/export.mjs";

const ROOT = "/tmp/a-site-that-is-never-read";

const FRAME = { width: 1200, height: 630, renderHeight: 675, clipY: 22 };

// One recorder for the page, the browser and `stamp` alike, because the ordering assertion needs
// the screenshot and the stamp on one timeline. A separate spy per collaborator can prove both
// were called and can never prove which came first.
function harness() {
  const calls = [];
  const logs = [];
  const page = {
    addInitScript: (f) => calls.push(["init", String(f)]),
    emulateMedia: (o) => calls.push(["media", o]),
    goto: (u, o) => calls.push(["goto", u, o]),
    evaluate: (f) => calls.push(["eval", String(f)]),
    addStyleTag: (o) => calls.push(["style", o.content]),
    waitForTimeout: (ms) => calls.push(["wait", ms]),
    screenshot: (o) => calls.push(["shot", o]),
    close: () => calls.push(["page-close"]),
  };
  const chromium = {
    launch: async () => ({
      newPage: async (o) => (calls.push(["page", o]), page),
      close: async () => calls.push(["browser-close"]),
    }),
  };
  return {
    calls,
    logs,
    async run(cards) {
      await exportCards({
        chromium,
        recipe: { cards, REPO_ROOT: ROOT, stamp: (c) => calls.push(["stamp", c.dir]) },
        log: (m) => logs.push(m),
      });
      return calls;
    },
  };
}

const kinds = (calls) => calls.map(([k]) => k);
const only = (calls, kind) => calls.filter(([k]) => k === kind);
const first = (calls, kind) => calls.find(([k]) => k === kind);

test("a reduced-motion card settles by emulation and never by a timer", async () => {
  // companygraph's, and only companygraph's. Its landing figure animates; a render that waits
  // "long enough" catches it mid-draw, so the page's own reduced-motion @media block draws the
  // settled state exactly instead of racing a timer.
  const h = harness();
  const calls = await h.run([{ dir: ".", ...FRAME, settle: "reduced-motion" }]);
  assert.equal(first(calls, "page")[1].reducedMotion, "reduce");
  assert.deepEqual(only(calls, "wait"), [], "a reduced-motion card must not also wait on a timer");
});

test("a card with no settle waits 900ms and gets no reduced-motion emulation", async () => {
  // This is the test that keeps blust.ch's cards byte-identical: not one of its eight cards
  // names a settle, so the default is the whole of its render timing.
  const h = harness();
  const calls = await h.run([{ dir: ".", ...FRAME }]);
  assert.deepEqual(only(calls, "wait").map(([, ms]) => ms), [900]);
  assert.equal(first(calls, "page")[1].reducedMotion, undefined);
  assert.deepEqual(only(calls, "media"), [], "no card should reach emulateMedia unasked");
});

test("wait:<ms> is read from the card, not hardcoded to 900", async () => {
  // Without this, `settle: "wait:1500"` would validate, hash into the recipe as a knob, and
  // render at 900 — a card whose recipe describes a render the exporter does not perform.
  const h = harness();
  const calls = await h.run([{ dir: ".", ...FRAME, settle: "wait:1500" }]);
  assert.deepEqual(only(calls, "wait").map(([, ms]) => ms), [1500]);
});

test("a card's hash is appended to the file URL it opens", async () => {
  // companygraph's. Its model page's stage reads a hash and focuses what it names, so the card
  // renders that view rather than the page's opening one.
  const h = harness();
  const calls = await h.run([{ dir: "model", ...FRAME, hash: "#core" }]);
  const [, url, opts] = first(calls, "goto");
  assert.equal(url, pathToFileURL(path.join(ROOT, "model", "index.html")).href + "#core");
  assert.equal(opts.waitUntil, "networkidle");
});

test("a card with no hash opens the page's own URL with nothing appended", async () => {
  const h = harness();
  const calls = await h.run([{ dir: "talks", ...FRAME }]);
  assert.equal(first(calls, "goto")[1],
    pathToFileURL(path.join(ROOT, "talks", "index.html")).href);
});

test("a card's own deviceScaleFactor reaches newPage", async () => {
  // guestgraph's: the only site that ever set this per card.
  const h = harness();
  const calls = await h.run([{ dir: ".", ...FRAME, deviceScaleFactor: 2 }]);
  assert.equal(first(calls, "page")[1].deviceScaleFactor, 2);
});

test("a card with no deviceScaleFactor renders at 1, not undefined", async () => {
  // Playwright's own default is 1, so passing `undefined` renders the same picture today and
  // this looks like a formality. It is not: the value is what makes the file exactly the size
  // its og:image:width claims, and leaving it undefined hands that guarantee to a dependency's
  // default rather than stating it.
  const h = harness();
  const calls = await h.run([{ dir: ".", ...FRAME }]);
  assert.equal(first(calls, "page")[1].deviceScaleFactor, 1);
});

test("a card with no hide produces no addStyleTag call at all", async () => {
  // companygraph's guard. Playwright rejects an empty style tag outright, so the two sites that
  // called it unconditionally worked only because every one of their cards happened to hide
  // something — a card that hides nothing would have thrown mid-run.
  const h = harness();
  const calls = await h.run([{ dir: ".", ...FRAME }]);
  assert.deepEqual(only(calls, "style"), []);
});

test("a card with hide gets exactly that content in a style tag", async () => {
  const h = harness();
  const calls = await h.run([{ dir: ".", ...FRAME, hide: "header{display:none}" }]);
  assert.deepEqual(only(calls, "style").map(([, css]) => css), ["header{display:none}"]);
});

test("document.fonts.ready is awaited on every card, whatever its settle", async () => {
  // blust.ch's and guestgraph's. companygraph awaited it inside its reduced-motion branch only,
  // so its wait:900 cards raced font loading against a fixed timer. A card rendered in the
  // fallback face is a silent failure: nothing errors, and the type is not the type the page
  // declares.
  const h = harness();
  const calls = await h.run([
    { dir: ".", ...FRAME, settle: "reduced-motion" },
    { dir: "talks", ...FRAME, settle: "wait:900" },
    { dir: "billing", ...FRAME },
  ]);
  const fonts = only(calls, "eval").filter(([, src]) => src.includes("document.fonts.ready"));
  assert.equal(fonts.length, 3, "one fonts.ready per card, not one per run and not per branch");
});

test("the theme init script pins rb-theme to dark rather than clearing it", async () => {
  // Clearing the key inherits whatever the boot script's default happens to be rather than
  // pinning anything — it only ever looked pinned while that default was dark, and a later
  // change to it would silently restyle every committed card.
  const h = harness();
  const calls = await h.run([{ dir: ".", ...FRAME }]);
  const [, src] = first(calls, "init");
  assert.match(src, /setItem\(\s*"rb-theme"\s*,\s*"dark"\s*\)/);
  assert.doesNotMatch(src, /removeItem/);
});

test("stamp runs after the screenshot, not before it", async () => {
  // A run that dies half way must leave the card reported stale rather than reported current on
  // a file it never wrote. Asserted on order, because both being called proves nothing.
  const h = harness();
  const calls = await h.run([{ dir: ".", ...FRAME }]);
  const order = kinds(calls);
  assert.ok(order.indexOf("shot") >= 0 && order.indexOf("stamp") >= 0, "both must happen");
  assert.ok(order.indexOf("shot") < order.indexOf("stamp"),
    `screenshot must precede stamp; got ${order.join(" → ")}`);
});

test("the screenshot is clipped to the card's frame and written beside the page", async () => {
  const h = harness();
  const calls = await h.run([{ dir: "talks/intro", ...FRAME }]);
  assert.deepEqual(first(calls, "shot")[1], {
    path: path.join(ROOT, "talks/intro", "og.png"),
    clip: { x: 0, y: 22, width: 1200, height: 630 },
  });
});

test("every page is closed and the browser is closed once, after every card", async () => {
  const h = harness();
  const calls = await h.run([{ dir: ".", ...FRAME }, { dir: "talks", ...FRAME }]);
  assert.equal(only(calls, "page-close").length, 2);
  assert.equal(only(calls, "browser-close").length, 1);
  assert.equal(kinds(calls).at(-1), "browser-close");
});

test("a titleSlide card activates slide 0 and a card without one does not", async () => {
  const h = harness();
  const calls = await h.run([
    { dir: "talks/intro", ...FRAME, titleSlide: true },
    { dir: "talks", ...FRAME, titleSlide: false },
  ]);
  const slide = only(calls, "eval").filter(([, src]) => src.includes(".slide"));
  assert.equal(slide.length, 1);
  assert.match(slide[0][1], /toggle\("active", k === 0\)/);
});

test("validate rejects an unknown key", () => {
  assert.throws(() => validate([{ dir: ".", ...FRAME, wat: 1 }]), /unknown key "wat"/);
});

test("validate rejects a card missing clipY", () => {
  const { clipY, ...rest } = FRAME;
  assert.throws(() => validate([{ dir: ".", ...rest }]), /missing "clipY"/);
});

test("validate rejects a settle that is neither wait:<ms> nor reduced-motion", () => {
  assert.throws(() => validate([{ dir: ".", ...FRAME, settle: "wait" }]),
    /settle "wait" is neither/);
});

test("validate rejects from: \"file\", so guestgraph cannot keep a key nothing reads", () => {
  // Guestgraph's exporter threw unless every card said `from: "file"`. Nothing in this renderer
  // reads that key — every page in the family renders from file:// — so a card carrying it
  // hashes a distinction no render makes. Task 8 drops it; this is what says so if it does not.
  assert.throws(() => validate([{ dir: ".", ...FRAME, from: "file" }]), /unknown key "from"/);
});

test("validation happens before the browser is launched", async () => {
  // A run that validated per card would render half the site and then throw, leaving a tree of
  // stamped cards beside unstamped ones and no obvious mark of where it stopped.
  const h = harness();
  await assert.rejects(h.run([{ dir: ".", ...FRAME }, { dir: "bad", ...FRAME, nope: 1 }]),
    /unknown key "nope"/);
  assert.deepEqual(h.calls, []);
});

test("each card is logged with the path written and the size it was written at", async () => {
  const h = harness();
  await h.run([{ dir: "talks/intro", ...FRAME }]);
  assert.deepEqual(h.logs, ["  ✓ talks/intro/og.png 1200×630"]);
});
