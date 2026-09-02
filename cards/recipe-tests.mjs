// What the share-card staleness check has to get right, asserted once for all three sites.
//
// blust.ch, companygraph.io and guestgraph.io each kept their own copy of this file and the
// copies drifted: 29, 30 and 30 tests, with no one of them a superset of another. So a rule one
// site had proven was a rule the other two only happened to satisfy. This is the union — every
// assertion any copy made, made by all three.
//
// The check's whole value is that it over-reports and never under-reports: a card whose page has
// moved must come out stale, and the failure it exists to catch — a card reported current after
// the page changed — must be impossible. Nearly every test below drives both directions against
// real files in a throwaway tree passed as an explicit `root`, rather than against the site's own
// pages, so they still mean something after the site's pages change. The last two are the
// exception: they are about this repository, and read it through `cards` and `REPO_ROOT`.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// A test that quietly stops being registered looks exactly like a test that passes. This is the
// count the three sites' suites agreed on when they were merged; changing it is a deliberate
// edit, not something a refactor does on the way past.
export const SHARED_TEST_COUNT = 32;

// A throwaway repository root. `nest` puts it one level down so a test can also place a file
// *outside* it and prove the escape guard is what excludes it, rather than its absence.
function tree(files, { nest = false } = {}) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "og-recipe-"));
  const root = nest ? path.join(base, "site") : base;
  for (const [rel, body] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  }
  return { root, base };
}

// Not any site's card: a synthetic one carrying a knob of every kind the three sites use between
// them, so the "changing X changes the recipe" tests have something to change. Every `over` below
// must differ from what is here — `clipY: 23` against a base of 23 asserts nothing.
const card = (over = {}) => ({
  dir: ".",
  hide: ".figure{display:none!important}",
  width: 1200, height: 630, renderHeight: 675, clipY: 23,
  titleSlide: false, settle: "wait:900",
  ...over,
});

