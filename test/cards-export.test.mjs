// exportCards against a fake browser, never Playwright. The package has no dependencies and
// must not gain one for its own tests — so the browser is an object that records the calls made
// to it, and every assertion below is about that record.
//
// Each test here names a capability that one of the three exporters this module replaces had and
// the other two had lost. That is the whole point of the file: a renderer consolidated onto any
// single copy still renders cards that look right, so nothing but an assertion per capability
// says which behavior went missing.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { exportCards, validate } from "../cards/export.mjs";

const ROOT = "/tmp/a-site-that-is-never-read";

const FRAME = { width: 1200, height: 630, renderHeight: 675, clipY: 22 };

// Every Playwright call resolves on a later tick, and the entry is recorded when it *resolves*
// rather than when it is called. A fake whose methods return undefined records in source order
// whether or not the production code awaits them, which makes a dropped `await` invisible —
// including on `page.screenshot`, where it is the exact defect the stamp-after-screenshot rule
// exists to prevent: `stamp` writes og.sha while the PNG is still being written, so a run that
// dies leaves the card reported *current on a file it never wrote*. Recording on resolution is
// what turns the ordering assertion below from a claim about call order into one about
// completion order.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

// One recorder for the browser, the page and `stamp` alike, because the ordering assertion needs
// the screenshot and the stamp on one timeline. A separate spy per collaborator can prove both
// were called and can never prove which came first.
function harness() {
  const calls = [];
  const logs = [];
  // The fake also *rejects* rather than only recording. Recording on resolution catches a
  // dropped `await` only where something synchronous runs in the gap — it caught the one on
  // page.screenshot, because `stamp` is sync, and caught nothing on page.goto, because the next
  // call schedules its own tick behind the abandoned one and the record comes out in source
  // order anyway. The exporter is strictly sequential by construction, so a second page call
  // beginning while the first is still in flight can only mean a missing `await`; that is a
  // thing the fake can refuse outright, and refusing covers every await in the loop rather than
  // the one that happens to sit beside synchronous work.
  let inFlight = null;
  const record = async (...entry) => {
    if (inFlight) {
      throw new Error(`${entry[0]} began while ${inFlight} was still in flight — a missing await`);
    }
    inFlight = entry[0];
    await tick();
    inFlight = null;
    calls.push(entry);
  };
  const page = {
    addInitScript: (f) => record("init", String(f)),
    emulateMedia: (o) => record("media", o),
    goto: (u, o) => record("goto", u, o),
    evaluate: (f) => record("eval", String(f)),
    addStyleTag: (o) => record("style", o.content),
    waitForTimeout: (ms) => record("wait", ms),
    screenshot: (o) => record("shot", o),
    close: () => record("page-close"),
  };
  // `stamp` is deliberately the one synchronous collaborator: the real one is
  // fs.writeFileSync in cards/recipe.mjs. Faking it as async would hide the very asymmetry
  // that makes a missing `await` on the screenshot dangerous.
  const chromium = {
    // Launching a browser is the most observable thing this function does, and the most
    // expensive to do by accident: a throw after it, with no browser.close() on the way out,
    // leaks a Chromium process on every invalid recipe. Recorded so "before the browser is
    // launched" is a statement the test can actually check.
    launch: async () => {
      await record("launch");
      return {
        newPage: async (o) => { await record("page", o); return page; },
        close: () => record("browser-close"),
      };
    },
  };
  return {
    calls,
    logs,
    page,
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

test("browser.close() runs even when a card throws mid-render, and the error still propagates", async () => {
  // Finding 5: exportCards has no try/finally around browser.close(). The sites all exit on the
  // rejection with no catch, so this never bit them — but any caller that does catch (a future
  // harness, a progress-reporting wrapper) leaks the Chromium process forever, because nothing
  // downstream of the throw ever runs browser.close(). Here `page.screenshot` fails mid-run; the
  // rejection must still reach the caller (not be swallowed) and browser-close must still land.
  const h = harness();
  const boom = new Error("card exploded mid-render");
  h.page.screenshot = () => Promise.reject(boom);
  await assert.rejects(h.run([{ dir: ".", ...FRAME }]), (err) => err === boom);
  assert.equal(only(h.calls, "browser-close").length, 1,
    "browser.close() must still run after a card throws mid-render");
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

test("validate rejects wait: with no number, and a fractional one", () => {
  // `"wait:"` is the malformed form that fails quietly rather than loudly: it is not rejected
  // by a `\d*` quantifier, `Number("")` is 0, and the card then renders with no settle at all
  // while og:check reports it current — a recipe describing a render the exporter does not
  // perform, which is the whole reason validate exists. `"wait"` alone cannot pin this: it is
  // rejected by `\d+` and `\d*` alike.
  assert.throws(() => validate([{ dir: ".", ...FRAME, settle: "wait:" }]), /settle "wait:" is neither/);
  assert.throws(() => validate([{ dir: ".", ...FRAME, settle: "wait:1.5" }]), /settle "wait:1\.5" is neither/);
});

test("validate rejects from: \"file\", so guestgraph cannot keep a key nothing reads", () => {
  // Guestgraph's exporter threw unless every card said `from: "file"`. Nothing in this renderer
  // reads that key — every page in the family renders from file:// — so a card carrying it
  // hashes a distinction no render makes. Task 8 drops it; this is what says so if it does not.
  assert.throws(() => validate([{ dir: ".", ...FRAME, from: "file" }]), /unknown key "from"/);
});

test("validation happens before the browser is launched", async () => {
  // Two failures at once. A run that validated per card would render half the site and then
  // throw, leaving stamped cards beside unstamped ones and no mark of where it stopped. A run
  // that validated one line *after* chromium.launch() would look identical from the outside and
  // leak a Chromium process on every invalid recipe, because the throw propagates straight past
  // browser.close(). The fake records the launch itself, so an empty call list rules out both.
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
