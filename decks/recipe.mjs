// What went into a deck's PDFs, and how to tell whether they still show it.
//
// A deck's PDFs are one screenshot per slide: a copy that has to be rendered again whenever the
// deck moves, and nothing about a stale one looks wrong. A share card is the same kind of copy,
// and cards/recipe.mjs is how a card's staleness is told. This is the same answer for a deck,
// and it reads the card recipe's source walk rather than keeping a second one.
//
// The comparison is the recipe, never the pixels, for the card's reason: two machines rasterize
// the same slide differently, and a hash of what went *into* a PDF needs no browser.
//
// `root` is required on every function below, never derived from `import.meta.url`: this module
// sits inside `node_modules` once it ships, and the site owns its root.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { sources } from "../cards/recipe.mjs";

// What exportDecks does to every slide of every deck. These are the package's and not a site's,
// and they live here rather than in export.mjs so that the recipe hashes the very values the
// exporter reads: a knob that changes moves every deck's hash by being changed, rather than by
// someone remembering to say so.
export const FRAME = { width: 1280, height: 720, deviceScaleFactor: 2 };
export const LANGS = ["de", "en"];
// Hide the controls, not the credit: .name lives inside .chrome, and hiding the whole bar took
// the byline off every printed page. A transport in a PDF advertises buttons that do nothing; a
// byline is the one part of that bar a printed page still wants.
export const HIDE = `.transport,.bar,.notes{display:none!important}\n     /* a still image should not be waiting out a transition it does not want */\n     .slide.active > *{animation:none!important}`;
// Milliseconds: after the language switch, and after each slide is made the one shown.
export const SETTLE = { language: 400, slide: 500 };
export const KNOBS = { frame: FRAME, langs: LANGS, hide: HIDE, settle: SETTLE };

// Raised by hand for a change to what a PDF holds that no knob above carries, such as how a
// link is written onto a page.
const MARK = "pdf-recipe/1";

export const pdfOf = (deck, lang) => path.join(deck.dir, `${deck.slug}-${lang}.pdf`);
export const stampOf = (dir, root) => path.join(root, dir, "pdf.sha");

// The card recipe's walk, and one file it cannot find: chat.js fetches mermaid.min.js from
// beside itself when a slide holds a picture, and no tag names it. They are the two files a
// drawn picture's own stamp reads, in lib/pictures.mjs, for the same reason.
export function sourcesOf(dir, root) {
  const found = new Set(sources(dir, root));
  for (const rel of [...found]) {
    if (path.basename(rel) !== "chat.js") continue;
    const mermaid = path.join(path.dirname(rel), "mermaid.min.js");
    if (fs.existsSync(path.join(root, mermaid))) found.add(mermaid);
  }
  return [...found].sort();
}

// Key order in a deck literal is not a change to the deck.
const canonical = (deck) =>
  JSON.stringify(Object.fromEntries(Object.entries(deck).sort(([a], [b]) => (a < b ? -1 : 1))));

// `knobs` is a parameter so that a test can move one; every caller leaves it alone.
export function recipe(deck, root, knobs = KNOBS) {
  const h = crypto.createHash("sha256");
  h.update(MARK + "\n" + JSON.stringify(knobs) + "\n" + canonical(deck) + "\n");
  for (const rel of sourcesOf(deck.dir, root)) {
    h.update(rel + "\0");
    h.update(fs.readFileSync(path.join(root, rel)));
  }
  return h.digest("hex");
}

// One stamp covers both languages: a deck's page holds both, so nothing that moves one PDF's
// inputs leaves the other's alone. `missing` names each PDF the deck should have and does not.
export function state(deck, root) {
  const file = stampOf(deck.dir, root);
  const want = recipe(deck, root);
  const have = fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : "";
  return {
    dir: deck.dir,
    want,
    have,
    missing: LANGS.map((lang) => pdfOf(deck, lang)).filter((rel) => !fs.existsSync(path.join(root, rel))),
    state: !have ? "unstamped" : have === want ? "current" : "stale",
  };
}

// Written after both PDFs are decided, so an exporter that dies half way leaves its deck
// reported stale rather than reported current on a file it never finished.
export function stamp(deck, root) {
  fs.writeFileSync(stampOf(deck.dir, root), recipe(deck, root) + "\n");
}