export function checkRecipe({ cards, sources, recipe, state, stampOf, REPO_ROOT }) {
  // --- sources: what counts as going into a card -----------------------------------------

  test("the page itself is a source", () => {
    const { root } = tree({ "index.html": "<html></html>" });
    assert.deepEqual(sources(".", root), ["index.html"]);
  });

  test("a font the page loads with url() is a source", () => {
    const { root } = tree({
      "index.html": "<style>@font-face{src:url(fonts/A.woff2)}</style>",
      "fonts/A.woff2": "A",
    });
    assert.deepEqual(sources(".", root), ["fonts/A.woff2", "index.html"]);
  });

  test("a file the page names but does not have is not a source", () => {
    const { root } = tree({ "index.html": '<img src="missing.svg">' });
    assert.deepEqual(sources(".", root), ["index.html"]);
  });

  test("a directory the page links to is not a source", () => {
    const { root } = tree({ "index.html": '<a href="billing/"></a>', "billing/index.html": "b" });
    assert.deepEqual(sources(".", root), ["index.html"]);
  });

  test("references that leave the repository are not sources", () => {
    const { root } = tree({
      "index.html": `<a href="https://example.com/talks/"></a>
                     <link href="//cdn.example/x.css">
                     <img src="data:image/svg+xml,x">
                     <a href="mailto:hi@example.com"></a>`,
    });
    assert.deepEqual(sources(".", root), ["index.html"]);
  });

  // Two of the three sites point every page at the one copy of fonts/ relatively, so a page a
  // level down reaches back out of its own directory to reach them. blust.ch's decks carry their
  // own fonts/ and never do this; get the resolution wrong and those cards silently stop tracking
  // the fonts they render with.
  test("a subpage's ../fonts reference resolves back into the repository", () => {
    const { root } = tree({
      "talks/index.html": "<style>@font-face{src:url(../fonts/A.woff2)}</style>",
      "fonts/A.woff2": "A",
    });
    assert.deepEqual(sources("talks", root), ["fonts/A.woff2", "talks/index.html"]);
  });

  test("a reference climbing above the repository root is not a source", () => {
    const { root, base } = tree({ "index.html": '<img src="../outside.png">' }, { nest: true });
    fs.writeFileSync(path.join(base, "outside.png"), "x");   // it exists; the guard must still drop it
    assert.deepEqual(sources(".", root), ["index.html"]);
  });

  // A link names somewhere to go, not something to draw. A talks index is why this exception
  // exists: it links each deck's multi-megabyte PDF, so hashing link targets reports that card
  // stale on every `npm run pdf`, over a page that has not moved a pixel.
  test("a file the page only links to is not a source", () => {
    const { root } = tree({
      "index.html": '<a href="talk.pdf">the talk</a>',
      "talk.pdf": "%PDF",
    });
    assert.deepEqual(sources(".", root), ["index.html"]);
  });

  test("a file the page draws is a source even next to a link", () => {
    const { root } = tree({
      "index.html": '<a href="talk.pdf">the talk</a><img src="mark.svg">',
      "talk.pdf": "%PDF",
      "mark.svg": "<svg/>",
    });
    assert.deepEqual(sources(".", root), ["index.html", "mark.svg"]);
  });

  test("a stylesheet the page links with <link> is a source", () => {
    const { root } = tree({ "index.html": '<link rel="icon" href="favicon.svg">', "favicon.svg": "<svg/>" });
    assert.deepEqual(sources(".", root), ["favicon.svg", "index.html"]);
  });

  // The decks keep prose in `data-notes`, where `>` is an ordinary character. Ending a tag at the
  // first `>` regardless of quoting drops every reference after it, silently.
  test("a > inside an attribute value does not end the tag early", () => {
    const { root } = tree({
      "index.html": '<div data-notes="a > b"><img src="mark.svg"></div>',
      "mark.svg": "<svg/>",
    });
    assert.deepEqual(sources(".", root), ["index.html", "mark.svg"]);
  });

  // Both spellings, because the three copies of this test did not agree on which one they wrote
  // and only one of them gates anything. The attribute pattern is case-sensitive, so `HREF` never
  // matches and that line would pass with the `<a>` skip deleted; the lowercase-attribute form is
  // the one that reaches the tag test and fails when the tag name stops being lowercased.
  test("an uppercase link is still a link", () => {
    const { root } = tree({ "index.html": '<A href="talk.pdf">x</A>', "talk.pdf": "%PDF" });
    assert.deepEqual(sources(".", root), ["index.html"]);

    const shouty = tree({ "index.html": '<A HREF="talk.pdf">x</A>', "talk.pdf": "%PDF" });
    assert.deepEqual(sources(".", shouty.root), ["index.html"]);
  });

  test("a query string or fragment does not make a second source", () => {
    const { root } = tree({
      "index.html": '<link href="a.css?v=2"><link href="a.css#top">',
      "a.css": "a",
    });
    assert.deepEqual(sources(".", root), ["a.css", "index.html"]);
  });

  // Both of blust.ch's decks fill a marker this way — `url(#ah)` is a reference into the page's
  // own SVG, not a file, and there is no `#ah` on disk to hash.
  test("a fragment-only url() names nothing on disk", () => {
    const { root } = tree({ "index.html": '<svg><path marker-end="url(#ah)"/></svg>' });
    assert.deepEqual(sources(".", root), ["index.html"]);
  });

  // --- recipe: what makes a card stale ----------------------------------------------------

  test("the recipe is the same twice when nothing changes", () => {
    const { root } = tree({ "index.html": "<p>one</p>" });
    assert.equal(recipe(card(), root), recipe(card(), root));
  });

  test("editing the page changes the recipe", () => {
    const { root } = tree({ "index.html": "<p>one</p>" });
    const before = recipe(card(), root);
    fs.writeFileSync(path.join(root, "index.html"), "<p>two</p>");
    assert.notEqual(recipe(card(), root), before);
  });

  // A font swap changes every card while no HTML changes at all. This is the case that made the
  // check hash sources instead of the page.
  test("swapping a font the page never mentions by name changes the recipe", () => {
    const { root } = tree({
      "index.html": "<style>@font-face{src:url(fonts/A.woff2)}</style>",
      "fonts/A.woff2": "old",
    });
    const before = recipe(card(), root);
    fs.writeFileSync(path.join(root, "fonts/A.woff2"), "new");
    assert.notEqual(recipe(card(), root), before);
  });

  // The exporter's own frame is part of what the card looks like, so it is part of the recipe. If
  // it were not, changing a hide rule would leave every card reported current.
  test("changing the exporter's hide rules changes the recipe", () => {
    const { root } = tree({ "index.html": "<p>one</p>" });
    assert.notEqual(recipe(card({ hide: ".figure,.bar{display:none}" }), root), recipe(card(), root));
  });

  test("changing the crop changes the recipe", () => {
    const { root } = tree({ "index.html": "<p>one</p>" });
    assert.notEqual(recipe(card({ clipY: 22 }), root), recipe(card(), root));
  });

  test("changing how the render settles changes the recipe", () => {
    const { root } = tree({ "index.html": "<p>one</p>" });
    assert.notEqual(recipe(card({ settle: "reduced-motion" }), root), recipe(card(), root));
  });

  // The state a card renders is part of what it shows. `hash` is companygraph's model card: the
  // same page at #core is a different picture, and a card left reported current across that change
  // would advertise the wrong one.
  test("changing the state the card renders changes the recipe", () => {
    const { root } = tree({ "index.html": "<p>one</p>" });
    assert.notEqual(recipe(card({ hash: "#core" }), root), recipe(card(), root));
    assert.notEqual(recipe(card({ hash: "#core" }), root), recipe(card({ hash: "#other" }), root));
  });

  test("rendering the title slide instead of the page changes the recipe", () => {
    const { root } = tree({ "index.html": "<p>one</p>" });
    assert.notEqual(recipe(card({ titleSlide: true }), root), recipe(card(), root));
  });

  // A knob added to a card later must enter the hash on its own. Hand-listing the knobs in the
  // hash is how a new one gets forgotten and starts changing cards silently — and the three sites
  // carry knobs the others do not, so this is the test that lets the shape differ between them
  // without the mechanism differing.
  test("a knob the recipe was never told about still changes it", () => {
    const { root } = tree({ "index.html": "<p>one</p>" });
    assert.notEqual(recipe(card({ someLaterKnob: "x" }), root), recipe(card(), root));
  });

  // The knobs are hashed, not the order they were typed in. Reordering a card literal is not a
  // change to the card, and a check that re-rendered every card over one would stop being read.
  test("reordering a card's keys does not change the recipe", () => {
    const { root } = tree({ "index.html": "<p>one</p>" });
    const c = card();
    const reversed = Object.fromEntries(Object.entries(c).reverse());
    assert.equal(recipe(reversed, root), recipe(c, root));
  });

  test("two cards from the same page with the same frame agree", () => {
    const { root } = tree({ "index.html": "<p>one</p>" });
    assert.equal(recipe(card(), root), recipe(card(), root));
  });

  // --- state: what the check reports -------------------------------------------------------

  test("a card with no stamp beside it is unstamped", () => {
    const { root } = tree({ "index.html": "<p>one</p>" });
    assert.equal(state(card(), root).state, "unstamped");
  });

  test("a card stamped with its own recipe is current", () => {
    const { root } = tree({ "index.html": "<p>one</p>" });
    const c = card();
    fs.writeFileSync(stampOf(".", root), recipe(c, root) + "\n");
    assert.equal(state(c, root).state, "current");
  });

  test("a card whose page moved after it was stamped is stale", () => {
    const { root } = tree({ "index.html": "<p>one</p>" });
    const c = card();
    fs.writeFileSync(stampOf(".", root), recipe(c, root) + "\n");
    fs.writeFileSync(path.join(root, "index.html"), "<p>two</p>");
    assert.equal(state(c, root).state, "stale");
  });

  test("a stamp is read past the newline it is written with", () => {
    const { root } = tree({ "index.html": "<p>one</p>" });
    const c = card();
    fs.writeFileSync(stampOf(".", root), "  " + recipe(c, root) + "  \n\n");
    assert.equal(state(c, root).state, "current");
  });

  test("the stamp sits beside the card it stamps", () => {
    assert.equal(stampOf("talks/intro", "/site"), path.join("/site", "talks/intro", "og.sha"));
  });

  // --- this repository ----------------------------------------------------------------------

  // A card added to the site without an entry in `cards` would never be checked, and nothing else
  // would say so: the check would keep printing ✓ for the others while the new one drifted.
  test("every og.png in this repository has a card that describes it", () => {
    const found = [];
    const walk = (dir) => {
      for (const e of fs.readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true })) {
        const rel = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (e.name !== "node_modules" && !e.name.startsWith(".")) walk(rel);
        } else if (e.name === "og.png") {
          found.push(path.dirname(rel));
        }
      }
    };
    walk(".");
    assert.deepEqual(found.sort(), cards.map((c) => c.dir).sort());
  });

  test("every card in this repository names a page that exists", () => {
    for (const c of cards) {
      assert.ok(
        fs.existsSync(path.join(REPO_ROOT, c.dir, "index.html")),
        `${c.dir} has a card but no index.html`,
      );
    }
  });
}
