// The deck recipe, against throwaway trees rather than a real site's decks — a real deck
// changes, and a test that reads one stops meaning anything the day it does.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { KNOBS, FRAME, LANGS, pdfOf, stampOf, sourcesOf, recipe, state, stamp } from "../decks/recipe.mjs";

// A throwaway site root, seeded with files.
function tree(files = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "decks-recipe-"));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), body);
  }
  return root;
}

const DECK = { dir: "talks/intro", slug: "intro" };
// The query on chat.js is what a cache-busting site writes; the walk strips it.
const PAGE = '<html><link rel="stylesheet" href="../../deck.css">' +
  '<script src="../../chat.js?v=2"></script><script src="scenes.js"></script></html>';
const site = (over = {}) => tree({
  "talks/intro/index.html": PAGE, "deck.css": "a{}", "chat.js": "chat", "mermaid.min.js": "mermaid",
  "talks/intro/scenes.js": "scenes", "unnamed.css": "b{}", ...over,
});

test("root has no default on any raw function", () => {
  // The SITE_ROOT defect, as test/cards-recipe.test.mjs guards it: `length` leaves out a
  // parameter that has a default, so a root that grew one shows as a shorter function.
  for (const [name, fn] of Object.entries({ stampOf, sourcesOf, recipe, state, stamp }))
    assert.equal(fn.length, 2, `${name} has grown a default value on root`);
});

test("the sources are the page, what it names, and mermaid beside the chat.js it names", () => {
  assert.deepEqual(sourcesOf("talks/intro", site()),
    ["chat.js", "deck.css", "mermaid.min.js", "talks/intro/index.html", "talks/intro/scenes.js"]);
});

test("mermaid is not a source of a deck that names no chat.js", () => {
  const root = site({ "talks/intro/index.html": '<html><link rel="stylesheet" href="../../deck.css"></html>' });
  assert.deepEqual(sourcesOf("talks/intro", root), ["deck.css", "talks/intro/index.html"]);
});

test("a chat.js with no mermaid beside it is still a source, and nothing throws", () => {
  const root = site();
  fs.rmSync(path.join(root, "mermaid.min.js"));
  assert.deepEqual(sourcesOf("talks/intro", root),
    ["chat.js", "deck.css", "talks/intro/index.html", "talks/intro/scenes.js"]);
});

for (const rel of ["talks/intro/index.html", "deck.css", "chat.js", "mermaid.min.js", "talks/intro/scenes.js"]) {
  test(`the hash moves when ${rel} moves`, () => {
    const root = site();
    const before = recipe(DECK, root);
    fs.appendFileSync(path.join(root, rel), " ");
    assert.notEqual(recipe(DECK, root), before);
  });
}

test("the hash does not move when a file the page does not name moves", () => {
  const root = site();
  const before = recipe(DECK, root);
  fs.appendFileSync(path.join(root, "unnamed.css"), " ");
  assert.equal(recipe(DECK, root), before);
});

test("the hash moves when a knob moves", () => {
  const root = site();
  assert.notEqual(recipe(DECK, root, { ...KNOBS, settle: { language: 400, slide: 600 } }), recipe(DECK, root));
});

test("the hash moves when the deck's entry moves, and not when its keys change order", () => {
  const root = site();
  assert.notEqual(recipe({ dir: "talks/intro", slug: "other" }, root), recipe(DECK, root));
  assert.equal(recipe({ slug: "intro", dir: "talks/intro" }, root), recipe(DECK, root));
});

test("the knobs are the frame, the languages, the hide rule and the waits the exporter reads", () => {
  assert.deepEqual(FRAME, { width: 1280, height: 720, deviceScaleFactor: 2 });
  assert.deepEqual(LANGS, ["de", "en"]);
  assert.deepEqual(Object.keys(KNOBS).sort(), ["frame", "hide", "langs", "settle"]);
});

test("a deck is unstamped, then current once stamped, then stale once its page moves", () => {
  const root = site();
  assert.equal(state(DECK, root).state, "unstamped");
  stamp(DECK, root);
  assert.equal(fs.readFileSync(stampOf("talks/intro", root), "utf8"), recipe(DECK, root) + "\n");
  assert.equal(state(DECK, root).state, "current");
  fs.appendFileSync(path.join(root, "talks/intro/index.html"), "<!-- edited -->");
  assert.equal(state(DECK, root).state, "stale");
});

test("a stamp an editor left spaces or a blank line around is still read", () => {
  const root = site();
  fs.writeFileSync(stampOf("talks/intro", root), "  " + recipe(DECK, root) + "  \n\n");
  assert.equal(state(DECK, root).state, "current");
});

test("missing names each PDF the deck should have and does not", () => {
  const root = site();
  assert.deepEqual(state(DECK, root).missing, ["talks/intro/intro-de.pdf", "talks/intro/intro-en.pdf"]);
  fs.writeFileSync(path.join(root, pdfOf(DECK, "de")), "pdf");
  assert.deepEqual(state(DECK, root).missing, ["talks/intro/intro-en.pdf"]);
  fs.writeFileSync(path.join(root, pdfOf(DECK, "en")), "pdf");
  assert.deepEqual(state(DECK, root).missing, []);
});
